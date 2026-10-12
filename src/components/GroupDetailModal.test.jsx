import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { colors } from '@dhis2/ui';
import GroupDetailModal from './GroupDetailModal';
import { DEFAULT_SETTINGS } from '../lib/settings';

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

  it('colors a missing data element green and an extra one yellow/orange', () => {
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

    const extraItem = screen.getByText(/Old vaccine X/).closest('li');
    expect(extraItem).toHaveStyle({ color: colors.yellow800 });
    expect(extraItem.querySelector('svg')).not.toBeNull();

    const missingItem = screen.getByText('Measles dose 1').closest('li');
    expect(missingItem).toHaveStyle({ color: colors.green600 });
    expect(missingItem.querySelector('svg')).not.toBeNull();

    const consistentItem = screen.getByText('BCG doses').closest('li');
    expect(consistentItem.querySelector('svg')).toBeNull();
  });
});
