import React from 'react';
import i18n from '@dhis2/d2-i18n';
import {
  Modal,
  ModalTitle,
  ModalContent,
  ModalActions,
  ButtonStrip,
  Button,
  Tag,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTableHead,
  DataTableColumnHeader,
  DataTableBody,
  colors,
} from '@dhis2/ui';

function StatTile({ label, value, tone }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '6rem' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 600, color: tone }}>{value}</div>
      <div style={{ color: colors.grey700, fontSize: '0.85rem' }}>{label}</div>
    </div>
  );
}

export default function BulkSummaryModal({ summary, onRetryFailed, onClose }) {
  const { created, updated, consistent, failures } = summary;

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>{i18n.t('Bulk sync summary')}</ModalTitle>
      <ModalContent>
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <StatTile label={i18n.t('Created')}    value={created}          tone={colors.green060} />
          <StatTile label={i18n.t('Updated')}    value={updated}          tone={colors.blue060} />
          <StatTile label={i18n.t('Up to date')} value={consistent}       tone={colors.grey700} />
          <StatTile label={i18n.t('Errors')}     value={failures.length}  tone={failures.length > 0 ? colors.red060 : colors.grey700} />
        </div>

        {failures.length > 0 && (
          <>
            <p style={{ fontWeight: 500 }}>{i18n.t('Failures')}</p>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableColumnHeader>{i18n.t('Dataset')}</DataTableColumnHeader>
                  <DataTableColumnHeader>{i18n.t('Reason')}</DataTableColumnHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {failures.map((f) => (
                  <DataTableRow key={f.id}>
                    <DataTableCell>{f.name}</DataTableCell>
                    <DataTableCell>
                      <span style={{ color: colors.red060 }}>{f.message}</span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </>
        )}

        {failures.length === 0 && (
          <p style={{ color: colors.grey700 }}>
            <Tag positive>{i18n.t('All selected datasets synced successfully.')}</Tag>
          </p>
        )}
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          {failures.length > 0 && (
            <Button
              destructive
              onClick={() => {
                onClose();
                onRetryFailed();
              }}
            >
              {i18n.t('Retry Failed ({{count}})', { count: failures.length })}
            </Button>
          )}
          <Button primary onClick={onClose}>{i18n.t('Close')}</Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
