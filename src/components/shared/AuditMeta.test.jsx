import React from 'react';
import { render, screen } from '@testing-library/react';
import i18n from '@dhis2/d2-i18n';
import AuditMeta from './AuditMeta';

describe('AuditMeta', () => {
  // Locale fixed for deterministic month/day names; timestamps use noon UTC
  // so the date portion can't shift across a day boundary under any
  // real-world timezone offset without needing to fake the host timezone.
  const originalLanguage = i18n.language;
  beforeAll(() => { i18n.language = 'en'; });
  afterAll(() => { i18n.language = originalLanguage; });

  it('shows the formatted created/last updated dates and who made them', () => {
    render(
      <AuditMeta
        created="2024-01-10T12:00:00Z"
        createdBy={{ id: 'u1', name: 'Jane Doe' }}
        lastUpdated="2024-03-15T12:00:00Z"
        lastUpdatedBy={{ id: 'u2', name: 'John Smith' }}
      />
    );

    const text = screen.getByText(/Created/).textContent;
    expect(text).toMatch(/^Created Jan 10, 2024, \d{1,2}:\d{2}\s?(AM|PM) by Jane Doe/);
    expect(text).toMatch(/Last updated Mar 15, 2024, \d{1,2}:\d{2}\s?(AM|PM) by John Smith$/);
  });

  // createdBy/lastUpdatedBy can come back null from the API — e.g. objects
  // created by an import job with no user context.
  it('falls back to a placeholder when createdBy/lastUpdatedBy are missing', () => {
    render(<AuditMeta created={null} createdBy={null} lastUpdated={null} lastUpdatedBy={null} />);

    const text = screen.getByText(/Created/).textContent;
    expect(text).toContain('Created — by Unknown user');
    expect(text).toContain('Last updated — by Unknown user');
  });
});
