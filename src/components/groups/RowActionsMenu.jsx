import React, { useState, useRef } from 'react';
import i18n from '@dhis2/d2-i18n';
import { Button, Popover, FlyoutMenu } from '@dhis2/ui';
import { IconMore16 } from '@dhis2/ui-icons';

export default function RowActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <>
      <span ref={anchorRef} style={{ display: 'inline-block' }}>
        <Button small secondary icon={<IconMore16 />} aria-label={i18n.t('More actions')} title={i18n.t('More actions')} onClick={() => setOpen((o) => !o)} />
      </span>
      {open && (
        <Popover reference={anchorRef} placement="bottom-end" onClickOutside={() => setOpen(false)}>
          <FlyoutMenu onClick={() => setOpen(false)}>{children}</FlyoutMenu>
        </Popover>
      )}
    </>
  );
}
