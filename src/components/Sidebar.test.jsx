import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { MATCH_FIELDS } from '../lib/settings';

function renderSidebar(props) {
  const onSelectTab = jest.fn();
  const onOpenSettings = jest.fn();
  render(
    <Sidebar
      activeTab="datasets"
      matchField={MATCH_FIELDS.UID}
      needsSyncCount={0}
      groupsCount={0}
      mappingsCount={0}
      onSelectTab={onSelectTab}
      onOpenSettings={onOpenSettings}
      isSuperuser
      me={{ username: 'admin' }}
      {...props}
    />
  );
  return { onSelectTab, onOpenSettings };
}

describe('Sidebar Mappings visibility', () => {
  it('hides Mappings when matchField is UID', () => {
    renderSidebar({ matchField: MATCH_FIELDS.UID });
    expect(screen.queryByText('Mappings')).not.toBeInTheDocument();
  });

  it('hides Mappings when matchField is code', () => {
    renderSidebar({ matchField: MATCH_FIELDS.CODE });
    expect(screen.queryByText('Mappings')).not.toBeInTheDocument();
  });

  it('shows Mappings when matchField is Manual', () => {
    renderSidebar({ matchField: MATCH_FIELDS.MANUAL, mappingsCount: 3 });
    expect(screen.getByText('Mappings')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clicking Mappings calls onSelectTab with "mappings"', async () => {
    const user = userEvent.setup();
    const { onSelectTab } = renderSidebar({ matchField: MATCH_FIELDS.MANUAL });

    await user.click(screen.getByText('Mappings'));

    expect(onSelectTab).toHaveBeenCalledWith('mappings');
  });
});

describe('Sidebar Settings access', () => {
  // MenuItem renders an <a role="menuitem"> with aria-disabled, not a real
  // disableable form element, so toBeDisabled() doesn't apply here.
  it('disables Settings for a non-superuser', () => {
    renderSidebar({ isSuperuser: false });
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables Settings for a superuser', () => {
    renderSidebar({ isSuperuser: true });
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('aria-disabled', 'false');
  });
});
