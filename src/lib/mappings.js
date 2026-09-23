import { SETTINGS_NAMESPACE } from './settings';

// Manual dataset↔group pairings, stored as a plain array of
// { datasetId, groupId } in the same datastore namespace as settings, under
// its own key. Only consulted when settings.matchField === 'manual'.
export const MAPPINGS_KEY = 'mappings';
const MAPPINGS_RESOURCE = `dataStore/${SETTINGS_NAMESPACE}/${MAPPINGS_KEY}`;

export const MAPPINGS_QUERY = {
  mappings: {
    resource: MAPPINGS_RESOURCE,
  },
};

// useDataMutation's variables get object-spread internally, which turns a
// bare array into a numeric-keyed object ({0: x, 1: y}) before it ever
// reaches `data`. Passing { mappings: [...] } as the mutate() variables
// keeps it a plain object through that layer; `data` unwraps it back to a
// real array for the actual HTTP body DHIS2's datastore expects.
export const CREATE_MAPPINGS_MUTATION = {
  resource: MAPPINGS_RESOURCE,
  type: 'create',
  data: ({ mappings }) => mappings,
};

export const UPDATE_MAPPINGS_MUTATION = {
  resource: MAPPINGS_RESOURCE,
  type: 'update',
  data: ({ mappings }) => mappings,
};
