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

function getActionByCategory(category) {
  const actions = {
    unlinked:    { label: i18n.t('Will create'), tone: 'positive' },
    needsUpdate: { label: i18n.t('Will update'), tone: 'positive' },
    consistent:  { label: i18n.t('No change'),   tone: 'neutral'  },
    conflict:    { label: i18n.t('Will fail'),   tone: 'negative' },
    unmappable:  { label: i18n.t('Will fail'),   tone: 'negative' },
  };
  return actions[category];
}

function reasonFor(evalResult) {
  switch (evalResult.category) {
    case 'unlinked':
      return i18n.t('Create "{{name}}" with {{count}} data elements.', { name: evalResult.expectedName, count: evalResult.dsDEs.length });
    case 'needsUpdate': {
      const bits = [];
      if (evalResult.missing.length) bits.push(i18n.t('+{{count}} missing', { count: evalResult.missing.length }));
      if (evalResult.extra.length) bits.push(i18n.t('-{{count}} extra', { count: evalResult.extra.length }));
      if (evalResult.nameMismatch) bits.push(i18n.t('name change'));
      return bits.join(', ') || i18n.t('Update group.');
    }
    case 'consistent':
      return i18n.t('Already in sync.');
    case 'conflict':
      return i18n.t('Name/short name already used by "{{name}}" ({{id}}).', { name: evalResult.conflict.name, id: evalResult.conflict.id });
    case 'unmappable':
      return i18n.t('No mapping key value on this dataset.');
    default:
      return '';
  }
}

export default function PreviewModal({ entries, onRunSync, onClose }) {
  const willCreate = entries.filter((e) => e.evalResult.category === 'unlinked').length;
  const willUpdate = entries.filter((e) => e.evalResult.category === 'needsUpdate').length;
  const noChange   = entries.filter((e) => e.evalResult.category === 'consistent').length;
  const willFail   = entries.filter((e) => e.evalResult.category === 'conflict' || e.evalResult.category === 'unmappable').length;

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>
        {i18n.t(entries.length === 1 ? 'Preview — {{count}} selected dataset' : 'Preview — {{count}} selected datasets', { count: entries.length })}
      </ModalTitle>
      <ModalContent>
        <p style={{ color: colors.grey700, marginTop: 0 }}>
          {i18n.t('Nothing has been changed yet. This is what running the sync now would do, based on the current settings.')}
        </p>

        <div style={{ display: 'flex', gap: '2rem', margin: '1rem 0' }}>
          <span>{i18n.t('Create')}: <strong>{willCreate}</strong></span>
          <span>{i18n.t('Update')}: <strong>{willUpdate}</strong></span>
          <span>{i18n.t('No change')}: <strong>{noChange}</strong></span>
          <span style={{ color: willFail > 0 ? colors.red060 : undefined }}>{i18n.t('Will fail')}: <strong>{willFail}</strong></span>
        </div>

        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>{i18n.t('Dataset')}</DataTableColumnHeader>
              <DataTableColumnHeader>{i18n.t('Action')}</DataTableColumnHeader>
              <DataTableColumnHeader>{i18n.t('Details')}</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {entries.map(({ dataset, evalResult }) => {
              const action = getActionByCategory(evalResult.category);
              return (
                <DataTableRow key={dataset.id}>
                  <DataTableCell>{dataset.name}</DataTableCell>
                  <DataTableCell>
                    <Tag positive={action.tone === 'positive'} negative={action.tone === 'negative'} neutral={action.tone === 'neutral'}>
                      {action.label}
                    </Tag>
                  </DataTableCell>
                  <DataTableCell>
                    <span style={{ fontSize: '0.85rem', color: action.tone === 'negative' ? colors.red060 : colors.grey700 }}>
                      {reasonFor(evalResult)}
                    </span>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose}>{i18n.t('Cancel')}</Button>
          <Button primary onClick={onRunSync}>{i18n.t('Run Sync Now')}</Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
