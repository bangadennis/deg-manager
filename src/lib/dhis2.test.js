import {
  compareDataElements,
  buildGroupCode,
  buildGroupName,
  buildGroupShortName,
  buildSharingPayload,
  findGroupByCode,
  findMapping,
  findGroupByMapping,
  findNameConflict,
  evaluateDataset,
  findDatasetForGroup,
} from './dhis2';
import { DEFAULT_SETTINGS, MATCH_FIELDS, PUBLIC_ACCESS, SHARING_SOURCE } from './settings';

const de = (id, name = id) => ({ id, name });

describe('compareDataElements', () => {
  it('is consistent when both sides match exactly', () => {
    const result = compareDataElements([de('a'), de('b')], [de('b'), de('a')]);
    expect(result.isConsistent).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
  });

  it('reports data elements missing from the group', () => {
    const result = compareDataElements([de('a'), de('b')], [de('a')]);
    expect(result.isConsistent).toBe(false);
    expect(result.missing.map((d) => d.id)).toEqual(['b']);
  });

  it('reports data elements extra in the group', () => {
    const result = compareDataElements([de('a')], [de('a'), de('b')]);
    expect(result.isConsistent).toBe(false);
    expect(result.extra.map((d) => d.id)).toEqual(['b']);
  });
});

describe('buildGroupCode', () => {
  it('uses the dataset UID by default', () => {
    expect(buildGroupCode({ id: 'ds1', code: 'DS_CODE' }, DEFAULT_SETTINGS)).toBe('ds1');
  });

  it('uses the dataset code when configured', () => {
    const settings = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.CODE };
    expect(buildGroupCode({ id: 'ds1', code: 'DS_CODE' }, settings)).toBe('DS_CODE');
  });

  it('returns an empty string when the configured field is missing', () => {
    const settings = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.CODE };
    expect(buildGroupCode({ id: 'ds1' }, settings)).toBe('');
  });
});

describe('buildGroupName / buildGroupShortName', () => {
  it('applies prefix and suffix', () => {
    const settings = { ...DEFAULT_SETTINGS, namePrefix: 'DEG - ', nameSuffix: ' (auto)' };
    expect(buildGroupName({ name: 'Immunization' }, settings)).toBe('DEG - Immunization (auto)');
  });

  it('truncates the short name to 50 characters', () => {
    const settings = { ...DEFAULT_SETTINGS, namePrefix: 'x'.repeat(60) };
    expect(buildGroupShortName({ name: 'y' }, settings).length).toBe(50);
  });
});

describe('findGroupByCode', () => {
  it('matches on exact code', () => {
    const groups = [{ id: 'g1', code: 'ds1' }];
    expect(findGroupByCode(groups, 'ds1')).toBe(groups[0]);
  });

  it('returns undefined for an empty code', () => {
    const groups = [{ id: 'g1', code: 'ds1' }];
    expect(findGroupByCode(groups, '')).toBeUndefined();
  });
});

describe('findMapping / findGroupByMapping', () => {
  it('finds the mapping entry for a dataset', () => {
    const mappings = [{ datasetId: 'ds1', groupId: 'g1' }];
    expect(findMapping(mappings, 'ds1')).toBe(mappings[0]);
  });

  it('returns undefined when no mapping exists for the dataset', () => {
    expect(findMapping([{ datasetId: 'ds1', groupId: 'g1' }], 'ds2')).toBeUndefined();
  });

  it('resolves the mapped group', () => {
    const groups = [{ id: 'g1', name: 'G1' }];
    const mappings = [{ datasetId: 'ds1', groupId: 'g1' }];
    expect(findGroupByMapping(mappings, groups, 'ds1')).toBe(groups[0]);
  });

  it('returns undefined when the mapped group no longer exists', () => {
    const mappings = [{ datasetId: 'ds1', groupId: 'deleted-group' }];
    expect(findGroupByMapping(mappings, [], 'ds1')).toBeUndefined();
  });
});

describe('findNameConflict', () => {
  it('finds a different group using the same name', () => {
    const groups = [{ id: 'other', name: 'Mortality < 5 years', shortName: 'M<5' }];
    expect(findNameConflict('Mortality < 5 years', 'x', groups)).toBe(groups[0]);
  });

  it('finds a different group using the same short name', () => {
    const groups = [{ id: 'other', name: 'Y', shortName: 'M<5' }];
    expect(findNameConflict('x', 'M<5', groups)).toBe(groups[0]);
  });

  it('ignores the excluded group id (updating itself is not a conflict)', () => {
    const groups = [{ id: 'self', name: 'Mortality < 5 years', shortName: 'M<5' }];
    expect(findNameConflict('Mortality < 5 years', 'M<5', groups, 'self')).toBeUndefined();
  });
});

