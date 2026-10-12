import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import DatasetsPanel from './DatasetsPanel';
import { DEFAULT_SETTINGS, MATCH_FIELDS, PUBLIC_ACCESS, SHARING_SOURCE } from '../../lib/settings';

function renderPanel(props, customData = {}) {
  const refetchDEG = jest.fn().mockResolvedValue(undefined);
  render(
    <CustomDataProvider data={{ dataElementGroups: () => ({ id: 'new-group' }), ...customData }}>
      <DatasetsPanel
        datasets={[{ id: 'ds1', name: 'Immunization', dataSetElements: [] }]}
        groups={[]}
        settings={DEFAULT_SETTINGS}
        mappings={[]}
        refetchDEG={refetchDEG}
        {...props}
      />
    </CustomDataProvider>
  );
  return { refetchDEG };
}

async function runBulkSync(user) {
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByText(/Bulk Create \/ Update/));
}

describe('DatasetsPanel bulk run resilience', () => {
  it('clears "Processing" and shows a summary once the run completes normally', async () => {
    const user = userEvent.setup();
    renderPanel();

    await runBulkSync(user);

    await waitFor(() => expect(screen.getByText('Bulk sync summary')).toBeInTheDocument());
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
  });

  // Regression test: runBulk previously had no try/finally around the loop
  // and the post-run refetchDEG() call, so a rejection there (or an
  // unexpected throw while formatting a per-dataset error) left bulkRunning
  // stuck `true` forever — the UI would show "Processing…" indefinitely with
  // no way to recover short of reloading the page.
  it('still clears "Processing" and shows a summary if the post-run refetch fails', async () => {
    const user = userEvent.setup();
    const refetchDEG = jest.fn().mockRejectedValue(new Error('network hiccup'));
    renderPanel({ refetchDEG });

    await runBulkSync(user);

    await waitFor(() => expect(screen.getByText('Bulk sync summary')).toBeInTheDocument());
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
  });

  it('reports a real dataElementGroup create failure (409) without getting stuck', async () => {
    const user = userEvent.setup();
    renderPanel(
      {
        settings: {
          ...DEFAULT_SETTINGS,
          matchField: MATCH_FIELDS.UID,
          defaultSharing: { enabled: true, source: SHARING_SOURCE.CUSTOM, publicAccess: PUBLIC_ACCESS.VIEW, userGroups: [] },
        },
      },
      {
        dataElementGroups: () => {
          const error = new Error('Conflict');
          error.details = {
            httpStatus: 'Conflict',
            httpStatusCode: 409,
            status: 'ERROR',
            message: 'One or more errors occurred, please see full details in import report.',
            response: {
              uid: 'SB8xfUB7ABB',
              errorReports: [{ message: 'Data sharing is not enabled for type `class org.hisp.dhis.dataelement.DataElementGroup`, but access strings contain data sharing read or write' }],
              responseType: 'ObjectReport',
            },
          };
          throw error;
        },
      }
    );

    await runBulkSync(user);

    await waitFor(() => expect(screen.getByText('Bulk sync summary')).toBeInTheDocument());
    expect(screen.getByText(/Data sharing is not enabled/)).toBeInTheDocument();
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
  });
});

describe('DatasetsPanel no-op guard', () => {
  it('disables Bulk Create / Update when every selected dataset is already consistent', async () => {
    const user = userEvent.setup();
    renderPanel({
      groups: [{ id: 'g1', code: 'ds1', name: 'Immunization', dataElements: [] }],
    });

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText(/Bulk Create \/ Update/).closest('button')).toBeDisabled();
  });

  it('enables Bulk Create / Update once at least one selected dataset actually needs a sync', async () => {
    const user = userEvent.setup();
    renderPanel({
      datasets: [
        { id: 'ds1', name: 'Immunization', dataSetElements: [] },
        { id: 'ds2', name: 'Nutrition', dataSetElements: [] },
      ],
      groups: [{ id: 'g1', code: 'ds1', name: 'Immunization', dataElements: [] }],
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // ds1 — already consistent
    await user.click(checkboxes[1]); // ds2 — unlinked, actually syncable

    expect(screen.getByText(/Bulk Create \/ Update/).closest('button')).not.toBeDisabled();
  });
});

describe('DatasetsPanel search', () => {
  function renderTwoDatasets() {
    return renderPanel({
      datasets: [
        { id: 'ds1', name: 'Immunization', code: 'IMM', dataSetElements: [] },
        { id: 'ds2', name: 'Nutrition', code: 'NUT', dataSetElements: [] },
      ],
    });
  }

  it('filters by dataset name', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'Immun');

    expect(screen.getByText('Immunization')).toBeInTheDocument();
    expect(screen.queryByText('Nutrition')).not.toBeInTheDocument();
  });

  it('filters by dataset code', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'NUT');

    expect(screen.getByText('Nutrition')).toBeInTheDocument();
    expect(screen.queryByText('Immunization')).not.toBeInTheDocument();
  });

  it('filters by dataset UID', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'ds1');

    expect(screen.getByText('Immunization')).toBeInTheDocument();
    expect(screen.queryByText('Nutrition')).not.toBeInTheDocument();
  });

  it('"Select All" only selects what the current search matches, not the full list', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'Immun');
    await user.click(screen.getByText(/Select All/));

    // Only the one matching dataset is selected — the Bulk button's own
    // count is the simplest observable proxy for the current selection size.
    expect(screen.getByText(/Bulk Create \/ Update \(1 selected\)/)).toBeInTheDocument();
  });

  it('a category filter chip narrows the table without touching the current selection', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    // Both datasets are "Unlinked" (no matching group) — select one by hand,
    // then switch the category filter to something that would hide it.
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByText(/^In sync/));

    // Immunization (selected) is now hidden by the filter, but its
    // selection — reflected in the Bulk button's count — must survive.
    expect(screen.queryByText('Immunization')).not.toBeInTheDocument();
    expect(screen.getByText(/Bulk Create \/ Update \(1 selected\)/)).toBeInTheDocument();
  });

  it('clearing the search restores the full list without losing the selection made while filtered', async () => {
    const user = userEvent.setup();
    renderTwoDatasets();

    const search = screen.getByPlaceholderText('Search by name, code or UID…');
    await user.type(search, 'Immun');
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.clear(search);

    expect(screen.getByText('Nutrition')).toBeInTheDocument();
    expect(screen.getByText(/Bulk Create \/ Update \(1 selected\)/)).toBeInTheDocument();
  });
});

