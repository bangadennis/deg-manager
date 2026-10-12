import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import DatasetDetailModal from './DatasetDetailModal';
import { DEFAULT_SETTINGS } from '../lib/settings';

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
    expect(screen.queryByText('Relink to this group')).not.toBeInTheDocument();
  });

  it('is hidden when the conflicting group is not an orphan (already has a code)', () => {
    renderModal({ groups: [{ ...orphanGroup, code: 'already-set' }] });
    expect(screen.queryByText('Relink to this group')).not.toBeInTheDocument();
  });

  it('is shown for an eligible orphaned conflict', () => {
    renderModal({ groups: [orphanGroup] });
    expect(screen.getByText('Relink to this group')).toBeInTheDocument();
  });

  it('relinks on click: writes the dataset UID into the group\'s code and calls onRelinked + onClose', async () => {
    const user = userEvent.setup();
    const mutate = jest.fn().mockResolvedValue({ status: 'OK' });
    const { onRelinked, onClose } = renderModal({ groups: [orphanGroup] }, { dataElementGroups: mutate });

    await user.click(screen.getByText('Relink to this group'));

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

    await user.click(screen.getByText('Relink to this group'));

    await waitFor(() => expect(screen.getByText('Could not relink this group')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
