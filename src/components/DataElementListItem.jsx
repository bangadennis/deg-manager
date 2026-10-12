import React from 'react';
import { colors } from '@dhis2/ui';
import { IconAddCircle16, IconSubtractCircle16 } from '@dhis2/ui-icons';

// Diff-style convention: green/add-circle for a data element a sync would
// ADD (present in the dataset, not yet in the group — "missing"), orange/
// subtract-circle for one a sync would REMOVE ("extra" — in the group, not
// in the dataset). Reads as "what will change", not "what's currently
// broken" — a plain color alone doesn't carry that distinction as clearly.
export default function DataElementListItem({ name, status, suffix }) {
  if (status === 'missing') {
    return (
      <li style={{ color: colors.green600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <IconAddCircle16 aria-hidden="true" />
        <span>{name}{suffix ? ` ${suffix}` : ''}</span>
      </li>
    );
  }

  if (status === 'extra') {
    return (
      <li style={{ color: colors.yellow800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <IconSubtractCircle16 aria-hidden="true" />
        <span>{name}{suffix ? ` ${suffix}` : ''}</span>
      </li>
    );
  }

  return <li>{name}</li>;
}
