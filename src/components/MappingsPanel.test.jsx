import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MappingsPanel from './MappingsPanel';
import { DEFAULT_SETTINGS, MATCH_FIELDS } from '../lib/settings';

const dataset = (id, name) => ({ id, name });
const group   = (id, name) => ({ id, name });

function renderPanel(props) {
  const saveMappings = jest.fn().mockResolvedValue(undefined);
  render(
    <MappingsPanel
      datasets={[dataset('ds1', 'Immunization'), dataset('ds2', 'Malaria')]}
      groups={[group('g1', 'Immunization DEG'), group('g2', 'Malaria DEG')]}
      settings={{ ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.MANUAL }}
      mappings={[]}
      saveMappings={saveMappings}
      {...props}
    />
  );
  return { saveMappings };
}

describe('MappingsPanel', () => {
  it('links a selected dataset and group', async () => {
    const user = userEvent.setup();
    const { saveMappings } = renderPanel();

    await user.click(screen.getByText('Select a dataset…'));
    await user.click(await screen.findByText('Immunization'));

    await user.click(screen.getByText('Select a group…'));
    await user.click(await screen.findByText('Immunization DEG'));

    await user.click(screen.getByText('Link'));

    expect(saveMappings).toHaveBeenCalledWith([{ datasetId: 'ds1', groupId: 'g1' }]);
  });

  it('unlinks an existing mapping', async () => {
    const user = userEvent.setup();
    const { saveMappings } = renderPanel({
      mappings: [{ datasetId: 'ds1', groupId: 'g1' }],
    });

    expect(screen.getByText('Immunization')).toBeInTheDocument();
    expect(screen.getByText('Immunization DEG')).toBeInTheDocument();

    await user.click(screen.getByText('Unlink'));

    expect(saveMappings).toHaveBeenCalledWith([]);
  });

  it('warns when manual mode is not the active mapping setting', () => {
    renderPanel({ settings: { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.UID } });
    expect(screen.getByText(/Manual mapping isn't active/)).toBeInTheDocument();
  });

  it('does not warn when manual mode is active', () => {
    renderPanel();
    expect(screen.queryByText(/Manual mapping isn't active/)).not.toBeInTheDocument();
  });

  it('shows unknown-dataset/group placeholders for a stale mapping rather than crashing', () => {
    renderPanel({ mappings: [{ datasetId: 'gone-ds', groupId: 'gone-group' }] });
    expect(screen.getByText(/Unknown dataset/)).toBeInTheDocument();
    expect(screen.getByText(/Unknown group/)).toBeInTheDocument();
  });
});
