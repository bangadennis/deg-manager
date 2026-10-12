import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Menu, MenuItem, MenuSectionHeader, MenuDivider, Tag, colors } from '@dhis2/ui';
import { IconSettings16 } from '@dhis2/ui-icons';
import { MATCH_FIELDS } from '../lib/settings';

export const SIDEBAR_WIDTH = '16rem';

// Pure presentational — App.jsx owns every query/mutation this depends on,
// so this can be rendered and tested without wiring up a CustomDataProvider.
export default function Sidebar({
  activeTab,
  matchField,
  datasetsCount,
  needsSyncCount,
  groupsCount,
  mappingsCount,
  onSelectTab,
  onOpenSettings,
  isSuperuser,
  me,
}) {
  // Mappings only means anything in Manual mode (code/UID mode links groups
  // to datasets automatically, with no pairing to manage) — kept next to
  // Settings rather than among the primary data tabs since it's an
  // admin-adjacent control, not something every user needs day to day.
  const showMappings = matchField === MATCH_FIELDS.MANUAL;

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${colors.grey400}`,
        paddingTop: '1rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ padding: '0 1rem 1rem' }}>
          <h1 style={{ fontSize: '1.15rem', margin: 0 }}>DEG Manager</h1>
          <p style={{ color: colors.grey700, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            {i18n.t('Dataset data elements to Data Element Groups')}
          </p>
        </div>
        <Menu>
          <MenuSectionHeader label={i18n.t('Manage')} />
          <MenuItem
            label={i18n.t('Datasets')}
            active={activeTab === 'datasets'}
            onClick={() => onSelectTab('datasets')}
            suffix={
              needsSyncCount > 0 ? (
                // Total count, same as Data Element Groups below, plus a
                // bold red badge calling out how many need attention —
                // the plain total alone would lose that signal.
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag negative bold>{needsSyncCount}</Tag>
                  <span>{datasetsCount}</span>
                </span>
              ) : (
                String(datasetsCount)
              )
            }
          />
          <MenuItem
            label={i18n.t('Data Element Groups')}
            active={activeTab === 'groups'}
            onClick={() => onSelectTab('groups')}
            suffix={String(groupsCount)}
          />
          <MenuDivider />
          {showMappings && (
            <MenuItem
              label={i18n.t('Mappings')}
              active={activeTab === 'mappings'}
              onClick={() => onSelectTab('mappings')}
              suffix={mappingsCount > 0 ? String(mappingsCount) : undefined}
            />
          )}
          <span title={isSuperuser ? undefined : i18n.t('Only superusers can change settings')}>
            <MenuItem
              label={i18n.t('Settings')}
              icon={<IconSettings16 />}
              disabled={!isSuperuser}
              onClick={onOpenSettings}
            />
          </span>
        </Menu>
      </div>

      {me && (
        <div style={{ padding: '1rem', borderTop: `1px solid ${colors.grey400}` }}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>{me.username}</p>
          <p style={{ margin: '0.25rem 0 0' }}>
            {isSuperuser ? <Tag positive>{i18n.t('Superuser')}</Tag> : <Tag neutral>{i18n.t('Standard user')}</Tag>}
          </p>
        </div>
      )}
    </aside>
  );
}
