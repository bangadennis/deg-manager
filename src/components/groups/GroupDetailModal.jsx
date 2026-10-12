import React, { useState } from 'react';
import i18n from '@dhis2/d2-i18n';
import { Button, ButtonStrip, Tag, SharingDialog, colors } from '@dhis2/ui';
import { findDatasetForGroup, compareDataElements, getDatasetDEs } from '../../lib/dhis2';
import { MATCH_FIELDS } from '../../lib/settings';
import DetailsPanel from '../shared/DetailsPanel';
import AuditMeta from '../shared/AuditMeta';
import DataElementList from '../shared/DataElementList';
import EditGroupModal from './EditGroupModal';
import DeleteGroupModal from './DeleteGroupModal';

export default function GroupDetailModal({ group, groups, datasets, settings, mappings, onClose, onDeleted, onSaved }) {
  const [editOpen, setEditOpen]       = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);

  const linkedDataset = findDatasetForGroup(datasets, group, settings, mappings);
  const groupDEs = group.dataElements || [];

  let missingIds = new Set();
  let extraIds   = new Set();
  if (linkedDataset) {
    const { missing, extra } = compareDataElements(getDatasetDEs(linkedDataset), groupDEs);
    missingIds = new Set(missing.map((de) => de.id));
    extraIds   = new Set(extra.map((de) => de.id));
  }

  return (
    <DetailsPanel
      title={group.name}
      subtitle={i18n.t('Code {{code}} · UID {{id}}', { code: group.code || '—', id: group.id })}
      onClose={onClose}
      actions={
        <ButtonStrip end>
          <Button destructive small onClick={() => setDeleteOpen(true)}>{i18n.t('Delete')}</Button>
          <Button small onClick={() => setSharingOpen(true)}>{i18n.t('Sharing settings')}</Button>
          <Button small onClick={() => setEditOpen(true)}>{i18n.t('Edit')}</Button>
        </ButtonStrip>
      }
    >
      <AuditMeta
        created={group.created}
        createdBy={group.createdBy}
        lastUpdated={group.lastUpdated}
        lastUpdatedBy={group.lastUpdatedBy}
      />
      <p>
        {linkedDataset ? (
          <>
            {i18n.t('Linked dataset')}: <strong>{linkedDataset.name}</strong>{' '}
            {extraIds.size === 0 && missingIds.size === 0 ? (
              <Tag positive>{i18n.t('In sync')}</Tag>
            ) : (
              <Tag negative>{i18n.t('Out of sync')}</Tag>
            )}
          </>
        ) : (
          <span style={{ color: colors.grey700 }}>
            {settings.matchField === MATCH_FIELDS.MANUAL
              ? i18n.t('Not linked to any dataset — pair it in the Mappings view.')
              : i18n.t('Not linked to any dataset via the current mapping key ({{field}}).', {
                  field: settings.matchField === 'code' ? i18n.t('dataset code') : i18n.t('dataset UID'),
                })}
          </span>
        )}
      </p>

      <h4 style={{ marginBottom: '0.25rem' }}>
        {i18n.t('Data elements ({{n}})', { n: groupDEs.length })}
        {extraIds.size > 0 && (
          <span style={{ color: colors.yellow800, fontWeight: 'normal', fontSize: '0.85rem' }}>
            {' · '}{i18n.t('{{n}} to remove', { n: extraIds.size })}
          </span>
        )}
      </h4>
      {groupDEs.length === 0 ? (
        <p style={{ color: colors.grey700 }}>{i18n.t('This group has no data elements.')}</p>
      ) : (
        <DataElementList
          items={groupDEs}
          statusFor={(de) => (extraIds.has(de.id) ? 'extra' : undefined)}
          suffixFor={() => i18n.t('(will be removed)')}
        />
      )}

      {missingIds.size > 0 && (
        <>
          <h4 style={{ marginBottom: '0.25rem', marginTop: '1rem' }}>
            {i18n.t('Missing from this group ({{n}})', { n: missingIds.size })}
            <span style={{ color: colors.green600, fontWeight: 'normal', fontSize: '0.85rem' }}>
              {' · '}{i18n.t('will be added')}
            </span>
          </h4>
          <DataElementList
            items={linkedDataset ? getDatasetDEs(linkedDataset).filter((de) => missingIds.has(de.id)) : []}
            statusFor={() => 'missing'}
          />
        </>
      )}

      {editOpen && (
        <EditGroupModal
          group={group}
          groups={groups}
          matchField={settings.matchField}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onSaved();
          }}
        />
      )}

      {sharingOpen && (
        <SharingDialog id={group.id} type="dataElementGroup" onClose={() => setSharingOpen(false)} />
      )}

      {deleteOpen && (
        <DeleteGroupModal
          group={group}
          onClose={() => setDeleteOpen(false)}
          onDeleted={async () => {
            setDeleteOpen(false);
            await onDeleted();
          }}
        />
      )}
    </DetailsPanel>
  );
}
