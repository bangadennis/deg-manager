import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Tag, colors } from '@dhis2/ui';
import { evaluateDataset } from '../lib/dhis2';
import { MATCH_FIELDS } from '../lib/settings';
import DetailsPanel from './DetailsPanel';
import AuditMeta from './AuditMeta';

export default function DatasetDetailModal({ dataset, groups, settings, mappings, onClose }) {
  const { group, dsDEs, groupDEs, missing, extra, isConsistent, nameMismatch, hasMappingKey, conflict, expectedName: targetName } =
    evaluateDataset(dataset, groups, settings, mappings);

  const isManual = settings.matchField === MATCH_FIELDS.MANUAL;
  const missingIds = new Set(missing.map((de) => de.id));
  const extraIds   = new Set(extra.map((de) => de.id));

  const subtitle = isManual
    ? i18n.t('Mapping — {{value}}', { value: hasMappingKey ? group.name : i18n.t('none — link in the Mappings view') })
    : i18n.t('Mapping key ({{field}}) — {{value}}', {
        field: settings.matchField === 'code' ? i18n.t('dataset code') : i18n.t('dataset UID'),
        value: hasMappingKey ? dataset[settings.matchField] : i18n.t('none'),
      });

  return (
    <DetailsPanel title={dataset.name} subtitle={subtitle} onClose={onClose}>
      <AuditMeta
        created={dataset.created}
        createdBy={dataset.createdBy}
        lastUpdated={dataset.lastUpdated}
        lastUpdatedBy={dataset.lastUpdatedBy}
      />
      {!hasMappingKey && (
        <p style={{ color: colors.red060 }}>
          {isManual
            ? i18n.t('This dataset has no manual mapping yet. Open the Mappings view to link it to an existing group.')
            : i18n.t('Switch the mapping key in Settings, or assign this dataset a code, before syncing it.')}
        </p>
      )}
      {conflict && (
        <p style={{ color: colors.red060 }}>
          {i18n.t('Cannot sync — the name/short name "{{targetName}}" is already used by a different group, {{conflictName}} ({{conflictId}}). Adjust the name prefix/suffix in Settings, or resolve the conflict manually.', {
            targetName,
            conflictName: conflict.name,
            conflictId: conflict.id,
          })}
        </p>
      )}

      <h4 style={{ marginBottom: '0.25rem' }}>{i18n.t('Dataset data elements ({{count}})', { count: dsDEs.length })}</h4>
      {dsDEs.length === 0 ? (
        <p style={{ color: colors.grey700 }}>{i18n.t('This dataset has no data elements.')}</p>
      ) : (
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {dsDEs.map((de) => (
            <li key={de.id} style={{ color: missingIds.has(de.id) ? colors.red060 : undefined }}>
              {de.name}
              {missingIds.has(de.id) && ` ${i18n.t('(missing from group)')}`}
            </li>
          ))}
        </ul>
      )}

      <h4 style={{ marginBottom: '0.25rem', marginTop: '1.5rem' }}>
        {group
          ? i18n.t('Group "{{name}}" ({{count}})', { name: group.name, count: groupDEs.length })
          : isManual
          ? i18n.t('Group')
          : i18n.t('Group (target "{{targetName}}")', { targetName })}
      </h4>

      {!group ? (
        <p style={{ color: colors.grey700 }}>
          {isManual
            ? i18n.t('Not mapped to a group yet.')
            : i18n.t('No data element group exists yet for this dataset. Syncing will create one named "{{targetName}}".', { targetName })}
        </p>
      ) : (
        <>
          <p>
            {isConsistent ? <Tag positive>{i18n.t('Consistent')}</Tag> : <Tag negative>{i18n.t('Inconsistent')}</Tag>}
            {nameMismatch && (
              <span style={{ marginLeft: '0.5rem', color: colors.grey700 }}>
                {i18n.t('Group name will update to "{{targetName}}" on next sync.', { targetName })}
              </span>
            )}
          </p>
          {groupDEs.length === 0 ? (
            <p style={{ color: colors.grey700 }}>{i18n.t('This group has no data elements.')}</p>
          ) : (
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              {groupDEs.map((de) => (
                <li key={de.id} style={{ color: extraIds.has(de.id) ? colors.orange060 : undefined }}>
                  {de.name}
                  {extraIds.has(de.id) && ` ${i18n.t('(not in dataset)')}`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </DetailsPanel>
  );
}
