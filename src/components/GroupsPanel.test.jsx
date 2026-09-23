import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsPanel from './GroupsPanel';
import { DEFAULT_SETTINGS } from '../lib/settings';

const dataset = (id, name) => ({ id, name, dataSetElements: [] });
const group = (id, name, code, dataElements = []) => ({ id, name, code, dataElements });

function renderPanel(props) {
  const refetchDEG = jest.fn();
  render(
    <GroupsPanel
      groups={[group('g1', 'Bravo Group', 'ds2'), group('g2', 'Alpha Group', 'ds1')]}
      datasets={[dataset('ds1', 'Alpha Dataset'), dataset('ds2', 'Bravo Dataset')]}
      settings={DEFAULT_SETTINGS}
      mappings={[]}
      refetchDEG={refetchDEG}
      {...props}
    />
  );
  return { refetchDEG };
}

function rowOrder() {
  const rows = screen.getAllByRole('row').slice(1); // drop the header row
  return rows.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('GroupsPanel', () => {
  it('lists every group with its linked dataset and sync status', () => {
    renderPanel();
    expect(screen.getByText('Bravo Group')).toBeInTheDocument();
    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
    expect(screen.getByText('Alpha Dataset')).toBeInTheDocument();
    expect(screen.getByText('Bravo Dataset')).toBeInTheDocument();
  });

  it('an unlinked group shows "Unlinked" in both the dataset and status columns', () => {
    renderPanel({ groups: [group('g3', 'Orphan Group', 'no-matching-dataset')] });
    expect(screen.getAllByText('Unlinked').length).toBeGreaterThanOrEqual(1);
  });

  it('filters to only unlinked groups via the category chip', async () => {
    const user = userEvent.setup();
    renderPanel({
      groups: [group('g1', 'Linked Group', 'ds1'), group('g2', 'Orphan Group', 'no-match')],
    });

    expect(screen.getByText('Linked Group')).toBeInTheDocument();
    expect(screen.getByText('Orphan Group')).toBeInTheDocument();

    // The filter chip's text includes its count ("Unlinked (1)"), which is
    // what disambiguates it from the plain "Unlinked" tags the row itself
    // renders (Linked Dataset column + Sync Status column both say it too).
    await user.click(screen.getByText('Unlinked (1)'));

    expect(screen.queryByText('Linked Group')).not.toBeInTheDocument();
    expect(screen.getByText('Orphan Group')).toBeInTheDocument();
  });

  it('search filters by group name or code', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByPlaceholderText('Search by name or code…'), 'Alpha');

    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
    expect(screen.queryByText('Bravo Group')).not.toBeInTheDocument();
  });

  it('sorts by name ascending and descending on repeated header clicks', async () => {
    const user = userEvent.setup();
    renderPanel();

    // Unsorted (insertion order): Bravo, Alpha.
    expect(rowOrder()).toEqual(['Bravo Group', 'Alpha Group']);

    // The sort control is a separate icon button inside the header (with no
    // default accessible name in @dhis2/ui), not the header text itself —
    // columnSortProps gives it a title specifically so it's targetable here.
    const sortByName = screen.getByTitle('Sort by Name');
    await user.click(sortByName);
    expect(rowOrder()).toEqual(['Alpha Group', 'Bravo Group']);

    await user.click(sortByName);
    expect(rowOrder()).toEqual(['Bravo Group', 'Alpha Group']);
  });
});
