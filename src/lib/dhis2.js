import i18n from '@dhis2/d2-i18n';
import { PUBLIC_ACCESS, SHARING_SOURCE, MATCH_FIELDS } from './settings';

// ─── Queries ────────────────────────────────────────────────────────────────

export const DATASETS_QUERY = {
  dataSets: {
    resource: 'dataSets',
    params: {
      fields: 'id,name,shortName,code,dataSetElements[dataElement[id,name]],sharing[public,external,userGroups,users]',
      paging: false,
    },
  },
};

export const DEG_QUERY = {
  dataElementGroups: {
    resource: 'dataElementGroups',
    params: {
      fields: 'id,name,shortName,code,dataElements[id,name]',
      paging: false,
    },
  },
};

export const ME_QUERY = {
  me: {
    resource: 'me',
    params: {
      fields: 'username,authorities',
    },
  },
};

export const USER_GROUPS_QUERY = {
  userGroups: {
    resource: 'userGroups',
    params: {
      fields: 'id,name',
      paging: false,
    },
  },
};

// ─── Mutations ───────────────────────────────────────────────────────────────

export const CREATE_DEG_MUTATION = {
  resource: 'dataElementGroups',
  type: 'create',
  data: ({ name, shortName, code, dataElements, sharing }) => ({
    name,
    shortName,
    code,
    dataElements,
    ...(sharing ? { sharing } : {}),
  }),
};

export const UPDATE_DEG_MUTATION = {
  resource: 'dataElementGroups',
  id: ({ id }) => id,
  type: 'update',
  data: ({ name, shortName, code, dataElements }) => ({ name, shortName, code, dataElements }),
};

