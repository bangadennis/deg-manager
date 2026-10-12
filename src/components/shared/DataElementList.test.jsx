import React from 'react';
import { render, screen } from '@testing-library/react';
import DataElementList from './DataElementList';

describe('DataElementList', () => {
  it('sorts missing/extra items ahead of consistent ones', () => {
    const items = [
      { id: 'a', name: 'Consistent A' },
      { id: 'b', name: 'Missing B' },
      { id: 'c', name: 'Consistent C' },
      { id: 'd', name: 'Extra D' },
    ];
    const statusFor = (de) => ({ b: 'missing', d: 'extra' }[de.id]);

    render(<DataElementList items={items} statusFor={statusFor} />);

    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names.slice(0, 2).sort()).toEqual(['Extra D', 'Missing B']);
    expect(names.slice(2).sort()).toEqual(['Consistent A', 'Consistent C']);
  });

  it('passes a per-item suffix through to each row', () => {
    const items = [{ id: 'a', name: 'DE A' }];
    render(<DataElementList items={items} statusFor={() => 'missing'} suffixFor={() => '(will be added)'} />);
    expect(screen.getByText('DE A (will be added)')).toBeInTheDocument();
  });
});
