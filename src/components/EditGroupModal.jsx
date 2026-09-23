import React, { useState } from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Modal, ModalTitle, ModalContent, ModalActions, ButtonStrip, Button, InputField, NoticeBox } from '@dhis2/ui';
import { UPDATE_DEG_MUTATION, findNameConflict } from '../lib/dhis2';
import { MATCH_FIELDS } from '../lib/settings';
import { getErrorMessage } from '../lib/errors';

// dataElementGroup.shortName is capped at 50 characters by the DHIS2
// metadata schema — enforced here so the API 409 is caught before a round
// trip, not after.
const SHORT_NAME_MAX_LENGTH = 50;

export default function EditGroupModal({ group, groups, matchField, onSaved, onClose }) {
  // useDataMutation's mutate() never rejects on failure (see DatasetsPanel) —
  // engine.mutate() does, which is what lets this try/catch actually surface
  // a real failure instead of leaving "Saving…" stuck forever.
  const engine = useDataEngine();

  const [name, setName]           = useState(group.name);
  const [shortName, setShortName] = useState(group.shortName || '');
  const [code, setCode]           = useState(group.code || '');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const trimmedName      = name.trim();
  const trimmedShortName = shortName.trim();

  const nameError = trimmedName ? undefined : i18n.t('Name is required');
  const shortNameError = !trimmedShortName
    ? i18n.t('Short name is required')
    : trimmedShortName.length > SHORT_NAME_MAX_LENGTH
    ? i18n.t('Short name must be {{max}} characters or fewer', { max: SHORT_NAME_MAX_LENGTH })
    : undefined;

  const canSave = !nameError && !shortNameError && !saving;

  // Changing the code (or, in UID mode, effectively swapping which dataset
  // it points at) doesn't just relabel the group — it's also the join key
  // bulk sync uses to find this group again next run.
  const codeDrivesLinkage = matchField === MATCH_FIELDS.CODE || matchField === MATCH_FIELDS.UID;

  async function handleSave() {
    if (!canSave) return;

    const conflict = findNameConflict(trimmedName, trimmedShortName, groups, group.id);
    if (conflict) {
      setError(
        i18n.t('The name or short name is already used by another group, "{{name}}" ({{id}}).', {
          name: conflict.name,
          id: conflict.id,
        })
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await engine.mutate(UPDATE_DEG_MUTATION, {
        variables: {
          id: group.id,
          name: trimmedName,
          shortName: trimmedShortName,
          code: code.trim(),
          // Metadata-only edit — the group's own data elements are carried
          // through unchanged. UPDATE_DEG_MUTATION is a full-object PUT, so
          // omitting this would wipe them.
          dataElements: (group.dataElements || []).map((de) => ({ id: de.id })),
        },
      });
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} small dataTest="edit-group-modal">
      <ModalTitle>{i18n.t('Edit "{{name}}"', { name: group.name })}</ModalTitle>
      <ModalContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <InputField
            label={i18n.t('Name')}
            placeholder={i18n.t('Name')}
            value={name}
            error={!!nameError}
            validationText={nameError}
            onChange={({ value }) => setName(value || '')}
          />
          <InputField
            label={i18n.t('Short name')}
            placeholder={i18n.t('Short name')}
            value={shortName}
            error={!!shortNameError}
            validationText={shortNameError}
            onChange={({ value }) => setShortName(value || '')}
          />
          <InputField
            label={i18n.t('Code')}
            placeholder={i18n.t('Code')}
            value={code}
            helpText={
              codeDrivesLinkage
                ? i18n.t("Changing this may break this group's link to its dataset — the app matches them by code.")
                : undefined
            }
            onChange={({ value }) => setCode(value || '')}
          />
        </div>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <NoticeBox error title={i18n.t('Could not save this group')}>
              {error}
            </NoticeBox>
          </div>
        )}
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={saving}>{i18n.t('Cancel')}</Button>
          <Button primary loading={saving} disabled={!canSave} onClick={handleSave}>
            {saving ? i18n.t('Saving…') : i18n.t('Save')}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
