import { parseFrontMatter } from './markdown.js';
import { t } from './i18n.js';

const base = import.meta.env.BASE_URL || './';
// GitHub Pages lets browsers keep these files for 10 minutes; every build stamps its own
// version on them so an update shows on the next reload, not 10 minutes later
const url = (p) => `${base}content/${p}`.replace(/\/{2,}/g, '/') + `?v=${__BUILD__}`;

export async function loadContent() {
  const res = await fetch(url('records.json'));
  if (!res.ok) throw new Error('records.json okunamadı');
  const data = await res.json();
  data.site = data.site || { name: 'Plak Defteri' };
  data.records = (data.records || []).filter((r) => r && r.slug);
  return data;
}

const cache = new Map();

const get = (path) =>
  fetch(url(path)).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))));

// English posts sit next to the Turkish ones as name.en.md; Turkish is the fallback
export function loadPost(path, lang = 'tr') {
  const key = `${lang}:${path}`;
  if (!cache.has(key)) {
    const localized = lang === 'tr' ? get(path) : get(path.replace(/\.md$/, `.${lang}.md`)).catch(() => get(path));
    cache.set(
      key,
      localized.then(parseFrontMatter).catch(() => {
        cache.delete(key);
        return { meta: { title: '', missing: true }, body: t('post.missing') };
      }),
    );
  }
  return cache.get(key);
}
