import React, { useState, useMemo } from 'react';
import i18n from '@dhis2/d2-i18n';
import {
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTableHead,
  DataTableColumnHeader,
  DataTableBody,
  InputField,
  SingleSelectField,
  SingleSelectOption,
  Button,
  NoticeBox,
  Pagination,
  colors,
} from '@dhis2/ui';
import { MATCH_FIELDS } from '../lib/settings';
import { getErrorMessage } from '../lib/errors';
import { columnSortProps, sortRows } from '../lib/sorting';

const PAGE_SIZES = ['10', '25', '50', '100'];

const COMPARATORS = {
  dataset: (a, b) => (a.dataset?.name || '').localeCompare(b.dataset?.name || ''),
  group:   (a, b) => (a.group?.name || '').localeCompare(b.group?.name || ''),
};

export default function MappingsPanel({ datasets, groups, settings, mappings, saveMappings }) {
  const [search, setSearch]                 = useState('');
  const [sortColumn, setSortColumn]         = useState(null);
  const [sortDirection, setSortDirection]   = useState('default');
  const [page, setPage]                     = useState(1);
  const [pageSize, setPageSize]             = useState(25);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedGroupId, setSelectedGroupId]     = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState(null);

  const datasetById = useMemo(() => new Map(datasets.map((ds) => [ds.id, ds])), [datasets]);
  const groupById    = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const mappedDatasetIds = useMemo(() => new Set(mappings.map((m) => m.datasetId)), [mappings]);
  const mappedGroupIds   = useMemo(() => new Set(mappings.map((m) => m.groupId)), [mappings]);

  const availableDatasets = useMemo(
    () => datasets.filter((ds) => !mappedDatasetIds.has(ds.id)),
    [datasets, mappedDatasetIds]
  );
  const availableGroups = useMemo(
    () => groups.filter((g) => !mappedGroupIds.has(g.id)),
    [groups, mappedGroupIds]
  );

  const rows = useMemo(() => {
    const withNames = mappings.map((m) => ({
      ...m,
      dataset: datasetById.get(m.datasetId),
      group: groupById.get(m.groupId),
    }));
    if (!search.trim()) return withNames;
    const q = search.trim().toLowerCase();
    return withNames.filter(
      (r) => (r.dataset?.name || '').toLowerCase().includes(q) || (r.group?.name || '').toLowerCase().includes(q)
    );
  }, [mappings, datasetById, groupById, search]);

  const sortedRows = useMemo(
    () => sortRows(rows, sortColumn, sortDirection, COMPARATORS),
    [rows, sortColumn, sortDirection]
  );

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSortIconClick({ name, direction }) {
    setSortColumn(name);
    setSortDirection(direction);
    resetToFirstPage();
  }

  const sortProps = (name, label) => columnSortProps(name, label, sortColumn, sortDirection, handleSortIconClick);

  async function handleLink() {
    if (!selectedDatasetId || !selectedGroupId) return;
    setSaving(true);
    setError(null);
    try {
      await saveMappings([...mappings, { datasetId: selectedDatasetId, groupId: selectedGroupId }]);
      setSelectedDatasetId('');
      setSelectedGroupId('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink(datasetId) {
    setSaving(true);
    setError(null);
    try {
      await saveMappings(mappings.filter((m) => m.datasetId !== datasetId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {settings.matchField !== MATCH_FIELDS.MANUAL && (
        <div style={{ marginBottom: '1rem' }}>
          <NoticeBox warning title={i18n.t("Manual mapping isn't active")}>
            {i18n.t('These pairings are saved, but datasets are currently linked using {{field}}. Switch "Map groups to datasets using" to Manual in Settings for them to take effect.', {
              field: settings.matchField === 'code' ? i18n.t('Dataset code') : i18n.t('Dataset UID'),
            })}
          </NoticeBox>
        </div>
      )}

      <p style={{ color: colors.grey700 }}>
        {i18n.t('Pair a dataset with an existing Data Element Group by hand. Only used when the mapping mode in Settings is set to Manual — a dataset can be synced (data elements and name kept in sync) once paired, but this view never creates a new group.')}
      </p>

      <div
        style={{
          background: colors.grey050,
          border: `1px solid ${colors.grey300}`,
          borderRadius: 4,
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <p style={{ fontWeight: 500, marginTop: 0, marginBottom: '0.75rem' }}>{i18n.t('Add a mapping')}</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '14rem' }}>
            <SingleSelectField
              filterable
              label={i18n.t('Dataset')}
              placeholder={i18n.t('Select a dataset…')}
              noMatchText={i18n.t('No matching datasets')}
              disabled={saving || availableDatasets.length === 0}
              selected={selectedDatasetId}
              onChange={({ selected }) => setSelectedDatasetId(selected)}
            >
              {availableDatasets.map((ds) => (
                <SingleSelectOption key={ds.id} value={ds.id} label={ds.name} />
              ))}
            </SingleSelectField>
          </div>
          <div style={{ flex: 1, minWidth: '14rem' }}>
            <SingleSelectField
              filterable
              label={i18n.t('Data Element Group')}
              placeholder={i18n.t('Select a group…')}
              noMatchText={i18n.t('No matching groups')}
              disabled={saving || availableGroups.length === 0}
              selected={selectedGroupId}
              onChange={({ selected }) => setSelectedGroupId(selected)}
            >
              {availableGroups.map((g) => (
                <SingleSelectOption key={g.id} value={g.id} label={g.name} />
              ))}
            </SingleSelectField>
          </div>
          <Button primary disabled={!selectedDatasetId || !selectedGroupId || saving} onClick={handleLink}>
            {saving ? i18n.t('Linking…') : i18n.t('Link')}
          </Button>
        </div>

        {error && (
          <div style={{ marginTop: '1rem' }}>
            <NoticeBox error title={i18n.t('Could not save mapping')}>{error}</NoticeBox>
          </div>
        )}
      </div>

      <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{i18n.t('Current mappings')}</p>
      <div style={{ maxWidth: '20rem', marginBottom: '1rem' }}>
        <InputField
          label={i18n.t('Filter mappings')}
          placeholder={i18n.t('Search by dataset or group name…')}
          value={search}
          onChange={({ value }) => { setSearch(value || ''); resetToFirstPage(); }}
        />
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableColumnHeader {...sortProps('dataset', i18n.t('Dataset'))}>{i18n.t('Dataset')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('group', i18n.t('Data Element Group'))}>{i18n.t('Data Element Group')}</DataTableColumnHeader>
            <DataTableColumnHeader></DataTableColumnHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {pagedRows.map((r) => (
            <DataTableRow key={r.datasetId}>
              <DataTableCell>
                {r.dataset ? r.dataset.name : <span style={{ color: colors.red060 }}>{i18n.t('Unknown dataset ({{id}})', { id: r.datasetId })}</span>}
              </DataTableCell>
              <DataTableCell>
                {r.group ? r.group.name : <span style={{ color: colors.red060 }}>{i18n.t('Unknown group ({{id}})', { id: r.groupId })}</span>}
              </DataTableCell>
              <DataTableCell>
                <Button small destructive secondary disabled={saving} onClick={() => handleUnlink(r.datasetId)}>
                  {i18n.t('Unlink')}
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      {sortedRows.length === 0 && (
        <p style={{ color: colors.grey700, textAlign: 'center', marginTop: '1rem' }}>
          {mappings.length === 0 ? i18n.t('No mappings yet.') : i18n.t('No mappings match "{{search}}".', { search })}
        </p>
      )}

      {sortedRows.length > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={sortedRows.length}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); resetToFirstPage(); }}
        />
      )}
    </div>
  );
}
