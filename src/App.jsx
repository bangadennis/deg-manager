import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
// Registers the generated en/fr resource bundles (src/locales/index.js,
// regenerated on every build from i18n/*.po) with this same i18n instance.
// Without this import nothing ever calls addResourceBundle(), so i18n.t()
// silently falls back to its raw English key regardless of the active
// DHIS2 UI locale — the translations exist but are never loaded.
import './locales';
import { CircularLoader, NoticeBox } from '@dhis2/ui';
import { DATASETS_QUERY, DEG_QUERY, ME_QUERY, evaluateDataset } from './lib/dhis2';
import { MATCH_FIELDS } from './lib/settings';
import { useDatastoreSettings } from './hooks/useDatastoreSettings';
import { useDatastoreMappings } from './hooks/useDatastoreMappings';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';

// Only one of these is ever visible at a time (tab switch), and GroupsPanel
// alone pulls in SharingDialog + Pagination — a meaningful chunk of the
// bundle that datasets-only users never need to download.
const DatasetsPanel = lazy(() => import('./components/DatasetsPanel'));
const GroupsPanel   = lazy(() => import('./components/GroupsPanel'));
const MappingsPanel = lazy(() => import('./components/MappingsPanel'));

export default function App() {
  const { loading: dsLoading, error: dsError, data: dsData } = useDataQuery(DATASETS_QUERY);
  const { loading: degLoading, error: degError, data: degData, refetch: refetchDEG } = useDataQuery(DEG_QUERY);
  const { data: meData } = useDataQuery(ME_QUERY);
  const { settings, loading: settingsLoading, save: saveSettings } = useDatastoreSettings();
  const { mappings, loading: mappingsLoading, save: saveMappings } = useDatastoreMappings();

  const [activeTab, setActiveTab]       = useState('datasets');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mappings is only reachable in Manual mode (see Sidebar) — if the mode
  // changes away from Manual while that tab is active, fall back rather than
  // leaving activeTab pointed at a now-hidden tab.
  useEffect(() => {
    // settings is null while useDatastoreSettings() is still loading/
    // bootstrapping — the component renders a CircularLoader for that whole
    // window (see the early return below), but this hook still runs on
    // every render regardless, so it must tolerate settings being null.
    if (activeTab === 'mappings' && settings && settings.matchField !== MATCH_FIELDS.MANUAL) {
      setActiveTab('datasets');
    }
  }, [activeTab, settings]);

  if (dsLoading || degLoading || settingsLoading || mappingsLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularLoader />
      </div>
    );
  }
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
      <Sidebar
        activeTab={activeTab}
        matchField={settings.matchField}
        needsSyncCount={needsSyncCount}
        groupsCount={groups.length}
        mappingsCount={mappings.length}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
        isSuperuser={isSuperuser}
        me={me}
      />

      <main style={{ flex: 1, padding: '1.5rem', minWidth: 0 }}>
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <CircularLoader />
          </div>
        }>
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
