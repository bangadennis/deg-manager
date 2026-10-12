import React from 'react';
import DataElementListItem from './DataElementListItem';

// Shared by every data element list across the Dataset/Group detail panels:
// renders each item through DataElementListItem, and — since missing/extra
// items are the ones worth seeing first on a list that can run into the
// dozens — sorts them ahead of the untouched, consistent ones rather than
// leaving them wherever the API happened to return them.
export default function DataElementList({ items, statusFor, suffixFor }) {
  const sorted = [...items].sort((a, b) => {
    const aAffected = statusFor(a) ? 0 : 1;
    const bAffected = statusFor(b) ? 0 : 1;
    return aAffected - bAffected;
  });

  return (
    <ul style={{ paddingLeft: '1.25rem', margin: 0, listStyle: 'none' }}>
      {sorted.map((de) => (
        <DataElementListItem
          key={de.id}
          name={de.name}
          status={statusFor(de)}
          suffix={suffixFor ? suffixFor(de) : undefined}
        />
      ))}
    </ul>
  );
}
