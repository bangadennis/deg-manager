import React from 'react';
import i18n from '@dhis2/d2-i18n';
import {
  Modal,
  ModalTitle,
  ModalContent,
  ModalActions,
  ButtonStrip,
  Button,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTableHead,
  DataTableColumnHeader,
  DataTableBody,
  colors,
} from '@dhis2/ui';

export default function RelinkPreviewModal({ candidates, settings, onClose, onConfirm }) {
  return (
    <Modal onClose={onClose} large>
      <ModalTitle>
        {i18n.t('Relink {{n}} conflicting group(s) to their datasets', { n: candidates.length })}
      </ModalTitle>
      <ModalContent>
        <p style={{ color: colors.grey700, marginTop: 0 }}>
          {i18n.t(
            "Nothing has been changed yet. Each existing group below will have its Code field set to the matching dataset's {{field}} — its name, short name and data elements are left untouched.",
            { field: settings.matchField === 'code' ? i18n.t('code') : i18n.t('UID') }
          )}
        </p>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>{i18n.t('Dataset')}</DataTableColumnHeader>
              <DataTableColumnHeader>{i18n.t('Existing group')}</DataTableColumnHeader>
              <DataTableColumnHeader>{i18n.t('Code to write')}</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {candidates.map(({ dataset, group }) => (
              <DataTableRow key={dataset.id}>
                <DataTableCell>{dataset.name}</DataTableCell>
                <DataTableCell>{group.name}</DataTableCell>
                <DataTableCell><code>{dataset[settings.matchField]}</code></DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose}>{i18n.t('Cancel')}</Button>
          <Button primary onClick={onConfirm}>{i18n.t('Relink Now')}</Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
