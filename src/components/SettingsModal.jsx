import React, { useState } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import {
  Modal,
  ModalTitle,
  ModalContent,
  ModalActions,
  ButtonStrip,
  Button,
  SegmentedControl,
  InputField,
  Checkbox,
  SingleSelectField,
  SingleSelectOption,
  NoticeBox,
  colors,
} from '@dhis2/ui';
import { MATCH_FIELDS, PUBLIC_ACCESS, SHARING_SOURCE } from '../lib/settings';
import { buildGroupName, USER_GROUPS_QUERY } from '../lib/dhis2';
import { getErrorMessage } from '../lib/errors';

// Functions, not module-level constants: i18n.t() needs to run after the
// active locale is known (and again if it changes), same reasoning as
// getCategoryLabel/getCategoryFilters in lib/dhis2.js.
function getMatchFieldOptions() {
  return [
    { label: i18n.t('Dataset UID'), value: MATCH_FIELDS.UID },
    { label: i18n.t('Dataset code'), value: MATCH_FIELDS.CODE },
    { label: i18n.t('Manual'), value: MATCH_FIELDS.MANUAL },
  ];
}

function getPublicAccessOptions() {
  return [
    { label: i18n.t('View only'), value: PUBLIC_ACCESS.VIEW },
    { label: i18n.t('View and edit'), value: PUBLIC_ACCESS.VIEW_EDIT },
    { label: i18n.t('No public access'), value: PUBLIC_ACCESS.NONE },
  ];
}

function getUserGroupAccessOptions() {
  return [
    { label: i18n.t('View'), value: PUBLIC_ACCESS.VIEW },
    { label: i18n.t('View and edit'), value: PUBLIC_ACCESS.VIEW_EDIT },
  ];
}

