import React, { useState } from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Modal, ModalTitle, ModalContent, ModalActions, ButtonStrip, Button, NoticeBox } from '@dhis2/ui';
import { DELETE_DEG_MUTATION } from '../lib/dhis2';
import { getErrorMessage } from '../lib/errors';

export default function DeleteGroupModal({ group, onDeleted, onClose }) {
  // useDataMutation's mutate() never rejects on failure (it hangs forever
  // instead, storing the error in React state) — engine.mutate() does
  // reject, which is what lets this try/catch actually clear "Deleting…"
  // on a real failure instead of hanging.
  const engine = useDataEngine();
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await engine.mutate(DELETE_DEG_MUTATION, { variables: { id: group.id } });
      onDeleted();
    } catch (e) {
      setError(getErrorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose} small>
      <ModalTitle>{i18n.t('Delete "{{name}}"?', { name: group.name })}</ModalTitle>
      <ModalContent>
        <p>
          {i18n.t('This permanently deletes the Data Element Group ({{count}} data elements, code {{code}}). This cannot be undone, and does not affect the dataset or its data elements.', {
            count: group.dataElements?.length || 0,
            code: group.code || '—',
          })}
        </p>
        {error && (
          <NoticeBox error title={i18n.t('Could not delete this group')}>
            {error}
          </NoticeBox>
        )}
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={deleting}>{i18n.t('Cancel')}</Button>
          <Button destructive loading={deleting} disabled={deleting} onClick={handleDelete}>
            {deleting ? i18n.t('Deleting…') : i18n.t('Delete')}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
