// After `vite build`: one small static page per record and single, in Turkish and English,
// so link previews (LinkedIn, WhatsApp, Slack) and search engines get a real title,
// description and image instead of the bare #/ app shell. Visitors are sent straight on
// to the same page inside the exhibition.
//   dist/<slug>/index.html, dist/<slug>/<child>/index.html  (Turkish)
//   dist/en/<slug>/index.html …                               (English)
// plus dist/sitemap.xml and dist/robots.txt.
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://kivancsh.github.io/kivancsh.webpage/';
const OUT = 'dist';
const data = JSON.parse(fs.readFileSync(`${OUT}/content/records.json`, 'utf8'));
const L = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.tr : v);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').trim();

function readPost(file, lang) {
  const en = file.replace(/\.md$/, '.en.md');
  const src = fs.readFileSync(`${OUT}/content/${lang === 'en' && fs.existsSync(`${OUT}/content/${en}`) ? en : file}`, 'utf8');
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const meta = {};
  (m ? m[1] : '').split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  return { meta, body: m ? src.slice(m[0].length) : src };
}

// the readable gist of a post: headings, paragraphs, roles and figures as plain HTML
function gist(body) {
  const out = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith('```')) {
      const kind = t.slice(3).trim();
      const rows = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) if (lines[i].trim()) rows.push(lines[i].split('|').map((x) => x.trim()));
      if (kind === 'roles') {
        out.push(`<ul>${rows.map(([, org, role, notes = '', when = '']) => `<li><strong>${esc(plain(org))}</strong>${role ? ` · ${esc(plain(role))}` : ''}${when ? ` · ${esc(when)}` : ''}${notes ? notes.split(/\s;\s/).map((n) => `<br>${esc(plain(n))}`).join('') : ''}</li>`).join('')}</ul>`);
      } else if (kind === 'stats') {
        out.push(`<ul>${rows.map(([v, label, d = '']) => `<li>${esc(v)} ${esc(label)}${d ? ` (${esc(d)})` : ''}</li>`).join('')}</ul>`);
      }
      continue;
    }
    const h = t.match(/^#{2,3}\s+(.*)$/);
    if (h) out.push(`<h2>${esc(plain(h[1]))}</h2>`);
    else if (!t.startsWith('!')) out.push(`<p>${esc(plain(t.replace(/^[-*>]\s+/, '')))}</p>`);
  }
  return out.join('\n');
}

const pages = [];
for (const lang of ['tr', 'en']) {
  for (const r of data.records) {
    const routes = [{ item: r, slug: r.slug }, ...(r.children || []).map((c) => ({ item: c, slug: `${r.slug}/${c.slug}`, parent: r }))];
    for (const { item, slug, parent } of routes) {
      const { meta, body } = readPost(item.post, lang);
      const dir = `${lang === 'en' ? 'en/' : ''}${slug}`;
      const depth = dir.split('/').length;
      const up = '../'.repeat(depth);
      const name = L(data.site.name, lang);
      const title = `${meta.title || L(item.name, lang)} · ${name}`;
      const desc = meta.lede || L(data.site.subtitle, lang);
      const url = `${SITE}${dir}/`;
      const app = `${up}${lang === 'en' ? '?lang=en' : ''}#/${slug}`;
      const years = L((parent || r).years, lang);
      const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="tr" href="${SITE}${slug}/">
<link rel="alternate" hreflang="en" href="${SITE}en/${slug}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}content/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'en' ? 'en_GB' : 'tr_TR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b0a09">
<style>body{margin:0;padding:8vh 6vw;font:18px/1.6 Georgia,serif;background:#fbfaf8;color:#14161b;max-width:720px}a{color:inherit}small{font:12px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#59606b}</style>
<script>location.replace(${JSON.stringify(app)});</script>
</head>
<body>
<small>${esc(name)} · ${esc(years)}</small>
<h1>${esc(meta.title || L(item.name, lang))}</h1>
<p>${esc(desc)}</p>
${gist(body)}
<p><a href="${esc(app)}">${lang === 'en' ? 'View this page in the record collection' : 'Bu sayfayı plak arşivinde aç'} →</a></p>
</body>
</html>
`;
      fs.mkdirSync(path.join(OUT, dir), { recursive: true });
      fs.writeFileSync(path.join(OUT, dir, 'index.html'), html);
      pages.push(url);
    }
  }
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[SITE, ...pages].map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`prerendered ${pages.length} pages + sitemap.xml`);
