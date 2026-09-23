import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import DatasetsPanel from './DatasetsPanel';
import { DEFAULT_SETTINGS, MATCH_FIELDS, PUBLIC_ACCESS, SHARING_SOURCE } from '../lib/settings';

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
});
