// Turkish / English. Interface strings live here; content (record names, years,
// labels, posts) lives in records.json as { "tr": …, "en": … } and in *.en.md files.
// Choice order: ?lang= in the URL, then the visitor's last choice, then the browser.

const plural = (n, one, many) => (n === 1 ? one : many);

const dict = {
  tr: {
    'meta.description': "Kıvanç Karademir: Endüstri Mühendisi (Doğu Akdeniz Üniversitesi), Türk Telekom'da Perakende Kanal Satış Yöneticisi. Kariyer, stajlar ve kulüp çalışmaları, plak plak.",
    'meta.title': '{site} · {sub}',
    'a11y.skip': 'Plak listesine atla',
    'a11y.home': 'Ana sayfa',
    'a11y.h1': '{site}: hayatımın yılları, plak plak',
    'a11y.records': 'Plaklar',
    'a11y.singles': 'Alt plaklar',
    'a11y.article': 'Yazı',
    'a11y.progress': 'Okuma ilerlemesi, başa dön',
    'a11y.language': 'Dil seçimi',
    'a11y.record': '{i} / {n}: {name}, {years}',
    'a11y.open': '{name} plağını aç ({years})',
    'a11y.live': '{i} / {n}. {name}, {years}.',
    'a11y.liveKids': ({ k }) => ` ${k} alt plak.`,
    'music.now': 'Şimdi çalıyor',
    'music.play': 'Müziği çal',
    'music.pause': 'Müziği duraklat',
    'hero.open': 'Plağa gir',
    'hero.drag': 'Sürükle',
    'hero.scroll': 'Kaydır',
    'hero.sub': 'Dönem özeti',
    'hero.subKids': ({ k }) => `Dönem özeti · ${k} alt plak`,
    'cursor.enter': 'Gir',
    'cursor.bring': 'Getir',
    'cursor.read': 'Oku',
    'post.back': 'Plağa dön',
    'post.tracks': 'Bu plağın parçaları',
    'post.read': 'Oku',
    'post.nextTrack': 'Sonraki parça',
    'post.nextRecord': 'Sonraki plak',
    'contact.title': 'İletişim',
    'contact.lede': 'Görüşme ya da iş birliği için bana buradan ulaşabilirsiniz.',
    'contact.email': 'E-posta',
    'contact.linkedin': 'LinkedIn',
    'contact.cv': 'Özgeçmiş',
    'contact.cvLong': 'Özgeçmiş (PDF)',
    'contact.emailAria': 'E-posta gönder: {v}',
    'contact.linkedinAria': 'LinkedIn profili (yeni sekmede açılır)',
    'contact.cvAria': 'Özgeçmiş, PDF (yeni sekmede açılır)',
    'music.open': 'Müzik çaları aç',
    'music.close': 'Müzik çaları kapat',
    'post.missing': '[Yer tutucu] Bu yazının dosyası bulunamadı. records.json içindeki "post" yolunu kontrol edin.',
    'md.placeholder': 'Yer tutucu',
    'md.image': 'Görsel yer tutucu',
    'label.ring': '{site}  ·  YAN A  ·  33⅓ DEVİR  ·  STEREO  ·  PLAK {i}/{n}',
    'label.side': 'A',
    'label.rights': 'KİŞİSEL ARŞİV · TÜM HAKLARI SAKLIDIR',
    'label.mini': '{parent} · ALT PLAK {i} · 45 DEVİR',
    'map.loading': 'Harita yükleniyor',
    'map.replay': 'Tekrar uçur',
    'map.count': ({ n }) => `/ ${n} ülke`,
    'map.landed': '{country} · {capital}: iniş yapıldı',
    'map.departing': 'TR → {capital} · kalkış',
    'map.aria': 'Dünya haritası: Türkiye’den {list} ülkelerine uçuşlar',
    'map.home': 'Türkiye',
    'gal.archive': 'Fotoğraf Arşivi',
    'gal.count': ({ n }) => `${n} kare`,
    'gal.study': 'Yolculuk Defteri',
    'gal.hint': 'Bir kareye tıklayın',
    'gal.back': 'Geri dönmek için tıklayın · Esc',
    'hob.words': ['öğreniyor', 'düşünüyor', 'üretiyor', 'merak ediyor'],
    'hob.goal': 'GOL!',
    'boot.error': 'İçerik yüklenemedi. Siteyi bir sunucu üzerinden açtığınızdan emin olun.',
    'nojs': 'Bu deneyim JavaScript gerektirir.',
  },
  // formal, corporate register (British spelling): the English site is read by recruiters
  en: {
    'meta.description': 'The professional portfolio of Kıvanç Karademir, Industrial Engineer (Eastern Mediterranean University) and Retail Channel Sales Manager at Türk Telekom, presented as a record collection.',
    'meta.title': '{site} · {sub}',
    'a11y.skip': 'Skip to the list of records',
    'a11y.home': 'Home',
    'a11y.h1': '{site}: Academic and Professional Background, Presented Record by Record',
    'a11y.records': 'Records',
    'a11y.singles': 'Related sections',
    'a11y.article': 'Article',
    'a11y.progress': 'Reading progress; return to the top of the page',
    'a11y.language': 'Language selection',
    'a11y.record': 'Record {i} of {n}: {name}, {years}',
    'a11y.open': 'Open the record: {name} ({years})',
    'a11y.live': 'Record {i} of {n}: {name}, {years}.',
    'a11y.liveKids': ({ k }) => ` ${k} related ${plural(k, 'section', 'sections')}.`,
    'music.now': 'Now Playing',
    'music.play': 'Play music',
    'music.pause': 'Pause music',
    'hero.open': 'Open Record',
    'hero.drag': 'Drag',
    'hero.scroll': 'Scroll',
    'hero.sub': 'Overview',
    'hero.subKids': ({ k }) => `Overview · ${k} ${plural(k, 'section', 'sections')}`,
    'cursor.enter': 'Open',
    'cursor.bring': 'Select',
    'cursor.read': 'View',
    'post.back': 'Return to Records',
    'post.tracks': 'Sections of This Record',
    'post.read': 'View',
    'post.nextTrack': 'Next Section',
    'post.nextRecord': 'Next Record',
    'contact.title': 'Contact',
    'contact.lede': 'For interview requests or professional enquiries, please get in touch through any of the channels below.',
    'contact.email': 'Email',
    'contact.linkedin': 'LinkedIn',
    'contact.cv': 'CV',
    'contact.cvLong': 'Curriculum Vitae (PDF)',
    'contact.emailAria': 'Send an email to {v}',
    'contact.linkedinAria': 'LinkedIn profile (opens in a new tab)',
    'contact.cvAria': 'Curriculum Vitae, PDF (opens in a new tab)',
    'music.open': 'Open the music player',
    'music.close': 'Close the music player',
    'post.missing': '[Placeholder] The file for this article could not be found. Please verify the "post" path in records.json.',
    'md.placeholder': 'Placeholder',
    'md.image': 'Image placeholder',
    'label.ring': '{site}  ·  SIDE A  ·  33⅓ RPM  ·  STEREO  ·  RECORD {i}/{n}',
    'label.side': 'A',
    'label.rights': 'PERSONAL ARCHIVE · ALL RIGHTS RESERVED',
    'label.mini': '{parent} · SECTION {i} · 45 RPM',
    'map.loading': 'Loading map',
    'map.replay': 'Replay Flights',
    'map.count': ({ n }) => `/ ${n} ${plural(n, 'country', 'countries')} visited`,
    'map.landed': '{country} · {capital}: arrived',
    'map.departing': 'TR → {capital} · departure',
    'map.aria': 'World map illustrating flights from Türkiye to {list}',
    'map.home': 'Türkiye',
    'gal.archive': 'Photo Archive',
    'gal.count': ({ n }) => `${n} photographs`,
    'gal.study': 'Travel Journal',
    'gal.hint': 'Select a photograph',
    'gal.back': 'Click anywhere to return · Esc',
    'hob.words': ['learning', 'analysing', 'generating', 'evaluating'],
    'hob.goal': 'GOAL!',
    'boot.error': 'The content could not be loaded. Please ensure that the site is served from a web server.',
    'nojs': 'This website requires JavaScript.',
  },
};