describe('evaluateDataset', () => {
  it('flags a dataset with no matching group as unlinked', () => {
    const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [] };
    const result = evaluateDataset(dataset, [], DEFAULT_SETTINGS);
    expect(result.group).toBeUndefined();
    expect(result.isConsistent).toBe(false);
    expect(result.hasMappingKey).toBe(true);
    expect(result.category).toBe('unlinked');
  });

  it('flags a missing mapping key when matchField is code and dataset has none', () => {
    const settings = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.CODE };
    const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [] };
    const result = evaluateDataset(dataset, [], settings);
    expect(result.hasMappingKey).toBe(false);
    expect(result.group).toBeUndefined();
    expect(result.category).toBe('unmappable');
  });

  it('is consistent when data elements and name both match', () => {
    const dataset = {
      id: 'ds1',
      name: 'DS1',
      dataSetElements: [{ dataElement: de('e1') }],
    };
    const groups = [{ id: 'g1', code: 'ds1', name: 'DS1', dataElements: [de('e1')] }];
    const result = evaluateDataset(dataset, groups, DEFAULT_SETTINGS);
    expect(result.isConsistent).toBe(true);
    expect(result.nameMismatch).toBe(false);
    expect(result.category).toBe('consistent');
  });

  it('flags a name mismatch even when data elements match', () => {
    const dataset = {
      id: 'ds1',
      name: 'DS1',
      dataSetElements: [{ dataElement: de('e1') }],
    };
    const groups = [{ id: 'g1', code: 'ds1', name: 'Old Name', dataElements: [de('e1')] }];
    const result = evaluateDataset(dataset, groups, DEFAULT_SETTINGS);
    expect(result.nameMismatch).toBe(true);
    expect(result.isConsistent).toBe(false);
    expect(result.category).toBe('needsUpdate');
  });

  it('flags a name conflict with an unrelated pre-existing group ahead of unlinked', () => {
    // Reproduces the real 409 case: a dataset with no linked group yet, whose
    // target name collides with a totally different, pre-existing group.
    const dataset = { id: 'ds1', name: 'Mortality < 5 years', dataSetElements: [] };
    const groups = [{ id: 'rPGfUFYbcfJ', code: 'unrelated', name: 'Mortality < 5 years', dataElements: [] }];
    const result = evaluateDataset(dataset, groups, DEFAULT_SETTINGS);
    expect(result.category).toBe('conflict');
    expect(result.conflict.id).toBe('rPGfUFYbcfJ');
  });

  it('does not flag a conflict against the dataset\'s own already-linked group', () => {
    const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [] };
    const groups = [{ id: 'g1', code: 'ds1', name: 'DS1', shortName: 'DS1', dataElements: [] }];
    const result = evaluateDataset(dataset, groups, DEFAULT_SETTINGS);
    expect(result.conflict).toBeUndefined();
    expect(result.category).toBe('consistent');
  });

  describe('manual matchField', () => {
    const manualSettings = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.MANUAL };

    it('is unmappable (not unlinked) when no mapping exists — must never auto-create', () => {
      const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [] };
      const result = evaluateDataset(dataset, [], manualSettings, []);
      expect(result.hasMappingKey).toBe(false);
      expect(result.group).toBeUndefined();
      expect(result.category).toBe('unmappable');
    });

    it('is unmappable when the mapping points at a group that no longer exists', () => {
      const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [] };
      const mappings = [{ datasetId: 'ds1', groupId: 'deleted-group' }];
      const result = evaluateDataset(dataset, [], manualSettings, mappings);
      expect(result.hasMappingKey).toBe(false);
      expect(result.category).toBe('unmappable');
    });

    it('resolves the mapped group and evaluates consistency normally', () => {
      const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [{ dataElement: de('e1') }] };
      const groups = [{ id: 'g1', code: 'LEGACY_CODE', name: 'DS1', dataElements: [de('e1')] }];
      const mappings = [{ datasetId: 'ds1', groupId: 'g1' }];
      const result = evaluateDataset(dataset, groups, manualSettings, mappings);
      expect(result.group).toBe(groups[0]);
      expect(result.isConsistent).toBe(true);
      expect(result.category).toBe('consistent');
      // The group's own pre-existing code must be preserved, not overwritten
      // with the dataset's UID/code the way UID/Code mode would.
      expect(result.code).toBe('LEGACY_CODE');
    });

    it('flags needsUpdate when the mapped group\'s data elements have drifted', () => {
      const dataset = { id: 'ds1', name: 'DS1', dataSetElements: [{ dataElement: de('e1') }, { dataElement: de('e2') }] };
      const groups = [{ id: 'g1', code: 'LEGACY_CODE', name: 'DS1', dataElements: [de('e1')] }];
      const mappings = [{ datasetId: 'ds1', groupId: 'g1' }];
      const result = evaluateDataset(dataset, groups, manualSettings, mappings);
      expect(result.category).toBe('needsUpdate');
      expect(result.missing.map((d) => d.id)).toEqual(['e2']);
    });
  });
});

