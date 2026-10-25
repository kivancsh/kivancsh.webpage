// #/                → the exhibition
// #/slug            → a record's period summary
// #/slug/child-slug → a story from one of that record's mini records
export function parseRoute(hash, records) {
  const parts = decodeURIComponent(hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  if (!parts.length) return { view: 'hero' };
  const record = records.findIndex((r) => r.slug === parts[0]);
  if (record < 0) return { view: 'hero' };
  if (parts[1]) {
    const child = (records[record].children || []).findIndex((c) => c.slug === parts[1]);
    if (child >= 0) return { view: 'post', record, child };
  }
  return { view: 'post', record, child: null };
}

export function hashFor(route, records) {
  if (!route || route.view === 'hero') return '#/';
  const r = records[route.record];
  return route.child != null ? `#/${r.slug}/${r.children[route.child].slug}` : `#/${r.slug}`;
}

export const sameRoute = (a, b) =>
  !!a && !!b && a.view === b.view && (a.view === 'hero' || (a.record === b.record && (a.child ?? null) === (b.child ?? null)));
