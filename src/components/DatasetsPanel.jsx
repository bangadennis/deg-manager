import React, { useState, useMemo } from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Button, ButtonStrip, LinearLoader, InputField, Chip, Pagination, colors } from '@dhis2/ui';
import {
  CREATE_DEG_MUTATION,
  UPDATE_DEG_MUTATION,
  evaluateDataset,
  buildSharingPayload,
  getCategoryLabel,
  getCategoryFilters,
} from '../lib/dhis2';
import { MATCH_FIELDS } from '../lib/settings';
import { getErrorMessage } from '../lib/errors';
import { sortRows } from '../lib/sorting';
import DatasetsTable from './DatasetsTable';
import BulkSummaryModal from './BulkSummaryModal';
import PreviewModal from './PreviewModal';

const PAGE_SIZES = ['10', '25', '50', '100'];

// Ascending comparators; sortRows reverses the result for 'desc'. targetGroup
// compares whatever the "Target Group" column actually displays (the manual
// mode's linked group name, or the raw UID/code otherwise) so sort order
// always matches what's visible on screen.
function targetGroupSortValue(entry, settings) {
  return settings.matchField === MATCH_FIELDS.MANUAL
    ? entry.evalResult.group?.name || ''
    : entry.dataset[settings.matchField] || '';
}

function makeComparators(settings) {
  return {
    name:        (a, b) => a.dataset.name.localeCompare(b.dataset.name),
    targetGroup: (a, b) => targetGroupSortValue(a, settings).localeCompare(targetGroupSortValue(b, settings)),
    status:      (a, b) => getCategoryLabel(a.evalResult.category).localeCompare(getCategoryLabel(b.evalResult.category)),
    elements:    (a, b) => a.evalResult.dsDEs.length - b.evalResult.dsDEs.length,
    // ISO-8601 strings compare correctly as plain strings, no Date parsing needed.
    lastUpdated: (a, b) => (a.dataset.lastUpdated || '').localeCompare(b.dataset.lastUpdated || ''),
  };
}