export const DELETE_DEG_MUTATION = {
  resource: 'dataElementGroups',
  id: ({ id }) => id,
  type: 'delete',
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function getDatasetDEs(dataset) {
  return (dataset.dataSetElements || []).map((dse) => dse.dataElement);
}

export function compareDataElements(datasetDEs, groupDEs) {
  const datasetIds = new Set(datasetDEs.map((de) => de.id));
  const groupIds   = new Set(groupDEs.map((de) => de.id));
  const missing    = datasetDEs.filter((de) => !groupIds.has(de.id));
  const extra      = groupDEs.filter((de) => !datasetIds.has(de.id));
  return {
    missing,
    extra,
    isConsistent: missing.length === 0 && extra.length === 0,
  };
}

export function buildGroupCode(dataset, settings) {
  return dataset[settings.matchField] || '';
}

export function buildGroupName(dataset, settings) {
  return `${settings.namePrefix || ''}${dataset.name}${settings.nameSuffix || ''}`;
}

// dataElementGroup.shortName is required by the DHIS2 metadata schema and
// capped at 50 characters, so it can't just reuse the (longer, templated) name.
export function buildGroupShortName(dataset, settings) {
  const base = `${settings.namePrefix || ''}${dataset.shortName || dataset.name}${settings.nameSuffix || ''}`;
  return base.slice(0, 50);
}

// DHIS2 access strings are 8 chars: metadata read/write (positions 0-1),
// then data read/write (2-3), then 4 reserved positions — all normally '-'.
// dataElementGroup only supports metadata sharing, so copying a dataset's
// sharing (which CAN carry data-access bits, since datasets gate data entry
// too) verbatim gets rejected by the API with E3011 ("Data sharing is not
// enabled for type ... but access strings contain data sharing read or
// write"). Truncating to the metadata pair and padding the rest with '-'
// is what actually fixes that, not just working around the symptom.
function toMetadataOnlyAccess(access) {
  return `${(access || '--------').slice(0, 2).padEnd(2, '-')}------`;
}

function stripDataAccess(accessMap) {
  if (!accessMap) return {};
  return Object.fromEntries(
    Object.entries(accessMap).map(([id, entry]) => [id, { ...entry, access: toMetadataOnlyAccess(entry.access) }])
  );
}

// Builds the DHIS2 metadata "sharing" object from the default-sharing
// setting, or undefined when nothing is configured (server default applies).
// publicAccess and userGroups are independent — either, both, or neither can
// be set.
// dataset is only consulted when source is 'dataset'; omit it for 'custom'.
export function buildSharingPayload(settings, dataset) {
  const { enabled, source, publicAccess, userGroups } = settings.defaultSharing;
  if (!enabled) return undefined;

  if (source === SHARING_SOURCE.DATASET) {
    const s = dataset?.sharing;
    // {} is truthy in JS, so an empty userGroups/users map needs an
    // explicit key-count check — a bare !s.userGroups would miss it.
    const isEmptyMap = (m) => !m || Object.keys(m).length === 0;
    if (!s || (!s.public && !s.external && isEmptyMap(s.userGroups) && isEmptyMap(s.users))) return undefined;
    return {
      public: toMetadataOnlyAccess(s.public),
      external: !!s.external,
      users: stripDataAccess(s.users),
      userGroups: stripDataAccess(s.userGroups),
    };
  }

  // 'custom' — also the fallback for any settings doc saved before this
  // feature existed (no source key), preserving pre-feature behavior.
  return {
    public: publicAccess || PUBLIC_ACCESS.NONE,
    external: false,
    users: {},
    userGroups: Object.fromEntries((userGroups || []).map((ug) => [ug.id, { id: ug.id, access: ug.access }])),
  };
}

export function findGroupByCode(groups, code) {
  if (!code) return undefined;
  return groups.find((g) => g.code === code);
}

// Manual mode: linkage comes from an explicit { datasetId, groupId } pair
// rather than a value read off the dataset/written to the group's code.
export function findMapping(mappings, datasetId) {
  return (mappings || []).find((m) => m.datasetId === datasetId);
}

export function findGroupByMapping(mappings, groups, datasetId) {
  const mapping = findMapping(mappings, datasetId);
  return mapping ? groups.find((g) => g.id === mapping.groupId) : undefined;
}

// DHIS2 requires name and shortName to be globally unique across
// dataElementGroups. A group we're about to write can collide with some
// *other*, unrelated group (e.g. one created outside this tool) — that's the
// "already exists on object X" 409 the API throws. excludeGroupId lets an
// update check against everyone except itself.
export function findNameConflict(name, shortName, groups, excludeGroupId) {
  return groups.find(
    (g) => g.id !== excludeGroupId && (g.name === name || g.shortName === shortName)
  );
}

// Single source of truth for "how does this dataset relate to its group,
// under the current settings" — used by the table, the detail modal, the
// selection helpers and the bulk processor alike, so they can't drift apart.
//
// category is one of:
//   'unmappable' — dataset has no value for the configured mapping field
//                  (or, in manual mode, no pairing exists / its target group
//                  was deleted — either way there's nothing to sync from)
//   'conflict'   — the target name/shortName is already used by a *different* group
//   'unlinked'   — no group exists yet for this dataset
//   'needsUpdate'— group exists but data elements and/or name have drifted
//   'consistent' — group exists and matches exactly
//
// mappings is only consulted when settings.matchField is 'manual'.
export function evaluateDataset(dataset, groups, settings, mappings = []) {
  const dsDEs = getDatasetDEs(dataset);
  const isManual = settings.matchField === MATCH_FIELDS.MANUAL;

  let code, hasMappingKey, group;
  if (isManual) {
    group = findGroupByMapping(mappings, groups, dataset.id);
    // A pairing whose target group was deleted counts as no mapping at all
    // — it needs fixing in the Mappings view, not an auto-create attempt.
    hasMappingKey = !!group;
    code = group ? group.code : '';
  } else {
    code = buildGroupCode(dataset, settings);
    hasMappingKey = !!code;
    group = hasMappingKey ? findGroupByCode(groups, code) : undefined;
  }
  const groupDEs = group ? group.dataElements : [];

  const { missing, extra, isConsistent: deConsistent } = compareDataElements(dsDEs, groupDEs);
  const expectedName      = buildGroupName(dataset, settings);
  const expectedShortName = buildGroupShortName(dataset, settings);
  const nameMismatch = !!group && group.name !== expectedName;

  const conflict = hasMappingKey
    ? findNameConflict(expectedName, expectedShortName, groups, group?.id)
    : undefined;

  const isConsistent = !!group && deConsistent && !nameMismatch;

  let category;
  if (!hasMappingKey) category = 'unmappable';
  else if (conflict) category = 'conflict';
  else if (!group) category = 'unlinked';
  else if (isConsistent) category = 'consistent';
  else category = 'needsUpdate';

  return {
    dsDEs,
    group,
    groupDEs,
    missing,
    extra,
    hasMappingKey,
    code,
    nameMismatch,
    conflict,
    isConsistent,
    category,
    expectedName,
    expectedShortName,
  };
}

// Functions rather than static objects: i18n.t() must be called after the
// active locale is known, and re-evaluated if it ever changes — a
// module-level constant would freeze every label in whatever language was
// active the moment this file was first imported.
export function getCategoryLabel(category) {
  const labels = {
    unmappable:  i18n.t('Unmappable'),
    conflict:    i18n.t('Name conflict'),
    unlinked:    i18n.t('Unlinked'),
    needsUpdate: i18n.t('Needs update'),
    consistent:  i18n.t('Consistent'),
  };
  return labels[category] || category;
}

// Shared filter-chip definitions for both the Datasets and Data Element
// Groups tabs, so "All / Unlinked / Needs update / ..." stays identical
// wherever a category filter is offered.
export function getCategoryFilters() {
  return [
    { key: 'all',         label: i18n.t('All') },
    { key: 'unlinked',    label: getCategoryLabel('unlinked') },
    { key: 'needsUpdate', label: getCategoryLabel('needsUpdate') },
    { key: 'consistent',  label: getCategoryLabel('consistent') },
    { key: 'conflict',    label: getCategoryLabel('conflict') },
    { key: 'unmappable',  label: getCategoryLabel('unmappable') },
  ];
}

// Reverse lookup used by the Groups tab: which dataset (if any) does this
// group correspond to, under the current settings.
export function findDatasetForGroup(datasets, group, settings, mappings = []) {
  if (settings.matchField === MATCH_FIELDS.MANUAL) {
    const mapping = mappings.find((m) => m.groupId === group.id);
    return mapping ? datasets.find((ds) => ds.id === mapping.datasetId) : undefined;
  }
  return datasets.find((ds) => ds[settings.matchField] === group.code);
}

export function getStatusConfig(status) {
  const config = {
    pending:     { label: i18n.t('Pending'),        color: 'default'  },
    processing:  { label: i18n.t('Processing…'),    color: 'default'  },
    created:     { label: i18n.t('Created ✓'),      color: 'positive' },
    updated:     { label: i18n.t('Updated ✓'),      color: 'positive' },
    consistent:  { label: i18n.t('Up to date ✓'),   color: 'positive' },
    error:       { label: i18n.t('Error ✗'),        color: 'negative' },
    skipped:     { label: i18n.t('Skipped'),        color: 'neutral'  },
  };
  return config[status] || config.pending;
}
