export const MATCH_FIELDS = {
  UID:    'id',
  CODE:   'code',
  // Linkage comes from an explicit dataset↔group pairing (see lib/mappings.js
  // and the Mappings view) instead of a value written into the group's Code
  // field. No automatic create happens in this mode — a dataset with no
  // pairing just shows as unmappable until linked by hand.
  MANUAL: 'manual',
};

// The standard DHIS2 metadata-only sharing access strings (first two
// characters are read/write on metadata; the rest are irrelevant for an
// object like dataElementGroup that carries no data of its own).
export const PUBLIC_ACCESS = {
  NONE:      '--------',
  VIEW:      'r-------',
  VIEW_EDIT: 'rw------',
};

// Where default sharing comes from: copy the source dataset's own sharing
// verbatim, or use the manually-configured publicAccess/userGroups below.
export const SHARING_SOURCE = {
  DATASET: 'dataset',
  CUSTOM:  'custom',
};

export const DEFAULT_SETTINGS = {
  matchField: MATCH_FIELDS.UID,
  namePrefix: '',
  nameSuffix: '',
  // Whether a sync also overwrites an existing group's shortName to match
  // the naming template. Off lets an admin hand-tune shortNames (e.g. a
  // different abbreviation convention) without this tool clobbering them
  // on every run. Always applied on first creation regardless, since a
  // brand-new group has no shortName worth preserving.
  syncShortName: true,
  // Sharing applied to newly created groups only; sharing on groups that
  // already exist is left alone (use the Sharing action to change it).
  // publicAccess and userGroups are only used when source is 'custom', but
  // stay populated even under 'dataset' so switching source back doesn't
  // lose prior picks. publicAccess and userGroups are independent and
  // combinable: e.g. "no public access, but these two user groups can edit"
  // is a normal Custom setup.
  defaultSharing: {
    enabled: false,
    source: SHARING_SOURCE.DATASET,
    publicAccess: PUBLIC_ACCESS.VIEW,
    userGroups: [], // [{ id, name, access }]
  },
};

// Settings live in the DHIS2 datastore (shared across every user of the
// app, unlike localStorage) so the mapping/naming/sharing conventions are
// consistent instance-wide rather than per-browser.
export const SETTINGS_NAMESPACE = 'deg-manager';
export const SETTINGS_KEY = 'settings';
const SETTINGS_RESOURCE = `dataStore/${SETTINGS_NAMESPACE}/${SETTINGS_KEY}`;

export const SETTINGS_QUERY = {
  settings: {
    resource: SETTINGS_RESOURCE,
  },
};

export const CREATE_SETTINGS_MUTATION = {
  resource: SETTINGS_RESOURCE,
  type: 'create',
  data: (settings) => settings,
};

export const UPDATE_SETTINGS_MUTATION = {
  resource: SETTINGS_RESOURCE,
  type: 'update',
  data: (settings) => settings,
};

// Fills in any keys missing from a stored value with current defaults, so
// a settings shape saved by an older version of the app (e.g. before
// defaultSharing.userGroups existed) doesn't break on load.
export function mergeWithDefaults(saved) {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    defaultSharing: { ...DEFAULT_SETTINGS.defaultSharing, ...(saved?.defaultSharing || {}) },
  };
}

// A failed datastore read for a namespace/key that doesn't exist yet comes
// back as a plain 404, not one of app-runtime's "access" error types — this
// is how the app tells "not installed yet" apart from a real fetch error.
export function isNotFoundError(error) {
  return error?.details?.httpStatusCode === 404;
}
