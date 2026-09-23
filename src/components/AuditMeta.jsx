import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { colors } from '@dhis2/ui';
import { formatDate } from '../lib/dhis2';

// createdBy/lastUpdatedBy can come back null from the API (e.g. objects
// created by an import job with no user context), so this always falls back
// to a plain label rather than rendering "by" with nothing after it.
export default function AuditMeta({ created, createdBy, lastUpdated, lastUpdatedBy }) {
  return (
    <p style={{ color: colors.grey700, fontSize: '0.85rem', marginTop: 0 }}>
      {i18n.t('Created {{date}} by {{user}}', {
        date: formatDate(created, { withTime: true }),
        user: createdBy?.name || i18n.t('Unknown user'),
      })}
      <br />
      {i18n.t('Last updated {{date}} by {{user}}', {
        date: formatDate(lastUpdated, { withTime: true }),
        user: lastUpdatedBy?.name || i18n.t('Unknown user'),
      })}
    </p>
  );
}
