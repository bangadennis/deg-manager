import { useState, useEffect } from 'react';
import { useDataQuery, useDataEngine } from '@dhis2/app-runtime';
import {
  SETTINGS_QUERY,
  CREATE_SETTINGS_MUTATION,
  UPDATE_SETTINGS_MUTATION,
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  isNotFoundError,
} from '../lib/settings';

// Settings live in the DHIS2 datastore, shared instance-wide rather than
// per-browser. On a fresh install there's no key yet — the datastore
// returns a plain 404 for it — so this silently creates one seeded with
// DEFAULT_SETTINGS the first time the app runs, and every subsequent load
// just reads what's there.
export function useDatastoreSettings() {
  const { data, error, loading } = useDataQuery(SETTINGS_QUERY);
  // useDataMutation's mutate() never rejects on failure — it resolves into a
  // permanently-pending promise instead, relying on the hook's own React
  // state for error reporting. That silently broke the bootstrap fallback
  // and save() below (their .catch()/try-catch never fired, so a failure
  // left the app stuck on the loading spinner, or Settings stuck on
  // "Saving…", forever). engine.mutate() rejects normally.
  const engine = useDataEngine();

  const [settings, setSettings]         = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    if (loading || settings !== null) return;

    if (data?.settings) {
      setSettings(mergeWithDefaults(data.settings));
      return;
    }

    if (error && isNotFoundError(error)) {
      setBootstrapping(true);
      engine.mutate(CREATE_SETTINGS_MUTATION, { variables: DEFAULT_SETTINGS })
        .catch(() => {
          // Couldn't create the key (e.g. no write access) — still let the
          // app run with in-memory defaults. Save will fail loudly later
          // and explain why, rather than blocking the app up front.
        })
        .finally(() => {
          setSettings(DEFAULT_SETTINGS);
          setBootstrapping(false);
        });
      return;
    }

    if (error) {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [loading, data, error, settings, engine]);

  async function save(next) {
    await engine.mutate(UPDATE_SETTINGS_MUTATION, { variables: next });
    setSettings(next);
  }

  return {
    settings,
    loading: loading || bootstrapping || settings === null,
    save,
  };
}
