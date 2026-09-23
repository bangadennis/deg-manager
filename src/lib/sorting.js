// Shared by every sortable DataTable in the app so the click-a-header
// interaction (and its 'asc'/'desc'/'default' cycle from @dhis2/ui) behaves
// identically everywhere.

// label gives the sort button an accessible, per-column title (it has none
// by default in @dhis2/ui) — also what makes it possible to target a
// specific column's sort control in tests, since it's a separate icon
// button, not the header text itself.
export function columnSortProps(name, label, sortColumn, sortDirection, onSortIconClick) {
  return {
    name,
    sortDirection: sortColumn === name ? sortDirection : 'default',
    sortIconTitle: `Sort by ${label}`,
    onSortIconClick,
  };
}

// comparators: { [columnName]: (a, b) => number }, each already in "ascending"
// order — 'desc' just reverses the sorted-ascending result rather than
// requiring an inverted comparator per column.
export function sortRows(rows, sortColumn, sortDirection, comparators) {
  if (!sortColumn || sortDirection === 'default' || !comparators[sortColumn]) return rows;
  const sorted = [...rows].sort(comparators[sortColumn]);
  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}
