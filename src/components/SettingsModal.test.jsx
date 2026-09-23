import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDataProvider } from '@dhis2/app-runtime';
import SettingsModal from './SettingsModal';
import { DEFAULT_SETTINGS } from '../lib/settings';

function renderSettingsModal(props, userGroups = []) {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <CustomDataProvider data={{ userGroups: { userGroups } }}>
      <SettingsModal settings={DEFAULT_SETTINGS} onSave={onSave} onClose={onClose} {...props} />
    </CustomDataProvider>
  );
  return { onSave, onClose };
}

describe('SettingsModal', () => {
  it('saves edited name prefix without mutating the settings object passed in', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal();

    // @dhis2/ui's InputField label isn't programmatically associated with
    // its input (no htmlFor/aria-labelledby), so getByLabelText can't find
    // it — falling back to the placeholder. A partial regex, not the exact
    // trailing-space string, since the installed testing-library/dom version
    // doesn't reliably exact-match a placeholder ending in whitespace.
    await user.type(screen.getByPlaceholderText(/DEG -/), 'DEG - ');
    await user.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].namePrefix).toBe('DEG - ');
    // The prop passed in must stay untouched — DEFAULT_SETTINGS is a shared
    // module-level constant reused across the whole app.
    expect(DEFAULT_SETTINGS.namePrefix).toBe('');
  });

  it('does not call onSave when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal();

    await user.type(screen.getByPlaceholderText(/DEG -/), 'DEG - ');
    await user.click(screen.getByText('Cancel'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('enabling default sharing defaults to "Same as dataset" and hides the Custom controls', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal();

    await user.click(screen.getByLabelText('Apply sharing settings when a group is first created'));

    // "Same as dataset" is pre-selected — the Custom-only controls stay hidden.
    expect(screen.getByText('Same as dataset')).toBeInTheDocument();
    expect(screen.queryByText('Public access')).not.toBeInTheDocument();
    expect(screen.queryByText('View and edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Add a user group…')).not.toBeInTheDocument();

    await user.click(screen.getByText('Save'));

    expect(onSave.mock.calls[0][0].defaultSharing).toEqual({
      enabled: true,
      source: 'dataset',
      publicAccess: DEFAULT_SETTINGS.defaultSharing.publicAccess,
      userGroups: [],
    });
    // The original nested object must also stay untouched.
    expect(DEFAULT_SETTINGS.defaultSharing.enabled).toBe(false);
  });

  it('selecting Custom reveals the public access control, and saving preserves the choice', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal();

    await user.click(screen.getByLabelText('Apply sharing settings when a group is first created'));
    await user.click(screen.getByText('Custom'));
    expect(screen.getByText('View and edit')).toBeInTheDocument();

    await user.click(screen.getByText('View and edit'));
    await user.click(screen.getByText('Save'));

    expect(onSave.mock.calls[0][0].defaultSharing).toEqual({
      enabled: true,
      source: 'custom',
      publicAccess: 'rw------',
      userGroups: [],
    });
  });

  it('adds a user group with default View & edit access, and lets it be removed', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal({}, [{ id: 'ug1', name: 'Data managers' }]);

    await user.click(screen.getByLabelText('Apply sharing settings when a group is first created'));
    await user.click(screen.getByText('Custom'));

    // SingleSelectField renders its placeholder as the closed trigger's text
    // content (it's a custom dropdown, not a native <input placeholder>).
    await user.click(screen.getByText('Add a user group…'));
    await user.click(await screen.findByText('Data managers'));

    expect(screen.getByText('Data managers')).toBeInTheDocument();

    await user.click(screen.getByText('Save'));
    expect(onSave.mock.calls[0][0].defaultSharing.userGroups).toEqual([
      { id: 'ug1', name: 'Data managers', access: 'rw------' },
    ]);
  });

  it('keeps a Custom user group in place when toggling source away and back', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettingsModal({}, [{ id: 'ug1', name: 'Data managers' }]);

    await user.click(screen.getByLabelText('Apply sharing settings when a group is first created'));
    await user.click(screen.getByText('Custom'));
    await user.click(screen.getByText('Add a user group…'));
    await user.click(await screen.findByText('Data managers'));

    await user.click(screen.getByText('Same as dataset'));
    expect(screen.queryByText('Data managers')).not.toBeInTheDocument();

    await user.click(screen.getByText('Custom'));
    expect(screen.getByText('Data managers')).toBeInTheDocument();

    await user.click(screen.getByText('Save'));
    expect(onSave.mock.calls[0][0].defaultSharing.userGroups).toEqual([
      { id: 'ug1', name: 'Data managers', access: 'rw------' },
    ]);
  });

  it('shows the error and keeps the dialog open when saving to the datastore fails', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockRejectedValue(new Error('No write access to this namespace.'));
    const onClose = jest.fn();
    render(
      <CustomDataProvider data={{ userGroups: { userGroups: [] } }}>
        <SettingsModal settings={DEFAULT_SETTINGS} onSave={onSave} onClose={onClose} />
      </CustomDataProvider>
    );

    await user.click(screen.getByText('Save'));

    expect(await screen.findByText('No write access to this namespace.')).toBeInTheDocument();
    // A failed save must not close the dialog — the edits would be lost.
    expect(onClose).not.toHaveBeenCalled();
  });
});
