import { columnSortProps, sortRows } from './sorting';

describe('columnSortProps', () => {
  it('reports the active column\'s direction and "default" for every other column', () => {
    const onSortIconClick = jest.fn();
    expect(columnSortProps('name', 'Name', 'name', 'asc', onSortIconClick)).toEqual({
      name: 'name',
      sortDirection: 'asc',
      sortIconTitle: 'Sort by Name',
      onSortIconClick,
    });
    expect(columnSortProps('code', 'Code', 'name', 'asc', onSortIconClick)).toEqual({
      name: 'code',
      sortDirection: 'default',
      sortIconTitle: 'Sort by Code',
      onSortIconClick,
    });
  });
});

describe('sortRows', () => {
  const byNumber = { count: (a, b) => a.count - b.count };

  it('returns rows unchanged when direction is "default"', () => {
    const rows = [{ count: 2 }, { count: 1 }];
    expect(sortRows(rows, 'count', 'default', byNumber)).toBe(rows);
  });

  it('returns rows unchanged when no column is selected', () => {
    const rows = [{ count: 2 }, { count: 1 }];
    expect(sortRows(rows, null, 'asc', byNumber)).toBe(rows);
  });

  it('returns rows unchanged when there is no comparator for the column', () => {
    const rows = [{ count: 2 }, { count: 1 }];
    expect(sortRows(rows, 'unknownColumn', 'asc', byNumber)).toBe(rows);
  });

  it('sorts ascending', () => {
    const rows = [{ count: 3 }, { count: 1 }, { count: 2 }];
    expect(sortRows(rows, 'count', 'asc', byNumber).map((r) => r.count)).toEqual([1, 2, 3]);
  });

  it('sorts descending by reversing the ascending result', () => {
    const rows = [{ count: 3 }, { count: 1 }, { count: 2 }];
    expect(sortRows(rows, 'count', 'desc', byNumber).map((r) => r.count)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const rows = [{ count: 3 }, { count: 1 }];
    const original = [...rows];
    sortRows(rows, 'count', 'asc', byNumber);
    expect(rows).toEqual(original);
  });
});
