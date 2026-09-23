import React, { useState, lazy, Suspense } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { CircularLoader, NoticeBox, Menu, MenuItem, MenuSectionHeader, MenuDivider, Tag, colors } from '@dhis2/ui';
import { IconSettings16 } from '@dhis2/ui-icons';
import { DATASETS_QUERY, DEG_QUERY, ME_QUERY, evaluateDataset } from './lib/dhis2';
import { useDatastoreSettings } from './hooks/useDatastoreSettings';
import { useDatastoreMappings } from './hooks/useDatastoreMappings';
import SettingsModal from './components/SettingsModal';

// Only one of these is ever visible at a time (tab switch), and GroupsPanel
// alone pulls in SharingDialog + Pagination — a meaningful chunk of the
// bundle that datasets-only users never need to download.
const DatasetsPanel = lazy(() => import('./components/DatasetsPanel'));
const GroupsPanel   = lazy(() => import('./components/GroupsPanel'));
const MappingsPanel = lazy(() => import('./components/MappingsPanel'));

const SIDEBAR_WIDTH = '16rem';

export default function App() {
  const { loading: dsLoading, error: dsError, data: dsData } = useDataQuery(DATASETS_QUERY);
  const { loading: degLoading, error: degError, data: degData, refetch: refetchDEG } = useDataQuery(DEG_QUERY);
  const { data: meData } = useDataQuery(ME_QUERY);
  const { settings, loading: settingsLoading, save: saveSettings } = useDatastoreSettings();
  const { mappings, loading: mappingsLoading, save: saveMappings } = useDatastoreMappings();

  const [activeTab, setActiveTab]       = useState('datasets');
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (dsLoading || degLoading || settingsLoading || mappingsLoading) return <CircularLoader />;
  if (dsError)  return <NoticeBox error title={i18n.t('Error loading datasets')}>{dsError.message}</NoticeBox>;
  if (degError) return <NoticeBox error title={i18n.t('Error loading data element groups')}>{degError.message}</NoticeBox>;

  const datasets = dsData?.dataSets?.dataSets || [];
  const groups   = degData?.dataElementGroups?.dataElementGroups || [];
  const me       = meData?.me;
  const isSuperuser = !!me?.authorities?.includes('ALL');

  const needsSyncCount = datasets.filter((ds) => {
    const category = evaluateDataset(ds, groups, settings, mappings).category;
    return category === 'unlinked' || category === 'needsUpdate' || category === 'conflict';
  }).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
              onClick={() => setActiveTab('datasets')}
              suffix={needsSyncCount > 0 ? String(needsSyncCount) : undefined}
            />
            <MenuItem
              label={i18n.t('Data Element Groups')}
              active={activeTab === 'groups'}
              onClick={() => setActiveTab('groups')}
              suffix={String(groups.length)}
            />
            <MenuItem
              label={i18n.t('Mappings')}
              active={activeTab === 'mappings'}
              onClick={() => setActiveTab('mappings')}
              suffix={mappings.length > 0 ? String(mappings.length) : undefined}
            />
            <MenuDivider />
            <span title={isSuperuser ? undefined : i18n.t('Only superusers can change settings')}>
              <MenuItem
                label={i18n.t('Settings')}
                icon={<IconSettings16 />}
                disabled={!isSuperuser}
                onClick={() => setSettingsOpen(true)}
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

      <main style={{ flex: 1, padding: '1.5rem', minWidth: 0 }}>
        <Suspense fallback={<CircularLoader />}>
          {activeTab === 'datasets' && (
            <>
              <h2 style={{ marginTop: 0 }}>{i18n.t('Datasets')}</h2>
              <DatasetsPanel
                datasets={datasets}
                groups={groups}
                settings={settings}
                mappings={mappings}
                refetchDEG={refetchDEG}
              />
            </>
          )}
          {activeTab === 'groups' && (
            <>
              <h2 style={{ marginTop: 0 }}>{i18n.t('Data Element Groups')}</h2>
              <GroupsPanel
                groups={groups}
                datasets={datasets}
                settings={settings}
                mappings={mappings}
                refetchDEG={refetchDEG}
              />
            </>
          )}
          {activeTab === 'mappings' && (
            <>
              <h2 style={{ marginTop: 0 }}>{i18n.t('Mappings')}</h2>
              <MappingsPanel
                datasets={datasets}
                groups={groups}
                settings={settings}
                mappings={mappings}
                saveMappings={saveMappings}
              />
            </>
          )}
        </Suspense>
      </main>

      {settingsOpen && isSuperuser && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
