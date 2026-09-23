import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { useDatastoreSettings } from './useDatastoreSettings';
import { DEFAULT_SETTINGS, MATCH_FIELDS } from '../lib/settings';

function notFoundError() {
  const error = new Error('Not Found');
  error.details = { httpStatus: 'Not Found', httpStatusCode: 404 };
  return error;
}

function renderWithData(customData) {
  const wrapper = ({ children }) => <CustomDataProvider data={customData}>{children}</CustomDataProvider>;
  return renderHook(() => useDatastoreSettings(), { wrapper });
}

describe('useDatastoreSettings', () => {
  it('reads and merges an existing stored value', async () => {
    const stored = { matchField: MATCH_FIELDS.CODE };
    const { result } = renderWithData({ 'dataStore/deg-manager/settings': stored });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings.matchField).toBe(MATCH_FIELDS.CODE);
    // Backfilled from defaults since the stored value didn't have it.
    expect(result.current.settings.defaultSharing).toEqual(DEFAULT_SETTINGS.defaultSharing);
  });

  it('bootstraps defaults into the datastore on a fresh install (404)', async () => {
    let created = null;
    const { result } = renderWithData({
      'dataStore/deg-manager/settings': async (type, query) => {
        if (type === 'create') {
          created = query.data;
          return query.data;
        }
        throw notFoundError();
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(created).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to in-memory defaults, without crashing, on a non-404 read error', async () => {
    const { result } = renderWithData({
      'dataStore/deg-manager/settings': () => {
        const error = new Error('Forbidden');
        error.details = { httpStatusCode: 403 };
        throw error;
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('save() persists via update and reflects the new value', async () => {
    let updated = null;
    const { result } = renderWithData({
      'dataStore/deg-manager/settings': async (type, query) => {
        // A non-partial `type: 'update'` mutation resolves to fetch type
        // 'replace' (a full PUT) — see getMutationFetchType in data-engine.
        if (type === 'replace') {
          updated = query.data;
          return query.data;
        }
        return DEFAULT_SETTINGS;
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const next = { ...DEFAULT_SETTINGS, matchField: MATCH_FIELDS.CODE };
    await act(async () => {
      await result.current.save(next);
    });

    expect(updated).toEqual(next);
    await waitFor(() => expect(result.current.settings).toEqual(next));
  });
});
