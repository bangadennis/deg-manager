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
  Chip,
  Tag,
  MenuItem,
  MenuDivider,
  Pagination,
  SharingDialog,
  colors,
} from '@dhis2/ui';
import { IconView16, IconShare16, IconDelete16 } from '@dhis2/ui-icons';
import { findDatasetForGroup, evaluateDataset, getCategoryLabel, getCategoryFilters } from '../lib/dhis2';
import { columnSortProps, sortRows } from '../lib/sorting';
import GroupDetailModal from './GroupDetailModal';
import DeleteGroupModal from './DeleteGroupModal';
import RowActionsMenu from './RowActionsMenu';

const PAGE_SIZES = ['10', '25', '50', '100'];

function getComparators() {
  return {
    name:      (a, b) => a.group.name.localeCompare(b.group.name),
    code:      (a, b) => (a.group.code || '').localeCompare(b.group.code || ''),
    elements:  (a, b) => (a.group.dataElements || []).length - (b.group.dataElements || []).length,
    linked:    (a, b) => (a.linkedDataset?.name || '').localeCompare(b.linkedDataset?.name || ''),
    status:    (a, b) => getCategoryLabel(a.category).localeCompare(getCategoryLabel(b.category)),
  };
}

export default function GroupsPanel({ groups, datasets, settings, mappings, refetchDEG }) {
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState('all');
  const [sortColumn, setSortColumn]     = useState(null);
  const [sortDirection, setSortDirection] = useState('default');
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(25);
  const [detailsForId, setDetailsForId] = useState(null);
  const [sharingForId, setSharingForId] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);

  // Resolve each group's linked dataset and sync category once per render of
  // the underlying data (not on every keystroke/sort/filter click) — same
  // "evaluate once, reuse everywhere" shape as the Datasets tab.
  const evaluated = useMemo(
    () => groups.map((group) => {
      const linkedDataset = findDatasetForGroup(datasets, group, settings, mappings);
      const category = linkedDataset ? evaluateDataset(linkedDataset, groups, settings, mappings).category : 'unlinked';
      return { group, linkedDataset, category };
    }),
    [groups, datasets, settings, mappings]
  );

  const searchedEntries = useMemo(() => {
    if (!search.trim()) return evaluated;
    const q = search.trim().toLowerCase();
    return evaluated.filter(
      ({ group }) =>
        group.name.toLowerCase().includes(q) ||
        (group.code || '').toLowerCase().includes(q) ||
        group.id.toLowerCase().includes(q)
    );
  }, [evaluated, search]);

  const counts = useMemo(() => {
    const c = { all: searchedEntries.length, unlinked: 0, needsUpdate: 0, consistent: 0, conflict: 0, unmappable: 0 };
    searchedEntries.forEach(({ category }) => { c[category]++; });
    return c;
  }, [searchedEntries]);

  const categoryFilters = useMemo(() => getCategoryFilters(), []);
  const filteredEntries = filter === 'all' ? searchedEntries : searchedEntries.filter((e) => e.category === filter);

  const comparators = useMemo(() => getComparators(), []);
  const sortedEntries = useMemo(
    () => sortRows(filteredEntries, sortColumn, sortDirection, comparators),
    [filteredEntries, sortColumn, sortDirection, comparators]
  );

  const pageCount = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = sortedEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSortIconClick({ name, direction }) {
    setSortColumn(name);
    setSortDirection(direction);
    resetToFirstPage();
  }

  const sortProps = (name, label) => columnSortProps(name, label, sortColumn, sortDirection, handleSortIconClick);

  const detailsGroup = detailsForId ? groups.find((g) => g.id === detailsForId) : null;
  const sharingGroup = sharingForId ? groups.find((g) => g.id === sharingForId) : null;
  const deletingGroup = deletingId ? groups.find((g) => g.id === deletingId) : null;

  return (
    <div>
      <p style={{ color: colors.grey700 }}>
        {i18n.t('All Data Element Groups on this instance. "Linked dataset" is worked out from the current mapping key setting, not stored on the group itself.')}
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
        <div style={{ maxWidth: '20rem', marginBottom: '0.75rem' }}>
          <InputField
            label={i18n.t('Filter groups')}
            placeholder={i18n.t('Search by name, code or UID…')}
            value={search}
            onChange={({ value }) => { setSearch(value || ''); resetToFirstPage(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {categoryFilters.map((f) => (
            <Chip
              key={f.key}
              selected={filter === f.key}
              onClick={() => { setFilter(f.key); resetToFirstPage(); }}
            >
              {f.label} ({counts[f.key]})
            </Chip>
          ))}
        </div>
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableColumnHeader {...sortProps('name', i18n.t('Name'))}>{i18n.t('Name')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('code', i18n.t('Code'))}>{i18n.t('Code')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('elements', i18n.t('# Data Elements'))}>{i18n.t('# Data Elements')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('linked', i18n.t('Linked Dataset'))}>{i18n.t('Linked Dataset')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('status', i18n.t('Sync Status'))}>{i18n.t('Sync Status')}</DataTableColumnHeader>
            <DataTableColumnHeader></DataTableColumnHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {pagedEntries.map(({ group, linkedDataset, category }) => (
            <DataTableRow key={group.id}>
              <DataTableCell>{group.name}</DataTableCell>
              <DataTableCell>
                <code>{group.code || '—'}</code>
              </DataTableCell>
              <DataTableCell>{(group.dataElements || []).length}</DataTableCell>
              <DataTableCell>
                {linkedDataset ? linkedDataset.name : <Tag neutral>{i18n.t('Unlinked')}</Tag>}
              </DataTableCell>
              <DataTableCell>
                <Tag positive={category === 'consistent'} negative={category !== 'consistent'}>
                  {getCategoryLabel(category)}
                </Tag>
              </DataTableCell>
              <DataTableCell>
                <RowActionsMenu>
                  <MenuItem label={i18n.t('View')} icon={<IconView16 />} onClick={() => setDetailsForId(group.id)} />
                  <MenuItem label={i18n.t('Sharing settings')} icon={<IconShare16 />} onClick={() => setSharingForId(group.id)} />
                  <MenuDivider />
                  <MenuItem
                    label={i18n.t('Delete')}
                    icon={<IconDelete16 />}
                    destructive
                    onClick={() => setDeletingId(group.id)}
                  />
                </RowActionsMenu>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      {sortedEntries.length === 0 && (
        <p style={{ color: colors.grey700, textAlign: 'center', marginTop: '1rem' }}>
          {i18n.t('No data element groups match the current search/filter.')}
        </p>
      )}

      {sortedEntries.length > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={sortedEntries.length}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); resetToFirstPage(); }}
        />
      )}

      {detailsGroup && (
        <GroupDetailModal
          group={detailsGroup}
          datasets={datasets}
          settings={settings}
          mappings={mappings}
          onClose={() => setDetailsForId(null)}
          onDeleted={() => {
            setDetailsForId(null);
            // Not awaited: useDataQuery's refetch() never rejects on failure
            // — it just never resolves at all — so awaiting it here would
            // risk hanging this callback chain for no benefit; nothing else
            // depends on it completing.
            refetchDEG().catch(() => {});
          }}
        />
      )}

      {sharingGroup && (
        <SharingDialog
          id={sharingGroup.id}
          type="dataElementGroup"
          onClose={() => setSharingForId(null)}
        />
      )}

      {deletingGroup && (
        <DeleteGroupModal
          group={deletingGroup}
          onClose={() => setDeletingId(null)}
          onDeleted={() => {
            setDeletingId(null);
            refetchDEG().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
