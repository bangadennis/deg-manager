import React, { useState } from 'react';
import i18n from '@dhis2/d2-i18n';
import {
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTableHead,
  DataTableColumnHeader,
  DataTableBody,
  Tag,
  Checkbox,
  Button,
  colors,
} from '@dhis2/ui';
import { IconView16, IconAddCircle16, IconSubtractCircle16 } from '@dhis2/ui-icons';
import { evaluateDataset, getCategoryLabel, formatDate, isOrphanedConflict } from '../../lib/dhis2';
import { MATCH_FIELDS } from '../../lib/settings';
import { columnSortProps } from '../../lib/sorting';
import StatusTag from './StatusTag';
import DatasetDetailModal from './DatasetDetailModal';

export default function DatasetsTable({
  datasets, allDatasets, groups, settings, mappings, selected, toggleSelect, trackMap, bulkRunning,
  sortColumn, sortDirection, onSortIconClick, onRelinked,
}) {
  const [detailsForId, setDetailsForId] = useState(null);
  const detailsDataset = detailsForId ? datasets.find((ds) => ds.id === detailsForId) : null;
  const isManual = settings.matchField === MATCH_FIELDS.MANUAL;

  const sortProps = (name, label) => columnSortProps(name, label, sortColumn, sortDirection, onSortIconClick);

  return (
    <>
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableColumnHeader></DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('name', i18n.t('Dataset Name'))}>{i18n.t('Dataset Name')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('shortName', i18n.t('Short Name'))}>{i18n.t('Short Name')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('targetGroup', i18n.t('Target Data Element Group'))}>{i18n.t('Target Data Element Group')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('status', i18n.t('Sync Status'))}>{i18n.t('Sync Status')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('elements', i18n.t('Data Elements'))}>{i18n.t('Data Elements')}</DataTableColumnHeader>
            <DataTableColumnHeader {...sortProps('lastUpdated', i18n.t('Last Updated'))}>{i18n.t('Last Updated')}</DataTableColumnHeader>
            <DataTableColumnHeader>{i18n.t('Bulk Run Status')}</DataTableColumnHeader>
            <DataTableColumnHeader></DataTableColumnHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {datasets.map((dataset) => {
            const evalResult = evaluateDataset(dataset, groups, settings, mappings);
            const { dsDEs, missing, extra, hasMappingKey, group, category, conflict } = evalResult;
            const track      = trackMap[dataset.id];
            const isSelected = selected.has(dataset.id);
            const canRelink  = settings.allowOrphanRelink && category === 'conflict'
              && isOrphanedConflict(conflict, allDatasets, settings, mappings);

            return (
              <DataTableRow
                key={dataset.id}
                selected={isSelected}
                onClick={() => !bulkRunning && toggleSelect(dataset.id)}
              >
                {/* stopPropagation so the Checkbox's own onChange doesn't
                    also fire the row's onClick and toggle selection twice */}
                <DataTableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    disabled={bulkRunning}
                    onChange={() => toggleSelect(dataset.id)}
                  />
                </DataTableCell>

                <DataTableCell>{dataset.name}</DataTableCell>

                <DataTableCell>{dataset.shortName || '—'}</DataTableCell>

                <DataTableCell>
                  {isManual ? (
                    hasMappingKey ? (
                      <span>{group.name}</span>
                    ) : (
                      <span style={{ color: colors.red600 }}>{i18n.t('No manual mapping')}</span>
                    )
                  ) : hasMappingKey ? (
                    <code>{dataset[settings.matchField]}</code>
                  ) : (
                    <span style={{ color: colors.red600 }}>
                      {settings.matchField === 'code' ? i18n.t('No code available') : i18n.t('No UID available')}
                    </span>
                  )}
                </DataTableCell>

                <DataTableCell>
                  {category === 'consistent' ? (
                    <Tag positive>{getCategoryLabel(category)}</Tag>
                  ) : category === 'unlinked' ? (
                    <Tag neutral>{getCategoryLabel(category)}</Tag>
                  ) : (
                    <span title={category === 'conflict' && conflict ? i18n.t('Already used by "{{name}}" ({{id}})', { name: conflict.name, id: conflict.id }) : undefined}>
                      <Tag negative>{getCategoryLabel(category)}</Tag>
                    </span>
                  )}
                  {canRelink && (
                    <span title={i18n.t('This group has no code yet and is free to claim — open the dataset or use Relink Conflicts to link it here.')} style={{ marginLeft: '0.25rem' }}>
                      <Tag neutral>{i18n.t('Relinkable')}</Tag>
                    </span>
                  )}
                </DataTableCell>

                {/* Compact at-a-glance counts instead of full comma-separated
                    lists, which got unreadable once a dataset had more than a
                    handful of elements — full detail is one click away. The
                    "missing"/"extra" words are dropped in favor of the
                    icon + number alone (full wording lives in the title
                    tooltip) so this cell doesn't force the column wider. */}
                <DataTableCell onClick={(e) => { e.stopPropagation(); setDetailsForId(dataset.id); }} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: colors.grey700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {i18n.t('{{n}} total', { n: dsDEs.length })}
                    </span>
                    {missing.length > 0 && (
                      <span
                        title={i18n.t('{{n}} missing', { n: missing.length })}
                        style={{ color: colors.green600, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.1rem', whiteSpace: 'nowrap' }}
                      >
                        <IconAddCircle16 aria-hidden="true" />
                        {missing.length}
                      </span>
                    )}
                    {extra.length > 0 && (
                      <span
                        title={i18n.t('{{n}} extra', { n: extra.length })}
                        style={{ color: colors.yellow800, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.1rem', whiteSpace: 'nowrap' }}
                      >
                        <IconSubtractCircle16 aria-hidden="true" />
                        {extra.length}
                      </span>
                    )}
                  </div>
                </DataTableCell>

                <DataTableCell>{formatDate(dataset.lastUpdated)}</DataTableCell>

                <DataTableCell>
                  {track ? <StatusTag status={track.status} errorMsg={track.errorMsg} /> : <Tag neutral>—</Tag>}
                </DataTableCell>

                <DataTableCell onClick={(e) => e.stopPropagation()}>
                  <Button small secondary icon={<IconView16 />} aria-label={i18n.t('View details')} title={i18n.t('View details')} onClick={() => setDetailsForId(dataset.id)} />
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>

      {detailsDataset && (
        <DatasetDetailModal
          dataset={detailsDataset}
          datasets={allDatasets}
          groups={groups}
          settings={settings}
          mappings={mappings}
          onClose={() => setDetailsForId(null)}
          onRelinked={onRelinked}
        />
      )}
    </>
  );
}
