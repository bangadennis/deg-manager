import React, { useState } from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Tag, Button, NoticeBox, colors } from '@dhis2/ui';
import { evaluateDataset, isOrphanedConflict, UPDATE_DEG_MUTATION } from '../../lib/dhis2';
import { MATCH_FIELDS } from '../../lib/settings';
import { getErrorMessage } from '../../lib/errors';
import DetailsPanel from '../shared/DetailsPanel';
import AuditMeta from '../shared/AuditMeta';
import DataElementList from '../shared/DataElementList';

export default function DatasetDetailModal({ dataset, datasets, groups, settings, mappings, onClose, onRelinked }) {
  // useDataMutation's mutate() never rejects on failure (see DatasetsPanel) —
  // engine.mutate() does, letting this try/catch actually clear "Relinking…"
  // on a real failure instead of hanging.
  const engine = useDataEngine();
  const [relinking, setRelinking] = useState(false);
  const [relinkError, setRelinkError] = useState(null);

  const { group, dsDEs, groupDEs, missing, extra, isConsistent, nameMismatch, hasMappingKey, conflict, expectedName: targetName } =
    evaluateDataset(dataset, groups, settings, mappings);

  const isManual = settings.matchField === MATCH_FIELDS.MANUAL;
  const missingIds = new Set(missing.map((de) => de.id));
  const extraIds   = new Set(extra.map((de) => de.id));
  const canRelink = !!conflict && isOrphanedConflict(conflict, datasets, settings, mappings);

  async function handleRelink() {
    setRelinking(true);
    setRelinkError(null);
    try {
      await engine.mutate(UPDATE_DEG_MUTATION, {
        variables: {
          id: conflict.id,
          name: conflict.name,
          shortName: conflict.shortName,
          code: dataset[settings.matchField],
          dataElements: (conflict.dataElements || []).map((de) => ({ id: de.id })),
        },
      });
      onRelinked();
      onClose();
    } catch (e) {
      setRelinkError(getErrorMessage(e));
      setRelinking(false);
    }
  }

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
        <p style={{ color: colors.red600 }}>
          {isManual
            ? i18n.t('This dataset has no manual mapping yet. Open the Mappings view to link it to an existing group.')
            : i18n.t('Switch the mapping key in Settings, or assign this dataset a code, before syncing it.')}
        </p>
      )}
      {conflict && (
        <p style={{ color: colors.red600 }}>
          {i18n.t('Cannot sync — the name/short name "{{targetName}}" is already used by a different group, {{conflictName}} ({{conflictId}}). Adjust the name prefix/suffix in Settings, or resolve the conflict manually.', {
            targetName,
            conflictName: conflict.name,
            conflictId: conflict.id,
          })}
        </p>
      )}

      {canRelink && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: colors.grey700 }}>
            {i18n.t('This looks like a pre-existing group with no dataset linked to it yet — relink it to this dataset instead of staying blocked?')}
          </p>
          <Button small primary loading={relinking} disabled={relinking} onClick={handleRelink}>
            {relinking ? i18n.t('Relinking…') : i18n.t('Relink to this group')}
          </Button>
          {relinkError && (
            <div style={{ marginTop: '0.5rem' }}>
              <NoticeBox error title={i18n.t('Could not relink this group')}>
                {relinkError}
              </NoticeBox>
            </div>
          )}
        </div>
      )}

      <h4 style={{ marginBottom: '0.25rem' }}>
        {i18n.t('Dataset data elements ({{n}})', { n: dsDEs.length })}
        {missing.length > 0 && (
          <span style={{ color: colors.green600, fontWeight: 'normal', fontSize: '0.85rem' }}>
            {' · '}{i18n.t('{{n}} to add', { n: missing.length })}
          </span>
        )}
      </h4>
      {dsDEs.length === 0 ? (
        <p style={{ color: colors.grey700 }}>{i18n.t('This dataset has no data elements.')}</p>
      ) : (
        <DataElementList
          items={dsDEs}
          statusFor={(de) => (missingIds.has(de.id) ? 'missing' : undefined)}
          suffixFor={() => i18n.t('(will be added)')}
        />
      )}

      <h4 style={{ marginBottom: '0.25rem', marginTop: '1.5rem' }}>
        {group
          ? i18n.t('Group "{{name}}" ({{n}})', { name: group.name, n: groupDEs.length })
          : isManual
          ? i18n.t('Group')
          : i18n.t('Group (target "{{targetName}}")', { targetName })}
        {extra.length > 0 && (
          <span style={{ color: colors.yellow800, fontWeight: 'normal', fontSize: '0.85rem' }}>
            {' · '}{i18n.t('{{n}} to remove', { n: extra.length })}
          </span>
        )}
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
            {isConsistent ? <Tag positive>{i18n.t('In sync')}</Tag> : <Tag negative>{i18n.t('Out of sync')}</Tag>}
            {nameMismatch && (
              <span style={{ marginLeft: '0.5rem', color: colors.grey700 }}>
                {i18n.t('Group name will update to "{{targetName}}" on next sync.', { targetName })}
              </span>
            )}
          </p>
          {groupDEs.length === 0 ? (
            <p style={{ color: colors.grey700 }}>{i18n.t('This group has no data elements.')}</p>
          ) : (
            <DataElementList
              items={groupDEs}
              statusFor={(de) => (extraIds.has(de.id) ? 'extra' : undefined)}
              suffixFor={() => i18n.t('(will be removed)')}
            />
          )}
        </>
      )}
    </DetailsPanel>
  );
}
