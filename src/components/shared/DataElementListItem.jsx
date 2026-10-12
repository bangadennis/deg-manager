import React from 'react';
import { colors } from '@dhis2/ui';
import { IconAddCircle16, IconSubtractCircle16 } from '@dhis2/ui-icons';

// Diff-style convention: green/add-circle for a data element a sync would
// ADD (present in the dataset, not yet in the group — "missing"), orange/
// subtract-circle for one a sync would REMOVE ("extra" — in the group, not
// in the dataset). Reads as "what will change", not "what's currently
// broken" — a plain color alone doesn't carry that distinction as clearly.
const STATUS_STYLE = {
  missing: { color: colors.green600, Icon: IconAddCircle16 },
  extra:   { color: colors.yellow800, Icon: IconSubtractCircle16 },
};

export default function DataElementListItem({ name, status, suffix }) {
  const style = STATUS_STYLE[status];
  if (!style) return <li>{name}</li>;

  const { color, Icon } = style;
  return (
    <li style={{ color, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <Icon aria-hidden="true" />
      <span>{name}{suffix ? ` ${suffix}` : ''}</span>
    </li>
  );
}
