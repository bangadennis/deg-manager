import React from 'react';
import { Tag } from '@dhis2/ui';
import { getStatusConfig } from '../lib/dhis2';

export default function StatusTag({ status, errorMsg }) {
  const cfg = getStatusConfig(status);
  return (
    <span title={errorMsg || ''}>
      <Tag
        positive={cfg.color === 'positive'}
        negative={cfg.color === 'negative'}
        neutral={cfg.color === 'neutral'}
      >
        {cfg.label}
      </Tag>
    </span>
  );
}
