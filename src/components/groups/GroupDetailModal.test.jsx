import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { colors } from '@dhis2/ui';
import GroupDetailModal from './GroupDetailModal';
import { DEFAULT_SETTINGS } from '../../lib/settings';

function renderModal(props, customData = {}) {
  const onClose = jest.fn();
  const onDeleted = jest.fn();
  const onSaved = jest.fn();
  render(
    <CustomDataProvider data={{ dataElementGroups: () => ({ status: 'OK' }), ...customData }}>
      <GroupDetailModal
        group={{ id: 'g1', name: 'Group 1', code: 'ds1', dataElements: [] }}
        groups={[]}
        datasets={[]}
        settings={DEFAULT_SETTINGS}
        mappings={[]}
        onClose={onClose}
        onDeleted={onDeleted}
        onSaved={onSaved}
        {...props}
      />
    </CustomDataProvider>
  );
  return { onClose, onDeleted, onSaved };
}

describe('GroupDetailModal', () => {
  it('renders the group name and code/UID subtitle', () => {
    renderModal();
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText(/Code ds1/)).toBeInTheDocument();
  });

  it('shows "Not linked" when no dataset matches the group', () => {
    renderModal();
    expect(screen.getByText(/Not linked to any dataset/)).toBeInTheDocument();
  });

});

describe('GroupDetailModal data element diff', () => {
  // One consistent data element (on both sides), one extra in the group
  // (not in the dataset), one missing from the group (dataset-only).
  function renderWithDiff() {
    renderModal({
      group: {
        id: 'g1',
        name: 'DS1',
        code: 'ds1',
        dataElements: [{ id: 'de1', name: 'BCG doses' }, { id: 'de3', name: 'Old vaccine X' }],
      },
      datasets: [
        {
          id: 'ds1',
          name: 'DS1',
          dataSetElements: [
            { dataElement: { id: 'de1', name: 'BCG doses' } },
            { dataElement: { id: 'de2', name: 'Measles dose 1' } },
          ],
        },
      ],
    });
  }

  it('shows the extra data element in yellow/orange with a subtract-circle icon, worded "(will be removed)"', () => {
    renderWithDiff();
    const item = screen.getByText(/Old vaccine X/).closest('li');
    expect(item).toHaveStyle({ color: colors.yellow800 });
    expect(item.querySelector('svg')).not.toBeNull();
    expect(item.textContent).toBe('Old vaccine X (will be removed)');
  });

  it('shows the missing data element in the "Missing from this group" section, green with an add-circle icon', () => {
    renderWithDiff();
    const item = screen.getByText('Measles dose 1').closest('li');
    expect(item).toHaveStyle({ color: colors.green600 });
    expect(item.querySelector('svg')).not.toBeNull();
    // No per-item suffix here — it's already under a dedicated heading.
    expect(item.textContent).toBe('Measles dose 1');
  });

  it('shows a consistent data element (present on both sides) with no color or icon', () => {
    renderWithDiff();
    expect(screen.getByText('BCG doses').closest('li').querySelector('svg')).toBeNull();
  });

  it('sorts the extra data element ahead of consistent ones in the group\'s own list', () => {
    renderWithDiff();
    const groupListItems = screen.getByText('BCG doses').closest('ul').querySelectorAll('li');
    expect(groupListItems[0].textContent).toContain('Old vaccine X');
  });

  it('summarizes the to-remove count next to the heading, and the missing count next to "Missing from this group"', () => {
    renderWithDiff();
    expect(screen.getByText(/1 to remove/)).toBeInTheDocument();
    expect(screen.getByText('Missing from this group (1)')).toBeInTheDocument();
  });

  it('shows no to-remove summary or "Missing from this group" section when fully consistent', () => {
    renderModal({
      group: { id: 'g1', name: 'DS1', code: 'ds1', dataElements: [{ id: 'de1', name: 'BCG doses' }] },
      datasets: [{ id: 'ds1', name: 'DS1', dataSetElements: [{ dataElement: { id: 'de1', name: 'BCG doses' } }] }],
    });
    expect(screen.queryByText(/to remove/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Missing from this group/)).not.toBeInTheDocument();
  });
});