describe('DatasetsPanel relink conflicts', () => {
  const conflictedDataset = { id: 'ds1', name: 'Mortality < 5 years', dataSetElements: [] };
  const orphanGroup = { id: 'g1', code: '', name: 'Mortality < 5 years', shortName: 'Mort<5', dataElements: [{ id: 'de1' }] };

  it('is hidden by default (setting off)', () => {
    renderPanel({ datasets: [conflictedDataset], groups: [orphanGroup] });
    expect(screen.queryByText(/Relink Conflicts/)).not.toBeInTheDocument();
  });

  it('is hidden in Manual mode even when the setting is on', () => {
    renderPanel({
      datasets: [conflictedDataset],
      groups: [orphanGroup],
      settings: { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.MANUAL, allowOrphanRelink: true },
    });
    expect(screen.queryByText(/Relink Conflicts/)).not.toBeInTheDocument();
  });

  it('is hidden when the conflicting group already has a code (not an orphan)', () => {
    renderPanel({
      datasets: [conflictedDataset],
      groups: [{ ...orphanGroup, code: 'already-set' }],
      settings: { ...DEFAULT_SETTINGS, allowOrphanRelink: true },
    });
    expect(screen.queryByText(/Relink Conflicts/)).not.toBeInTheDocument();
  });

  it('shows the button, disabled, with a zero count until something eligible is selected', () => {
    renderPanel({
      datasets: [conflictedDataset],
      groups: [orphanGroup],
      settings: { ...DEFAULT_SETTINGS, allowOrphanRelink: true },
    });
    expect(screen.getByText('Relink Conflicts (0 selected)').closest('button')).toBeDisabled();
  });

  it('selecting a relinkable dataset via "Select Relinkable" enables the button with the right count', async () => {
    const user = userEvent.setup();
    renderPanel({
      datasets: [conflictedDataset],
      groups: [orphanGroup],
      settings: { ...DEFAULT_SETTINGS, allowOrphanRelink: true },
    });

    await user.click(screen.getByText('Select Relinkable (1)'));

    expect(screen.getByText('Relink Conflicts (1 selected)').closest('button')).not.toBeDisabled();
  });

  it('only relinks datasets that are both eligible and selected, leaving everything else untouched', async () => {
    const user = userEvent.setup();
    const mutate = jest.fn().mockResolvedValue({ status: 'OK' });
    const { refetchDEG } = renderPanel(
      {
        datasets: [conflictedDataset],
        groups: [orphanGroup],
        settings: { ...DEFAULT_SETTINGS, allowOrphanRelink: true },
      },
      { dataElementGroups: mutate }
    );

    // Not selected yet — the preview must not open on a disabled button.
    await user.click(screen.getByText('Relink Conflicts (0 selected)'));
    expect(screen.queryByText('Relink Now')).not.toBeInTheDocument();

    await user.click(screen.getByText('Select Relinkable (1)'));
    await user.click(screen.getByText('Relink Conflicts (1 selected)'));
    await user.click(screen.getByText('Relink Now'));

    await waitFor(() => expect(screen.getByText('Bulk sync summary')).toBeInTheDocument());

    expect(mutate).toHaveBeenCalledTimes(1);
    const [, query] = mutate.mock.calls[0];
    expect(query.id).toBe('g1');
    expect(query.data.code).toBe('ds1');
    expect(query.data.name).toBe('Mortality < 5 years');
    expect(query.data.shortName).toBe('Mort<5');
    expect(query.data.dataElements).toEqual([{ id: 'de1' }]);
    expect(refetchDEG).toHaveBeenCalled();
  });
});
