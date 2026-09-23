import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Layer, Button, colors } from '@dhis2/ui';
import { IconCross24 } from '@dhis2/ui-icons';

// Matches the side-panel pattern DHIS2's own metadata management app uses to
// inspect a single record without leaving the list (as opposed to a centered
// modal, which we reserve for one-off decisions like confirming a delete).
export default function DetailsPanel({ title, subtitle, onClose, children, actions }) {
  return (
    <Layer translucent onBackdropClick={onClose} dataTest="details-panel">
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(34rem, 100vw)',
          background: colors.white,
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: `1px solid ${colors.grey400}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {subtitle && (
              <p style={{ margin: '0.25rem 0 0', color: colors.grey700, fontSize: '0.85rem' }}>{subtitle}</p>
            )}
          </div>
          <Button small secondary icon={<IconCross24 />} aria-label={i18n.t('Close')} title={i18n.t('Close')} onClick={onClose} />
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>{children}</div>

        {actions && (
          <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${colors.grey400}`, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </Layer>
  );
}