export default function DatasetsPanel({ datasets, groups, settings, mappings, refetchDEG }) {
  // useDataMutation's mutate() deliberately never rejects on failure — on
  // error it resolves into a permanently-pending promise and stores the
  // error in React state instead (see @dhis2/app-service-data's
  // useQueryExecutor). That's fine for a single fire-and-forget button, but
  // this loop needs a real per-dataset try/catch, so it talks to the
  // DataEngine directly — engine.mutate() rejects normally.
  const engine = useDataEngine();

  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');
  const [sortColumn, setSortColumn]   = useState(null);
  const [sortDirection, setSortDirection] = useState('default');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(25);
  const [selected, setSelected]       = useState(new Set());
  const [trackMap, setTrackMap]       = useState({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [progress, setProgress]       = useState({ done: 0, total: 0 });
  const [summary, setSummary]         = useState(null);
  const [previewing, setPreviewing]   = useState(false);

  // Evaluate every dataset once per render of groups/settings; reused for
  // search, category counts, the filter, and selection — one source of truth.
  const evaluated = useMemo(
    () => datasets.map((ds) => ({ dataset: ds, evalResult: evaluateDataset(ds, groups, settings, mappings) })),
    [datasets, groups, settings, mappings]
  );

  const searchedEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return evaluated;
    return evaluated.filter(
      ({ dataset }) =>
        dataset.name.toLowerCase().includes(q) ||
        (dataset.code || '').toLowerCase().includes(q) ||
        dataset.id.toLowerCase().includes(q)
    );
  }, [evaluated, search]);

  const counts = useMemo(() => {
    const c = { all: searchedEntries.length, unlinked: 0, needsUpdate: 0, consistent: 0, conflict: 0, unmappable: 0 };
    searchedEntries.forEach(({ evalResult }) => { c[evalResult.category]++; });
    return c;
  }, [searchedEntries]);

  const categoryFilters = useMemo(() => getCategoryFilters(), []);
  const filteredEntries = filter === 'all' ? searchedEntries : searchedEntries.filter((e) => e.evalResult.category === filter);

  const comparators = useMemo(() => makeComparators(settings), [settings]);
  const sortedEntries = useMemo(
    () => sortRows(filteredEntries, sortColumn, sortDirection, comparators),
    [filteredEntries, sortColumn, sortDirection, comparators]
  );
  const visibleDatasets = sortedEntries.map((e) => e.dataset);

  const pageCount = Math.max(1, Math.ceil(visibleDatasets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedDatasets = visibleDatasets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSortIconClick({ name, direction }) {
    setSortColumn(name);
    setSortDirection(direction);
    resetToFirstPage();
  }

  // ── Selection helpers (operate on the currently filtered/searched rows) ────

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(visibleDatasets.map((ds) => ds.id)));
  }

  // Only "unlinked" and "needsUpdate" can actually be fixed by a sync; a
  // "conflict" or "unmappable" row would just fail again, so it's excluded
  // from this bulk selection (the filter chips exist to find and fix those
  // by hand: adjust the name template, or assign a code, then retry).
  function selectNeedsSyncVisible() {
    const ids = searchedEntries
      .filter((e) => e.evalResult.category === 'unlinked' || e.evalResult.category === 'needsUpdate')
      .map((e) => e.dataset.id);
    setSelected(new Set(ids));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Processing ────────────────────────────────────────────────────────────

  async function processDataset(dataset, currentGroups) {
    const evalResult = evaluateDataset(dataset, currentGroups, settings, mappings);

    if (!evalResult.hasMappingKey) {
      const reason = settings.matchField === MATCH_FIELDS.MANUAL
        ? i18n.t('This dataset has no manual mapping yet. Link it to a group in the Mappings view.')
        : i18n.t('This dataset has no {{field}} to use as the mapping key.', {
            field: settings.matchField === 'code' ? i18n.t('code') : i18n.t('UID'),
          });
      throw new Error(reason);
    }
    if (evalResult.conflict) {
      throw new Error(
        i18n.t(
          'Cannot sync — another Data Element Group already uses this name or short name ("{{name}}", {{id}}). Adjust the name prefix/suffix in Settings, or resolve the conflict manually.',
          { name: evalResult.conflict.name, id: evalResult.conflict.id }
        )
      );
    }

    const dataElements = evalResult.dsDEs.map((de) => ({ id: de.id }));

    // Manual mode never auto-creates — a valid mapping implies evalResult.group
    // already exists (see evaluateDataset), so this branch is UID/code-only.
    if (!evalResult.group) {
      await engine.mutate(CREATE_DEG_MUTATION, {
        variables: {
          name: evalResult.expectedName,
          shortName: evalResult.expectedShortName,
          code: evalResult.code,
          dataElements,
          sharing: buildSharingPayload(settings, dataset),
        },
      });
      return 'created';
    }

    if (evalResult.isConsistent) return 'consistent';

    // syncShortName off: preserve whatever shortName the group already has
    // instead of overwriting a hand-tuned value on every run.
    const shortName = settings.syncShortName ? evalResult.expectedShortName : evalResult.group.shortName;

    // In manual mode evalResult.code is the group's own existing code
    // (evaluateDataset never derives one), so this is a no-op write for it —
    // manual-mode groups keep whatever code they already had.
    await engine.mutate(UPDATE_DEG_MUTATION, {
      variables: {
        id: evalResult.group.id,
        name: evalResult.expectedName,
        shortName,
        code: evalResult.code,
        dataElements,
      },
    });
    return 'updated';
  }

  async function runBulk(toProcess) {
    if (toProcess.length === 0) return;

    setBulkRunning(true);
    setProgress({ done: 0, total: toProcess.length });

    setTrackMap((prev) => {
      const next = { ...prev };
      toProcess.forEach((ds) => { next[ds.id] = { status: 'processing' }; });
      return next;
    });

    const currentGroups = [...groups];
    let created = 0, updated = 0, consistent = 0;
    const failures = [];

    // Everything from here down is wrapped in try/finally: a single dataset
    // failing is already handled per-iteration below, but this guards
    // against anything else going wrong (e.g. getErrorMessage itself
    // throwing on some unexpected error shape) — without it, an exception
    // here would leave bulkRunning stuck `true` forever with no way to
    // recover except reloading the page.
    try {
      for (let i = 0; i < toProcess.length; i++) {
        const dataset = toProcess[i];
        try {
          const result = await processDataset(dataset, currentGroups);
          setTrackMap((prev) => ({ ...prev, [dataset.id]: { status: result } }));
          if (result === 'created') created++;
          if (result === 'updated') updated++;
          if (result === 'consistent') consistent++;
        } catch (e) {
          let message;
          try {
            message = getErrorMessage(e);
          } catch (_) {
            message = i18n.t('Unknown error');
          }
          failures.push({ id: dataset.id, name: dataset.name, message });
          setTrackMap((prev) => ({ ...prev, [dataset.id]: { status: 'error', errorMsg: message } }));
        }
        setProgress({ done: i + 1, total: toProcess.length });
      }

      // Deliberately not awaited: useDataQuery's refetch() has the same
      // "never rejects" design as useDataMutation — on failure it doesn't
      // reject, it just never resolves at all (see useDataQuery's own code
      // comment: "This promise does not currently reject on errors"). Awaiting
      // it here would risk hanging this function forever, past the finally
      // block below, on nothing more than a flaky refetch. The table just
      // won't reflect this run's changes until the next natural refetch if
      // it fails; the summary below still reports exactly what happened to
      // each dataset during the run itself.
      refetchDEG().catch(() => {});
    } finally {
      setBulkRunning(false);
      setSummary({ created, updated, consistent, failures });
    }
  }

  function handleBulkProcess() {
    runBulk(datasets.filter((ds) => selected.has(ds.id)));
  }

  function retryFailed() {
    runBulk(datasets.filter((ds) => trackMap[ds.id]?.status === 'error'));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedCount   = selected.size;
  const failedCount     = Object.values(trackMap).filter((t) => t.status === 'error').length;
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const selectedEntries = evaluated.filter((e) => selected.has(e.dataset.id));

  return (
    <div>
      {bulkRunning && (
        <div style={{ margin: '0 0 1rem' }}>
          <p style={{ margin: '0 0 0.25rem' }}>
            {i18n.t('Processing {{done}} / {{total}} datasets…', { done: progress.done, total: progress.total })}
          </p>
          <LinearLoader amount={progressPercent} />
        </div>
      )}

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
            label={i18n.t('Filter datasets')}
            placeholder={i18n.t('Search by name, code or UID…')}
            value={search}
            disabled={bulkRunning}
            onChange={({ value }) => { setSearch(value || ''); resetToFirstPage(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <ButtonStrip>
            <Button small onClick={selectAllVisible} disabled={bulkRunning || visibleDatasets.length === 0}>
              {i18n.t('Select All ({{count}})', { count: visibleDatasets.length })}
            </Button>
            <Button small onClick={selectNeedsSyncVisible} disabled={bulkRunning}>
              {i18n.t('Select Needs Sync')}
            </Button>
            <Button small onClick={clearSelection} disabled={bulkRunning}>
              {i18n.t('Clear Selection')}
            </Button>
          </ButtonStrip>

          <Button small secondary disabled={selectedCount === 0 || bulkRunning} onClick={() => setPreviewing(true)}>
            {i18n.t('Preview ({{count}})', { count: selectedCount })}
          </Button>

          <Button primary disabled={selectedCount === 0 || bulkRunning} onClick={handleBulkProcess}>
            {bulkRunning
              ? i18n.t('Processing… ({{done}}/{{total}})', { done: progress.done, total: progress.total })
              : i18n.t('Bulk Create / Update ({{count}} selected)', { count: selectedCount })}
          </Button>

          {failedCount > 0 && !bulkRunning && (
            <Button destructive small onClick={retryFailed}>
              {i18n.t('Retry Failed ({{count}})', { count: failedCount })}
            </Button>
          )}
        </div>
      </div>

      <DatasetsTable
        datasets={pagedDatasets}
        groups={groups}
        settings={settings}
        mappings={mappings}
        selected={selected}
        toggleSelect={toggleSelect}
        trackMap={trackMap}
        bulkRunning={bulkRunning}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSortIconClick={handleSortIconClick}
      />

      {visibleDatasets.length === 0 && (
        <p style={{ color: colors.grey700, textAlign: 'center', marginTop: '1rem' }}>
          {i18n.t('No datasets match the current search/filter.')}
        </p>
      )}

      {visibleDatasets.length > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={visibleDatasets.length}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); resetToFirstPage(); }}
        />
      )}

      {summary && (
        <BulkSummaryModal
          summary={summary}
          onRetryFailed={retryFailed}
          onClose={() => setSummary(null)}
        />
      )}

      {previewing && (
        <PreviewModal
          entries={selectedEntries}
          onClose={() => setPreviewing(false)}
          onRunSync={() => {
            setPreviewing(false);
            handleBulkProcess();
          }}
        />
      )}
    </div>
  );
}
