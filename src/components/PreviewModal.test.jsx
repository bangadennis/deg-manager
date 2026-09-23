import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewModal from './PreviewModal';
import { evaluateDataset } from '../lib/dhis2';
import { DEFAULT_SETTINGS } from '../lib/settings';

function entryFor(dataset, groups = []) {
  return { dataset, evalResult: evaluateDataset(dataset, groups, DEFAULT_SETTINGS) };
}

describe('PreviewModal', () => {
  it('labels a dataset with no group as "Will create"', () => {
    const dataset = { id: 'ds1', name: 'Immunization', dataSetElements: [] };
    render(<PreviewModal entries={[entryFor(dataset)]} onClose={jest.fn()} onRunSync={jest.fn()} />);

    expect(screen.getByText('Will create')).toBeInTheDocument();
  });

  it('labels an up-to-date dataset as "No change"', () => {
    const dataset = {
      id: 'ds1',
      name: 'Immunization',
      dataSetElements: [{ dataElement: { id: 'de1', name: 'BCG' } }],
    };
    const groups = [{ id: 'g1', code: 'ds1', name: 'Immunization', dataElements: [{ id: 'de1', name: 'BCG' }] }];
    render(<PreviewModal entries={[entryFor(dataset, groups)]} onClose={jest.fn()} onRunSync={jest.fn()} />);

    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('labels an unmappable dataset as "Will fail" with a reason, not a silent skip', () => {
    const settings = { ...DEFAULT_SETTINGS, matchField: 'code' };
    const dataset = { id: 'ds1', name: 'Immunization', dataSetElements: [] };
    const entry = { dataset, evalResult: evaluateDataset(dataset, [], settings) };
    render(<PreviewModal entries={[entry]} onClose={jest.fn()} onRunSync={jest.fn()} />);

    expect(screen.getByText('Will fail')).toBeInTheDocument();
    expect(screen.getByText(/no mapping key value/i)).toBeInTheDocument();
  });

  it('only calls onRunSync when the user explicitly confirms — never on cancel or close', async () => {
    const user = userEvent.setup();
    const onRunSync = jest.fn();
    const onClose = jest.fn();
    const dataset = { id: 'ds1', name: 'Immunization', dataSetElements: [] };
    render(<PreviewModal entries={[entryFor(dataset)]} onClose={onClose} onRunSync={onRunSync} />);

    await user.click(screen.getByText('Cancel'));
    expect(onRunSync).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Run Sync Now'));
    expect(onRunSync).toHaveBeenCalledTimes(1);
  });
});
