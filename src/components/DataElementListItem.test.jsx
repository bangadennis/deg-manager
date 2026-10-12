import React from 'react';
import { render, screen } from '@testing-library/react';
import { colors } from '@dhis2/ui';
import DataElementListItem from './DataElementListItem';

describe('DataElementListItem', () => {
  it('renders a plain item with no status, no color or icon', () => {
    render(<ul><DataElementListItem name="BCG doses" /></ul>);
    const item = screen.getByText('BCG doses').closest('li');
    expect(item).not.toHaveStyle({ color: colors.green600 });
    expect(item.querySelector('svg')).toBeNull();
  });

  it('renders green with an add-circle icon for a missing data element', () => {
    render(<ul><DataElementListItem name="Measles dose 1" status="missing" suffix="(missing from group)" /></ul>);
    const item = screen.getByText(/Measles dose 1/).closest('li');
    expect(item).toHaveStyle({ color: colors.green600 });
    expect(item.textContent).toBe('Measles dose 1 (missing from group)');
    expect(item.querySelector('svg')).not.toBeNull();
  });

  it('renders yellow/orange with a subtract-circle icon for an extra data element', () => {
    render(<ul><DataElementListItem name="Old vaccine X" status="extra" suffix="(not in dataset)" /></ul>);
    const item = screen.getByText(/Old vaccine X/).closest('li');
    expect(item).toHaveStyle({ color: colors.yellow800 });
    expect(item.textContent).toBe('Old vaccine X (not in dataset)');
    expect(item.querySelector('svg')).not.toBeNull();
  });

  it('renders missing with no suffix when none is given', () => {
    render(<ul><DataElementListItem name="Measles dose 1" status="missing" /></ul>);
    expect(screen.getByText('Measles dose 1').closest('li').textContent).toBe('Measles dose 1');
  });
});
