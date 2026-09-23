import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatasetsTable from './DatasetsTable';
import { DEFAULT_SETTINGS } from '../lib/settings';

const dataset = (overrides) => ({
  id: 'ds1',
  name: 'Immunization',
  code: 'IMM',
  shortName: 'Immun',
  dataSetElements: [{ dataElement: { id: 'de1', name: 'BCG doses' } }],
  ...overrides,
});

function renderTable(props) {
  const toggleSelect = jest.fn();
  render(
    <DatasetsTable
      datasets={[dataset()]}
      groups={[]}
      settings={DEFAULT_SETTINGS}
      selected={new Set()}
      toggleSelect={toggleSelect}
      trackMap={{}}
      bulkRunning={false}
      {...props}
    />
  );
  return { toggleSelect };
}

describe('DatasetsTable row selection', () => {
  it('clicking the checkbox toggles selection exactly once', async () => {
    const user = userEvent.setup();
    const { toggleSelect } = renderTable();

    await user.click(screen.getByRole('checkbox'));

    // Regression test: the row's own onClick used to also fire on a
    // checkbox click (event bubbling), double-toggling selection back off.
    expect(toggleSelect).toHaveBeenCalledTimes(1);
    expect(toggleSelect).toHaveBeenCalledWith('ds1');
  });

  it('clicking elsewhere in the row also toggles selection once', async () => {
    const user = userEvent.setup();
    const { toggleSelect } = renderTable();

    await user.click(screen.getByText('Immunization'));

    expect(toggleSelect).toHaveBeenCalledTimes(1);
  });

  it('does not toggle selection when the bulk run is in progress', async () => {
    const user = userEvent.setup();
    const { toggleSelect } = renderTable({ bulkRunning: true });

    await user.click(screen.getByText('Immunization'));

    expect(toggleSelect).not.toHaveBeenCalled();
  });
});

describe('DatasetsTable category display', () => {
  it('shows "Unlinked" for a dataset with no matching group', () => {
    renderTable();
    expect(screen.getByText('Unlinked')).toBeInTheDocument();
  });

  it('shows "Consistent" once a matching group has the same data elements and name', () => {
    renderTable({
      groups: [{ id: 'g1', code: 'ds1', name: 'Immunization', shortName: 'Immun', dataElements: [{ id: 'de1', name: 'BCG doses' }] }],
    });
    expect(screen.getByText('Consistent')).toBeInTheDocument();
  });
});

describe('DatasetsTable last updated column', () => {
  // Column order: checkbox, name, target group, sync status, data elements,
  // last updated, bulk run status, view-details action.
  function lastUpdatedCellText() {
    const row = screen.getAllByRole('row')[1]; // row 0 is the header
    return within(row).getAllByRole('cell')[5].textContent;
  }

  it('shows the formatted lastUpdated date', () => {
    renderTable({ datasets: [dataset({ lastUpdated: '2024-03-15T12:00:00Z' })] });
    expect(lastUpdatedCellText()).toBe('Mar 15, 2024');
  });

  it('falls back to an em dash when lastUpdated is missing', () => {
    renderTable();
    expect(lastUpdatedCellText()).toBe('—');
  });
});