function getSharingSourceOptions() {
  return [
    { label: i18n.t('Same as dataset'), value: SHARING_SOURCE.DATASET },
    { label: i18n.t('Custom'),          value: SHARING_SOURCE.CUSTOM },
  ];
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { data: userGroupsData, loading: userGroupsLoading } = useDataQuery(USER_GROUPS_QUERY);

  const previewName = buildGroupName({ name: `<${i18n.t('Dataset name')}>` }, local);
  const allUserGroups = userGroupsData?.userGroups?.userGroups || [];
  const addedUserGroups = local.defaultSharing.userGroups;
  const availableUserGroups = allUserGroups.filter((g) => !addedUserGroups.some((ug) => ug.id === g.id));

  const matchFieldOptions = getMatchFieldOptions();
  const publicAccessOptions = getPublicAccessOptions();
  const userGroupAccessOptions = getUserGroupAccessOptions();
  const sharingSourceOptions = getSharingSourceOptions();

  function setSharing(patch) {
    setLocal((s) => ({ ...s, defaultSharing: { ...s.defaultSharing, ...patch } }));
  }

  function addUserGroup(id) {
    const group = allUserGroups.find((g) => g.id === id);
    if (!group) return;
    setSharing({ userGroups: [...addedUserGroups, { id: group.id, name: group.name, access: PUBLIC_ACCESS.VIEW_EDIT }] });
  }

  function removeUserGroup(id) {
    setSharing({ userGroups: addedUserGroups.filter((ug) => ug.id !== id) });
  }

  function updateUserGroupAccess(id, access) {
    setSharing({ userGroups: addedUserGroups.map((ug) => (ug.id === id ? { ...ug, access } : ug)) });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(local);
      onClose();
    } catch (e) {
      setSaveError(getErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>{i18n.t('Sync settings')}</ModalTitle>
      <ModalContent>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{i18n.t('Map groups to datasets using')}</p>
          <SegmentedControl
            selected={local.matchField}
            options={matchFieldOptions}
            onChange={({ value }) => setLocal((s) => ({ ...s, matchField: value }))}
          />
          <p style={{ color: colors.grey700, fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {local.matchField === MATCH_FIELDS.MANUAL
              ? i18n.t("Linkage comes from explicit dataset↔group pairings made in the Mappings view instead of a value written to the group's Code field. Bulk sync will never create a new group in this mode — pair a dataset with an existing group first.")
              : i18n.t("This value is written to each group's Code field and used to link it back to its dataset. Changing it after groups already exist may create duplicates for datasets processed under the old setting.")}
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{i18n.t('Group naming')}</p>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
            <InputField
              label={i18n.t('Name prefix')}
              placeholder={i18n.t('e.g. DEG - ')}
              value={local.namePrefix}
              onChange={({ value }) => setLocal((s) => ({ ...s, namePrefix: value || '' }))}
            />
            <InputField
              label={i18n.t('Name suffix')}
              placeholder={i18n.t('e.g.  (auto)')}
              value={local.nameSuffix}
              onChange={({ value }) => setLocal((s) => ({ ...s, nameSuffix: value || '' }))}
            />
          </div>
          <p style={{ color: colors.grey700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {i18n.t('Preview')}: <strong>{previewName}</strong>
          </p>
          <Checkbox
            label={i18n.t('Also update Short Name when syncing')}
            checked={local.syncShortName}
            onChange={({ checked }) => setLocal((s) => ({ ...s, syncShortName: checked }))}
          />
          <p style={{ color: colors.grey700, fontSize: '0.85rem' }}>
            {i18n.t("New groups always get a Short Name (it's required). Turn this off to leave an existing group's Short Name as-is on later syncs, e.g. if it's been hand-tuned to a different abbreviation.")}
          </p>
        </div>

        <div>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{i18n.t('Default sharing for new groups')}</p>
          <Checkbox
            label={i18n.t('Apply sharing settings when a group is first created')}
            checked={local.defaultSharing.enabled}
            onChange={({ checked }) => setSharing({ enabled: checked })}
          />

          {local.defaultSharing.enabled && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{i18n.t('Sharing source')}</p>
              <SegmentedControl
                selected={local.defaultSharing.source}
                options={sharingSourceOptions}
                onChange={({ value }) => setSharing({ source: value })}
              />

              {local.defaultSharing.source === SHARING_SOURCE.DATASET && (
                <p style={{ color: colors.grey700, fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {i18n.t("The new group copies its source dataset's own sharing (public access and user groups) at creation time. If a dataset has no sharing configured, the server's own default sharing is used instead.")}
                </p>
              )}

              {local.defaultSharing.source === SHARING_SOURCE.CUSTOM && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{i18n.t('Public access')}</p>
                  <SegmentedControl
                    selected={local.defaultSharing.publicAccess}
                    options={publicAccessOptions}
                    onChange={({ value }) => setSharing({ publicAccess: value })}
                  />

                  <p style={{ fontSize: '0.85rem', margin: '1rem 0 0.25rem' }}>
                    {i18n.t('Also share with specific user groups (combines with public access above — e.g. "no public access, but these groups can edit" is fine)')}
                  </p>
                  <div style={{ maxWidth: '20rem' }}>
                    <SingleSelectField
                      filterable
                      noMatchText={i18n.t('No matching user groups')}
                      placeholder={userGroupsLoading ? i18n.t('Loading user groups…') : i18n.t('Add a user group…')}
                      disabled={userGroupsLoading || availableUserGroups.length === 0}
                      selected=""
                      onChange={({ selected }) => addUserGroup(selected)}
                    >
                      {availableUserGroups.map((ug) => (
                        <SingleSelectOption key={ug.id} value={ug.id} label={ug.name} />
                      ))}
                    </SingleSelectField>
                  </div>

                  {addedUserGroups.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {addedUserGroups.map((ug) => (
                        <div key={ug.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ flex: 1 }}>{ug.name}</span>
                          <SegmentedControl
                            selected={ug.access}
                            options={userGroupAccessOptions}
                            onChange={({ value }) => updateUserGroupAccess(ug.id, value)}
                          />
                          <Button small secondary onClick={() => removeUserGroup(ug.id)}>{i18n.t('Remove')}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p style={{ color: colors.grey700, fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {i18n.t("Only applies at creation time — existing groups' sharing is never changed by a sync. Use the Sharing action on a group to change it later. Leave unchecked to use this server's own default.")}
          </p>
        </div>

        {saveError && (
          <div style={{ marginTop: '1rem' }}>
            <NoticeBox error title={i18n.t('Could not save settings')}>
              {saveError}
            </NoticeBox>
          </div>
        )}
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={saving}>{i18n.t('Cancel')}</Button>
          <Button primary onClick={handleSave} loading={saving} disabled={saving}>
            {saving ? i18n.t('Saving…') : i18n.t('Save')}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  );
}
