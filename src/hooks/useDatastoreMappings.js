import { useState, useEffect } from 'react';
import { useDataQuery, useDataEngine } from '@dhis2/app-runtime';
import { MAPPINGS_QUERY, CREATE_MAPPINGS_MUTATION, UPDATE_MAPPINGS_MUTATION } from '../lib/mappings';
import { isNotFoundError } from '../lib/settings';

// Same shape of hook as useDatastoreSettings: read the datastore key, and on
// a fresh install (404) silently create it seeded with an empty list.
//
// Uses useDataEngine()/engine.mutate() rather than useDataMutation() — the
// latter's mutate() never rejects on failure (it resolves into a
// permanently-pending promise instead), which would silently break both the
// bootstrap fallback and save() below.
export function useDatastoreMappings() {
  const { data, error, loading } = useDataQuery(MAPPINGS_QUERY);
  const engine = useDataEngine();

  const [mappings, setMappings]         = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    if (loading || mappings !== null) return;

    if (Array.isArray(data?.mappings)) {
      setMappings(data.mappings);
      return;
    }

    if (error && isNotFoundError(error)) {
      setBootstrapping(true);
      engine.mutate(CREATE_MAPPINGS_MUTATION, { variables: { mappings: [] } })
        .catch(() => {
          // No write access — still let the app run; saving a mapping will
          // fail loudly later and explain why.
        })
        .finally(() => {
          setMappings([]);
          setBootstrapping(false);
        });
      return;
    }

    if (error) {
      setMappings([]);
    }
  }, [loading, data, error, mappings, engine]);

  async function save(next) {
    await engine.mutate(UPDATE_MAPPINGS_MUTATION, { variables: { mappings: next } });
    setMappings(next);
  }

  return {
    mappings,
    loading: loading || bootstrapping || mappings === null,
    save,
  };
}