describe('findDatasetForGroup', () => {
  it('finds the dataset whose mapping key matches the group code', () => {
    const datasets = [{ id: 'ds1', name: 'DS1' }, { id: 'ds2', name: 'DS2' }];
    const group = { id: 'g1', code: 'ds2' };
    expect(findDatasetForGroup(datasets, group, DEFAULT_SETTINGS)).toBe(datasets[1]);
  });

  it('returns undefined when no dataset matches', () => {
    const datasets = [{ id: 'ds1', name: 'DS1' }];
    const group = { id: 'g1', code: 'unrelated' };
    expect(findDatasetForGroup(datasets, group, DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('in manual mode, uses the mappings array instead of the group code', () => {
    const manualSettings = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.MANUAL };
    const datasets = [{ id: 'ds1', name: 'DS1' }];
    const group = { id: 'g1', code: 'unrelated-legacy-code' };
    const mappings = [{ datasetId: 'ds1', groupId: 'g1' }];
    expect(findDatasetForGroup(datasets, group, manualSettings, mappings)).toBe(datasets[0]);
    expect(findDatasetForGroup(datasets, group, manualSettings, [])).toBeUndefined();
  });
});

describe('buildSharingPayload', () => {
  it('returns undefined when default sharing is disabled', () => {
    expect(buildSharingPayload(DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('builds a public-only sharing object when only public access is set', () => {
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { enabled: true, publicAccess: PUBLIC_ACCESS.VIEW, userGroups: [] } };
    expect(buildSharingPayload(settings)).toEqual({
      public: PUBLIC_ACCESS.VIEW,
      external: false,
      users: {},
      userGroups: {},
    });
  });

  it('combines public access with specific user groups', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      defaultSharing: {
        enabled: true,
        publicAccess: PUBLIC_ACCESS.NONE,
        userGroups: [{ id: 'ug1', name: 'Data managers', access: PUBLIC_ACCESS.VIEW_EDIT }],
      },
    };
    expect(buildSharingPayload(settings)).toEqual({
      public: PUBLIC_ACCESS.NONE,
      external: false,
      users: {},
      userGroups: { ug1: { id: 'ug1', access: PUBLIC_ACCESS.VIEW_EDIT } },
    });
  });

  it('source "dataset" copies the source dataset\'s own metadata-only sharing', () => {
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, enabled: true, source: SHARING_SOURCE.DATASET } };
    const dataset = {
      id: 'ds1',
      sharing: {
        public: PUBLIC_ACCESS.NONE,
        external: false,
        userGroups: { ug1: { id: 'ug1', access: PUBLIC_ACCESS.VIEW_EDIT } },
        users: {},
      },
    };
    expect(buildSharingPayload(settings, dataset)).toEqual({
      public: PUBLIC_ACCESS.NONE,
      external: false,
      users: {},
      userGroups: { ug1: { id: 'ug1', access: PUBLIC_ACCESS.VIEW_EDIT } },
    });
  });

  it('source "dataset" strips data-access bits, which dataElementGroup rejects (real 409: E3011)', () => {
    // Datasets can carry *data* sharing (they gate data entry) as well as
    // metadata sharing — dataElementGroup only supports metadata sharing, so
    // copying a data-enabled access string verbatim gets rejected by the API.
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, enabled: true, source: SHARING_SOURCE.DATASET } };
    const dataset = {
      id: 'ds1',
      sharing: {
        public: 'rwrw----', // metadata rw + data rw
        external: false,
        userGroups: { ug1: { id: 'ug1', access: 'r-rw----' } }, // metadata read, data rw
        users: { u1: { id: 'u1', access: 'rwr-----' } }, // metadata rw, data read
      },
    };
    expect(buildSharingPayload(settings, dataset)).toEqual({
      public: 'rw------',
      external: false,
      userGroups: { ug1: { id: 'ug1', access: 'r-------' } },
      users: { u1: { id: 'u1', access: 'rw------' } },
    });
  });

  it('source "dataset" returns undefined when the dataset has no sharing loaded', () => {
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, enabled: true, source: SHARING_SOURCE.DATASET } };
    const dataset = { id: 'ds1' };
    expect(buildSharingPayload(settings, dataset)).toBeUndefined();
  });

  it('source "dataset" returns undefined when the dataset\'s sharing is present but empty', () => {
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, enabled: true, source: SHARING_SOURCE.DATASET } };
    const dataset = { id: 'ds1', sharing: { public: undefined, external: undefined, userGroups: {}, users: {} } };
    expect(buildSharingPayload(settings, dataset)).toBeUndefined();
  });

  it('source "dataset" returns undefined, not a throw, when dataset is omitted', () => {
    const settings = { ...DEFAULT_SETTINGS, defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, enabled: true, source: SHARING_SOURCE.DATASET } };
    expect(() => buildSharingPayload(settings)).not.toThrow();
    expect(buildSharingPayload(settings)).toBeUndefined();
  });
});
