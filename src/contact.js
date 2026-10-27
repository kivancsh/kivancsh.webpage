// Email · LinkedIn · CV links, shared by the header and the end of every article.
// The addresses live in records.json (site.contact).
import { esc } from './markdown.js';
import { t } from './i18n.js';

export function contactLinks(c, { long = false } = {}) {
  if (!c) return '';
  const items = [
    c.email && { k: 'email', href: `mailto:${c.email}`, label: long ? c.email : t('contact.email'), aria: t('contact.emailAria', { v: c.email }) },
    c.linkedin && { k: 'linkedin', href: c.linkedin, label: t('contact.linkedin'), aria: t('contact.linkedinAria'), ext: true },
    c.cv && { k: 'cv', href: c.cv, label: long ? t('contact.cvLong') : t('contact.cv'), aria: t('contact.cvAria'), ext: true },
  ].filter(Boolean);
  return items
    .map((x) => `<a href="${esc(x.href)}" data-c="${x.k}" aria-label="${esc(x.aria)}"${x.ext ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="c-ico" aria-hidden="true"></span><span class="c-t">${esc(x.label)}</span></a>`)
    .join('');
}
