import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import GroupsPanel from './GroupsPanel';
import { DEFAULT_SETTINGS } from '../lib/settings';

const dataset = (id, name) => ({ id, name, dataSetElements: [] });
const group = (id, name, code, dataElements = [], shortName) => ({ id, name, code, dataElements, shortName });

function renderPanel(props, customData = {}) {
  const refetchDEG = jest.fn().mockResolvedValue(undefined);
  render(
    <CustomDataProvider data={{ dataElementGroups: () => ({ status: 'OK' }), ...customData }}>
      <GroupsPanel
        groups={[group('g1', 'Bravo Group', 'ds2'), group('g2', 'Alpha Group', 'ds1')]}
        datasets={[dataset('ds1', 'Alpha Dataset'), dataset('ds2', 'Bravo Dataset')]}
        settings={DEFAULT_SETTINGS}
        mappings={[]}
        refetchDEG={refetchDEG}
        {...props}
      />
    </CustomDataProvider>
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

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'Alpha');

    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
    expect(screen.queryByText('Bravo Group')).not.toBeInTheDocument();
  });

  it('search filters by group UID', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByPlaceholderText('Search by name, code or UID…'), 'g2');

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

  it('shows each group\'s short name in its own column', () => {
    renderPanel({
      groups: [group('g1', 'Bravo Group', 'ds2', [], 'BRAVO')],
    });
    expect(screen.getByText('BRAVO')).toBeInTheDocument();
  });
});

describe('GroupsPanel editing', () => {
  async function openEditFor(user, groupName) {
    const row = screen.getByText(groupName).closest('tr');
    await user.click(within(row).getByLabelText('More actions'));
    await user.click(screen.getByText('Edit'));
  }

  it('opens the edit modal pre-filled with the group\'s current name, short name and code', async () => {
    const user = userEvent.setup();
    renderPanel({
      groups: [group('g1', 'Bravo Group', 'ds2', [], 'BRAVO')],
    });

    await openEditFor(user, 'Bravo Group');

    expect(screen.getByText('Edit "Bravo Group"')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bravo Group')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BRAVO')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ds2')).toBeInTheDocument();
  });

  it('disables Save and shows a validation message when the name is cleared', async () => {
    const user = userEvent.setup();
    renderPanel({
      groups: [group('g1', 'Bravo Group', 'ds2', [], 'BRAVO')],
    });

    await openEditFor(user, 'Bravo Group');
    await user.clear(screen.getByDisplayValue('Bravo Group'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('blocks saving when the name/short name is already used by another group', async () => {
    const user = userEvent.setup();
    const mutate = jest.fn();
    renderPanel(
      {
        groups: [
          group('g1', 'Bravo Group', 'ds2', [], 'BRAVO'),
          group('g2', 'Alpha Group', 'ds1', [], 'ALPHA'),
        ],
      },
      { dataElementGroups: mutate }
    );

    await openEditFor(user, 'Bravo Group');
    await user.clear(screen.getByDisplayValue('Bravo Group'));
    await user.type(screen.getByPlaceholderText('Name'), 'Alpha Group');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already used by another group/)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('saves the edited name/short name/code and refetches on success', async () => {
    const user = userEvent.setup();
    const mutate = jest.fn().mockResolvedValue({ status: 'OK' });
    const { refetchDEG } = renderPanel(
      { groups: [group('g1', 'Bravo Group', 'ds2', [], 'BRAVO')] },
      { dataElementGroups: mutate }
    );

    await openEditFor(user, 'Bravo Group');
    await user.clear(screen.getByDisplayValue('Bravo Group'));
    await user.type(screen.getByPlaceholderText('Name'), 'Bravo Group Renamed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [type, query] = mutate.mock.calls[0];
    // UPDATE_DEG_MUTATION's declared type is 'update', but the DataEngine
    // resolves that to the 'replace' FetchType (a full-object PUT) by the
    // time it reaches the custom resource function.
    expect(type).toBe('replace');
    expect(query.id).toBe('g1');
    expect(query.data.name).toBe('Bravo Group Renamed');
    expect(query.data.shortName).toBe('BRAVO');
    expect(query.data.code).toBe('ds2');

    await waitFor(() => expect(screen.queryByText('Edit "Bravo Group"')).not.toBeInTheDocument());
    expect(refetchDEG).toHaveBeenCalled();
  });
});
