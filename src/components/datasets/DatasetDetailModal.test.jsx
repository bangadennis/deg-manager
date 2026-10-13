import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { colors } from '@dhis2/ui';
import DatasetDetailModal from './DatasetDetailModal';
import { DEFAULT_SETTINGS } from '../../lib/settings';

function renderModal(props, customData = {}) {
  const onClose = jest.fn();
  const onRelinked = jest.fn();
  render(
    <CustomDataProvider data={{ dataElementGroups: () => ({ status: 'OK' }), ...customData }}>
      <DatasetDetailModal
        dataset={{ id: 'ds1', name: 'Mortality < 5 years', dataSetElements: [] }}
        datasets={[]}
        groups={[]}
        settings={DEFAULT_SETTINGS}
        mappings={[]}
        onClose={onClose}
        onRelinked={onRelinked}
        {...props}
      />
    </CustomDataProvider>
  );
  return { onClose, onRelinked };
}

describe('DatasetDetailModal relink action', () => {
  const orphanGroup = { id: 'g1', code: '', name: 'Mortality < 5 years', shortName: 'Mort<5', dataElements: [{ id: 'de1' }] };

  it('is hidden when there is no conflict', () => {
    renderModal();
    expect(screen.queryByText('Relink to this data element group')).not.toBeInTheDocument();
  });

  it('is hidden when the conflicting group is not an orphan (already has a code)', () => {
    renderModal({ groups: [{ ...orphanGroup, code: 'already-set' }] });
    expect(screen.queryByText('Relink to this data element group')).not.toBeInTheDocument();
  });

  it('is shown for an eligible orphaned conflict', () => {
    renderModal({ groups: [orphanGroup] });
    expect(screen.getByText('Relink to this data element group')).toBeInTheDocument();
  });

  it('relinks on click: writes the dataset UID into the group\'s code and calls onRelinked + onClose', async () => {
    const user = userEvent.setup();
    const mutate = jest.fn().mockResolvedValue({ status: 'OK' });
    const { onRelinked, onClose } = renderModal({ groups: [orphanGroup] }, { dataElementGroups: mutate });

    await user.click(screen.getByText('Relink to this data element group'));

    await waitFor(() => expect(onRelinked).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const [, query] = mutate.mock.calls[0];
    expect(query.id).toBe('g1');
    expect(query.data.code).toBe('ds1');
    expect(query.data.name).toBe('Mortality < 5 years');
    expect(query.data.shortName).toBe('Mort<5');
    expect(query.data.dataElements).toEqual([{ id: 'de1' }]);
  });

  it('shows an error and stays open if the relink mutation fails', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(
      { groups: [orphanGroup] },
      {
        dataElementGroups: () => {
          throw new Error('network hiccup');
        },
      }
    );

    await user.click(screen.getByText('Relink to this data element group'));

    await waitFor(() => expect(screen.getByText('Could not relink this data element group')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DatasetDetailModal data element diff', () => {
  // One data element consistent on both sides, one missing from the group
  // (present in the dataset only), one extra in the group (not in the
  // dataset) — covers every combination the diff needs to distinguish.
  function renderWithDiff() {
    renderModal({
      dataset: {
        id: 'ds1',
        name: 'DS1',
        dataSetElements: [
          { dataElement: { id: 'de1', name: 'BCG doses' } },
          { dataElement: { id: 'de2', name: 'Measles dose 1' } },
        ],
      },
      groups: [
        {
          id: 'g1',
          code: 'ds1',
          name: 'DS1',
          dataElements: [{ id: 'de1', name: 'BCG doses' }, { id: 'de3', name: 'Old vaccine X' }],
        },
      ],
    });
  }

  it('shows the missing data element in green with an add-circle icon, worded "(will be added)"', () => {
    renderWithDiff();
    const item = screen.getByText(/Measles dose 1/).closest('li');
    expect(item).toHaveStyle({ color: colors.green600 });
    expect(item.querySelector('svg')).not.toBeNull();
    expect(item.textContent).toBe('Measles dose 1 (will be added)');
  });

  it('shows the extra data element in yellow/orange with a subtract-circle icon, worded "(will be removed)"', () => {
    renderWithDiff();
    const item = screen.getByText(/Old vaccine X/).closest('li');
    expect(item).toHaveStyle({ color: colors.yellow800 });
    expect(item.querySelector('svg')).not.toBeNull();
    expect(item.textContent).toBe('Old vaccine X (will be removed)');
  });

  it('shows a consistent data element (present on both sides) with no color or icon', () => {
    renderWithDiff();
    // Appears once in the dataset's own list, once in the group's — neither
    // instance is decorated, since it isn't part of the diff either way.
    const items = screen.getAllByText('BCG doses');
    expect(items).toHaveLength(2);
    items.forEach((el) => expect(el.closest('li').querySelector('svg')).toBeNull());
  });

  it('sorts missing/extra data elements ahead of consistent ones in each list', () => {
    renderWithDiff();
    // "BCG doses" appears in both lists (dataset's and group's) — index 0 is
    // the dataset's own list, where "Measles dose 1" (missing) should sort
    // ahead of it; index 1 is the group's list, used for the extra item.
    const [datasetList, groupList] = screen.getAllByText('BCG doses').map((el) => el.closest('ul'));

    expect(datasetList.querySelectorAll('li')[0].textContent).toContain('Measles dose 1');
    expect(groupList.querySelectorAll('li')[0].textContent).toContain('Old vaccine X');
  });

  it('summarizes the to-add/to-remove counts next to each heading', () => {
    renderWithDiff();
    // The count sits in its own text node next to a " · " separator within
    // the same <span>, so an exact-string match would miss it — see the
    // AuditMeta <br>-separated-spans precedent for the same reasoning.
    expect(screen.getByText(/1 to add/)).toBeInTheDocument();
    expect(screen.getByText(/1 to remove/)).toBeInTheDocument();
  });

  it('shows no to-add/to-remove summary when a list is fully consistent', () => {
    renderModal({
      dataset: { id: 'ds1', name: 'DS1', dataSetElements: [{ dataElement: { id: 'de1', name: 'BCG doses' } }] },
      groups: [{ id: 'g1', code: 'ds1', name: 'DS1', dataElements: [{ id: 'de1', name: 'BCG doses' }] }],
    });
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
    expect(screen.queryByText(/to remove/)).not.toBeInTheDocument();
  });
});
