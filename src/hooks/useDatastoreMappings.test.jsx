import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { useDatastoreMappings } from './useDatastoreMappings';

function notFoundError() {
  const error = new Error('Not Found');
  error.details = { httpStatus: 'Not Found', httpStatusCode: 404 };
  return error;
}

function renderWithData(customData) {
  const wrapper = ({ children }) => <CustomDataProvider data={customData}>{children}</CustomDataProvider>;
  return renderHook(() => useDatastoreMappings(), { wrapper });
}

describe('useDatastoreMappings', () => {
  it('reads an existing stored list', async () => {
    const stored = [{ datasetId: 'ds1', groupId: 'g1' }];
    const { result } = renderWithData({ 'dataStore/deg-manager/mappings': stored });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mappings).toEqual(stored);
  });

  it('bootstraps an empty list into the datastore on a fresh install (404)', async () => {
    let created = null;
    const { result } = renderWithData({
      'dataStore/deg-manager/mappings': async (type, query) => {
        if (type === 'create') {
          created = query.data;
          return query.data;
        }
        throw notFoundError();
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mappings).toEqual([]);
    expect(created).toEqual([]);
  });

  it('falls back to an empty list, without crashing, on a non-404 read error', async () => {
    const { result } = renderWithData({
      'dataStore/deg-manager/mappings': () => {
        const error = new Error('Forbidden');
        error.details = { httpStatusCode: 403 };
        throw error;
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mappings).toEqual([]);
  });

  it('save() persists via update and reflects the new value', async () => {
    let updated = null;
    const { result } = renderWithData({
      'dataStore/deg-manager/mappings': async (type, query) => {
        if (type === 'replace') {
          updated = query.data;
          return query.data;
        }
        return [];
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const next = [{ datasetId: 'ds1', groupId: 'g1' }];
    await act(async () => {
      await result.current.save(next);
    });

    expect(updated).toEqual(next);
    await waitFor(() => expect(result.current.mappings).toEqual(next));
  });
});
