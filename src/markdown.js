// A deliberately small Markdown reader for the blog posts: front matter, ## / ###,
// paragraphs, > quotes, - lists, ![image](src) figures and ```timeline blocks.
// Everything is escaped first; only the constructs below produce markup.

import { t } from './i18n.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function safeUrl(u) {
  const url = u.trim();
  if (/^(https?:|mailto:|#|\.{0,2}\/)/i.test(url) || /^[\w\-./]+$/.test(url)) return url;
  return '#';
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = safeUrl(u.replace(/&amp;/g, '&'));
    const ext = /^https?:/i.test(href);
    return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[(Yer tutucu|Placeholder)\]/g, () => `<span class="ph-mark">${t('md.placeholder')}</span>`);
  return out;
}

export function parseFrontMatter(src) {
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    meta[k] = v;
  });
  return { meta, body: src.slice(m[0].length) };
}

export function renderMarkdown(body, { sideLetter = 'A' } = {}) {
  const lines = body.replace(/\r/g, '').split('\n');
  const html = [];
  let para = [];
  let track = 0;
  let firstPara = true;

  const flush = () => {
    if (!para.length) return;
    const raw = para.join(' ');
    const text = inline(raw);
    // a drop cap only makes sense on real prose, not on a placeholder marker
    const lead = firstPara && /^[\p{L}"“‘']/u.test(raw);
    html.push(`<p class="rv${lead ? ' lead-p' : ''}">${text}</p>`);
    firstPara = false;
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }

    if (t.startsWith('```')) {
      flush();
      const kind = t.slice(3).trim();
      const block = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) block.push(lines[i]);
      if (kind === 'roles') {
        html.push(renderRoles(block));
      } else if (kind === 'stats') {
        html.push(renderStats(block));
      } else if (kind === 'travelmap') {
        const codes = block.map((l) => l.trim().toUpperCase()).filter(Boolean);
        html.push(`<div class="travel" data-codes="${esc(codes.join(','))}"></div>`);
      } else if (kind === 'timeline') {
        const items = block.filter((l) => l.trim()).map((l) => {
          const [when, ...rest] = l.split('|');
          return `<li class="rv"><span class="tl-when">${esc(when.trim())}</span><span class="tl-what">${inline(rest.join('|').trim())}</span></li>`;
        });
        html.push(`<ol class="timeline">${items.join('')}</ol>`);
      } else {
        html.push(`<pre class="rv"><code>${esc(block.join('\n'))}</code></pre>`);
      }
      continue;
    }

    let m;
    if ((m = t.match(/^(#{2,3})\s+(.*)$/))) {
      flush();
      if (m[1].length === 2) {
        track++;
        html.push(`<h2 class="rv"><span class="trk">${sideLetter}${track}</span><span class="h-t">${inline(m[2])}</span></h2>`);
      } else {
        html.push(`<h3 class="rv">${inline(m[2])}</h3>`);
      }
      continue;
    }

    if ((m = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      flush();
      const cap = inline(m[1]);
      const src = m[2].trim();
      const media = src === 'placeholder'
        ? `<div class="fig-ph"><span>${t('md.image')}</span></div>`
        : `<img src="${esc(safeUrl(src))}" alt="${esc(m[1])}" loading="lazy" decoding="async">`;
      html.push(`<figure class="fig rv"><div class="fig-frame"><div class="fig-inner">${media}</div></div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`);
      continue;
    }

    if (t.startsWith('>')) {
      flush();
      const q = [t.replace(/^>\s?/, '')];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) q.push(lines[++i].trim().replace(/^>\s?/, ''));
      let cite = '';
      if (q.length > 1 && /^[—–-]\s/.test(q[q.length - 1])) cite = q.pop().replace(/^[—–-]\s/, '');
      html.push(`<blockquote class="rv"><p>${inline(q.join(' '))}</p>${cite ? `<cite>${inline(cite)}</cite>` : ''}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flush();
      const items = [t.replace(/^[-*]\s+/, '')];
      while (i + 1 < lines.length && /^[-*]\s+/.test(lines[i + 1].trim())) items.push(lines[++i].trim().replace(/^[-*]\s+/, ''));
      html.push(`<ul class="rv">${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    para.push(t);
  }
  flush();
  return html.join('\n');
}

// logo | organisation | role | note ; note
function renderRoles(lines) {
  const rows = lines.filter((l) => l.trim()).map((l) => l.split('|').map((x) => x.trim()));
  const many = rows.length > 3;
  const items = rows.map(([logo = '', org = '', role = '', notes = ''], i) => {
    const plate = logo
      ? `<img src="${esc(safeUrl(logo))}" alt="${esc(org)} logosu" loading="lazy" decoding="async">`
      : `<span class="role-mono" aria-hidden="true">${esc(monogram(org))}</span>`;
    const list = notes.split(/\s;\s|;$/).map((x) => x.trim()).filter(Boolean);
    return `<li class="role rv" style="--i:${i}">
      <div class="role-plate">${plate}</div>
      <div class="role-body">
        ${many ? `<span class="role-n">${String(i + 1).padStart(2, '0')}</span>` : ''}
        <p class="role-org">${inline(org)}</p>
        ${role ? `<p class="role-title">${inline(role)}</p>` : ''}
        ${list.length ? `<ul class="role-notes">${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}
      </div></li>`;
  });
  return `<ol class="roles${many ? ' roles--grid' : ''}">${items.join('')}</ol>`;
}

function monogram(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words[0] && words[0].length <= 4 && words[0] === words[0].toLocaleUpperCase('tr')) return words[0];
  const small = new Set(['of', 'and', 'the', 'across', 'in', 've', 'ile']);
  return words
    .filter((w) => !small.has(w.toLowerCase()))
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase('tr');
}

// value | label | detail
function renderStats(lines) {
  const items = lines.filter((l) => l.trim()).map((l, i) => {
    const [v = '', label = '', detail = ''] = l.split('|').map((x) => x.trim());
    return `<div class="stat rv" style="--i:${i}"><span class="stat-v" data-v="${esc(v)}">${esc(v)}</span>
      <span class="stat-l">${inline(label)}</span>${detail ? `<span class="stat-d">${inline(detail)}</span>` : ''}</div>`;
  });
  return `<div class="stats">${items.join('')}</div>`;
}

export { inline as renderInline, esc };
