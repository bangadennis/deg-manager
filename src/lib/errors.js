// @dhis2/app-runtime mutation failures can carry the parsed DHIS2 API error
// body (with structured validation conflicts) under `.details`, or just a
// plain `.message` for network-level failures. Try the most specific source
// first so bulk-run failures show an actionable reason, not "Network Error".
export function getErrorMessage(e) {
  const reports = e?.details?.response?.errorReports;
  if (Array.isArray(reports) && reports.length > 0) {
    return reports.map((r) => r.message).join('; ');
  }

  const conflicts = e?.details?.response?.conflicts;
  if (Array.isArray(conflicts) && conflicts.length > 0) {
    return conflicts.map((c) => `${c.object || ''}: ${c.value || c.message || ''}`.trim()).join('; ');
  }

  if (e?.details?.message) return e.details.message;
  if (e?.message) return e.message;
  return 'Unknown error';
}
