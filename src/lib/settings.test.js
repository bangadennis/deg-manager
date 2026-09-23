import { mergeWithDefaults, isNotFoundError, DEFAULT_SETTINGS, MATCH_FIELDS, PUBLIC_ACCESS, SHARING_SOURCE } from './settings';

describe('mergeWithDefaults', () => {
  it('returns defaults when nothing was saved', () => {
    expect(mergeWithDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a saved top-level value and backfills the rest', () => {
    const result = mergeWithDefaults({ matchField: MATCH_FIELDS.CODE });
    expect(result.matchField).toBe(MATCH_FIELDS.CODE);
    expect(result.namePrefix).toBe(DEFAULT_SETTINGS.namePrefix);
    expect(result.defaultSharing).toEqual(DEFAULT_SETTINGS.defaultSharing);
  });

  it('backfills missing defaultSharing keys (source, userGroups) from an older saved shape', () => {
    const result = mergeWithDefaults({ defaultSharing: { enabled: true, publicAccess: PUBLIC_ACCESS.VIEW_EDIT } });
    expect(result.defaultSharing).toEqual({
      enabled: true,
      source: SHARING_SOURCE.DATASET,
      publicAccess: PUBLIC_ACCESS.VIEW_EDIT,
      userGroups: [],
    });
  });

  it('backfills source independently when other keys are already present', () => {
    const result = mergeWithDefaults({
      defaultSharing: { enabled: true, source: SHARING_SOURCE.CUSTOM, userGroups: [{ id: 'ug1', name: 'X', access: PUBLIC_ACCESS.VIEW }] },
    });
    expect(result.defaultSharing).toEqual({
      enabled: true,
      source: SHARING_SOURCE.CUSTOM,
      publicAccess: DEFAULT_SETTINGS.defaultSharing.publicAccess,
      userGroups: [{ id: 'ug1', name: 'X', access: PUBLIC_ACCESS.VIEW }],
    });
  });

  it('preserves a fully-populated saved value as-is', () => {
    const saved = {
      ...DEFAULT_SETTINGS,
      matchField: MATCH_FIELDS.CODE,
      defaultSharing: {
        enabled: true,
        source: SHARING_SOURCE.CUSTOM,
        publicAccess: PUBLIC_ACCESS.NONE,
        userGroups: [{ id: 'ug1', name: 'Data managers', access: PUBLIC_ACCESS.VIEW }],
      },
    };
    expect(mergeWithDefaults(saved)).toEqual(saved);
  });
});

describe('isNotFoundError', () => {
  it('is true for a 404 datastore error', () => {
    expect(isNotFoundError({ details: { httpStatusCode: 404 } })).toBe(true);
  });

  it('is false for other error codes', () => {
    expect(isNotFoundError({ details: { httpStatusCode: 403 } })).toBe(false);
  });

  it('is false when there is no error', () => {
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