export const LANGS = ['tr', 'en'];

function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    const saved = localStorage.getItem('lang');
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* storage blocked: fall through to the browser */
  }
  const nav = (navigator.languages || [navigator.language || 'tr']).map((l) => l.toLowerCase());
  return nav.some((l) => l.startsWith('tr')) || !nav.some((l) => l.startsWith('en')) ? 'tr' : 'en';
}

let lang = detect();
const listeners = new Set();
document.documentElement.lang = lang;

export const getLang = () => lang;
export const upper = (s) => String(s).toLocaleUpperCase(lang);

export function t(key, vars = {}) {
  const v = dict[lang][key] ?? dict.tr[key];
  if (v == null) return key;
  if (typeof v === 'function') return v(vars);
  if (typeof v !== 'string') return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('lang', lang);
  } catch {
    /* not persisted; the URL still carries it */
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(history.state, '', url);
  listeners.forEach((f) => f(lang));
}

export const onLang = (f) => listeners.add(f);

// records.json fields may be plain strings or { tr, en }; resolve them in place
const FIELDS = ['name', 'years', 'label', 'subtitle'];
const objects = [];
export function localizeContent(content) {
  objects.length = 0;
  const visit = (o) => {
    if (!o) return;
    o._l = o._l || {};
    FIELDS.forEach((f) => {
      if (o[f] && typeof o[f] === 'object') o._l[f] = o[f];
    });
    objects.push(o);
  };
  visit(content.site);
  content.records.forEach((r) => {
    visit(r);
    (r.children || []).forEach(visit);
  });
  applyContent();
}

export function applyContent() {
  objects.forEach((o) => {
    Object.entries(o._l).forEach(([f, v]) => (o[f] = v[lang] ?? v.tr ?? Object.values(v)[0]));
  });
}

// static markup: data-i18n (text), data-i18n-aria (aria-label), data-i18n-content (meta content)
export function translateDom(vars = {}) {
  document.querySelectorAll('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n, vars)));
  document.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria, vars)));
  document.querySelectorAll('[data-i18n-content]').forEach((n) => n.setAttribute('content', t(n.dataset.i18nContent, vars)));
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
