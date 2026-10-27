// "layout: hobbies": every ## section becomes a full-height chapter with its own
// colour and a small animated scene. The page colour follows whichever chapter is read.

import { t } from './i18n.js';

const THEMES = [
  { key: 'fitness', test: /fitness|spor|antrenman|training|gym/i, color: '#E8603C', art: fitnessArt },
  { key: 'ai', test: /yapay|zek[aâ]|\bai\b|artificial/i, color: '#7F70FF', art: aiArt },
  { key: 'futbol', test: /futbol|football|soccer/i, color: '#35A867', art: footballArt },
  { key: 'muzik', test: /m[uü]zik|music/i, color: '#E5405E', art: musicArt },
];
const FALLBACK = ['#E8603C', '#7F70FF', '#35A867', '#E5405E'];

export function mountHobbies(article, postEl, { scroller, accent, reduced }) {
  article.classList.add('pb--hobbies');
  const heads = [...article.querySelectorAll(':scope > h2')];
  const sections = heads.map((h, i) => {
    const title = h.querySelector('.h-t')?.textContent || h.textContent;
    const theme = THEMES.find((t) => t.test.test(title)) || { key: 'generic', color: FALLBACK[i % 4], art: () => '' };
    const sec = document.createElement('section');
    sec.className = `hob hob--${theme.key}`;
    sec.style.setProperty('--hc', theme.color);
    sec.dataset.color = theme.color;
    const text = document.createElement('div');
    text.className = 'hob-text';
    h.before(sec);
    let n = h;
    // a chapter runs to the next ## heading; a photo set at the end stays outside them
    while (n && !(n !== h && n.tagName === 'H2') && !n.classList.contains('photo-set')) {
      const next = n.nextElementSibling;
      text.appendChild(n);
      n = next;
    }
    sec.innerHTML = `<div class="hob-art" aria-hidden="true"><span class="hob-num">${String(i + 1).padStart(2, '0')}</span></div>`;
    sec.appendChild(text);
    sec._art = theme.art;
    return sec;
  });

  // each scene is built only when its chapter comes near, so opening the page stays cheap
  const svgs = [];
  let current = null;
  const near = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        near.unobserve(en.target);
        const i = sections.indexOf(en.target);
        en.target.querySelector('.hob-art').insertAdjacentHTML('beforeend', en.target._art());
        const svg = (svgs[i] = en.target.querySelector('svg'));
        if (svg && svg.pauseAnimations && (en.target !== current || reduced)) svg.pauseAnimations();
      }),
    { root: scroller, rootMargin: '60% 0px' },
  );
  sections.forEach((s) => near.observe(s));
  const timers = [];
  const setActive = (sec) => {
    current = sec;
    sections.forEach((s, i) => {
      const on = s === sec;
      s.classList.toggle('is-active', on);
      const svg = svgs[i];
      if (svg && svg.pauseAnimations) (on && !reduced ? svg.unpauseAnimations() : svg.pauseAnimations());
    });
    postEl.style.setProperty('--pa', sec ? sec.dataset.color : accent);
  };

  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting).pop();
      if (hit) setActive(hit.target);
    },
    { root: scroller, rootMargin: '-45% 0px -45% 0px' },
  );
  sections.forEach((s) => io.observe(s));

  // little live readouts (their scenes may not be built yet, so look them up each tick)
  const bpm = () => article.querySelector('.hob.is-active .fit-bpm');
  if (!reduced) timers.push(setInterval(() => { const el = bpm(); if (el) el.textContent = 118 + Math.round(Math.random() * 12); }, 900));
  if (!reduced) {
    const words = t('hob.words');
    let w = 0;
    let c = 0;
    let back = false;
    timers.push(setInterval(() => {
      const word = words[w];
      c += back ? -1 : 1;
      if (c > word.length + 6) back = true;
      if (c < 0) { back = false; c = 0; w = (w + 1) % words.length; }
      const typed = article.querySelector('.hob.is-active .ai-typed');
      if (typed) typed.textContent = word.slice(0, Math.max(0, Math.min(c, word.length)));
    }, 90));
  }

  return () => {
    io.disconnect();
    near.disconnect();
    timers.forEach(clearInterval);
  };
}

function fitnessArt() {
  const grid = Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 36 + 6}" x2="400" y2="${i * 36 + 6}"/>`).join('')
    + Array.from({ length: 12 }, (_, i) => `<line x1="${i * 36 + 2}" y1="0" x2="${i * 36 + 2}" y2="300"/>`).join('');
  const ecg = 'M0,150 L70,150 L84,150 L94,124 L104,170 L114,58 L127,214 L139,150 L178,150 L192,138 L206,150 L270,150 L284,150 L294,124 L304,170 L314,58 L327,214 L339,150 L378,150 L392,138 L400,146';
  return `<svg viewBox="0 0 400 300" class="art art-fit">
    <g class="fit-grid">${grid}</g>
    <path d="${ecg}" class="fit-ecg-bg"/>
    <path d="${ecg}" class="fit-ecg" pathLength="1"/>
    <g class="fit-bar">
      <rect x="70" y="262" width="260" height="6" rx="3"/>
      <rect x="92" y="236" width="16" height="58" rx="3"/><rect x="110" y="244" width="11" height="42" rx="3"/>
      <rect x="292" y="236" width="16" height="58" rx="3"/><rect x="279" y="244" width="11" height="42" rx="3"/>
    </g>
    <g class="fit-read"><text x="22" y="44" class="fit-heart">♥</text><text x="50" y="46" class="fit-bpm">124</text><text x="112" y="46" class="fit-unit">BPM</text></g>
  </svg>`;
}

function aiArt() {
  const layers = [3, 5, 5, 2];
  const xs = [60, 160, 260, 350];
  const nodes = layers.map((n, li) => Array.from({ length: n }, (_, i) => [xs[li], 150 + (i - (n - 1) / 2) * 52]));
  const edges = [];
  for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push([a, b]);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pulses = Array.from({ length: 18 }, (_, i) => {
    const [a, b] = edges[Math.floor(rnd() * edges.length)];
    const dur = (1.2 + rnd() * 1.2).toFixed(2);
    return `<circle r="3" class="ai-pulse"><animateMotion dur="${dur}s" begin="${(rnd() * 2).toFixed(2)}s" repeatCount="indefinite" path="M${a[0]},${a[1]} L${b[0]},${b[1]}"/></circle>`;
  }).join('');
  return `<svg viewBox="0 0 400 300" class="art art-ai">
    <g class="ai-edges">${edges.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`).join('')}</g>
    ${pulses}
    <g class="ai-nodes">${nodes.flat().map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" style="--d:${(i * 0.17) % 2}s"/>`).join('')}</g>
    <text x="24" y="284" class="ai-line">&gt; model <tspan class="ai-typed">${t('hob.words')[0]}</tspan><tspan class="ai-caret">▍</tspan></text>
  </svg>`;
}

function footballArt() {
  const stripes = Array.from({ length: 8 }, (_, i) => `<rect x="${i * 50}" y="0" width="50" height="300" class="${i % 2 ? 'fb-s2' : 'fb-s1'}"/>`).join('');
  const net = Array.from({ length: 7 }, (_, i) => `<line x1="372" y1="${110 + i * 13}" x2="392" y2="${110 + i * 13}"/>`).join('')
    + Array.from({ length: 3 }, (_, i) => `<line x1="${372 + i * 10}" y1="110" x2="${372 + i * 10}" y2="188"/>`).join('');
  const dur = '2.8s';
  return `<svg viewBox="0 0 400 300" class="art art-fb">
    <g class="fb-pitch">${stripes}</g>
    <g class="fb-lines">
      <rect x="10" y="12" width="362" height="276"/><line x1="120" y1="12" x2="120" y2="288"/>
      <circle cx="120" cy="150" r="42"/><rect x="292" y="82" width="80" height="136"/><rect x="342" y="118" width="30" height="64"/>
      <circle cx="318" cy="150" r="2.5" class="fb-spot"/>
    </g>
    <g class="fb-goal">${net}<rect x="372" y="110" width="20" height="78" class="fb-post"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 0;5 0;-2 0;0 0" keyTimes="0;0.6;0.66;0.74;1" dur="${dur}" repeatCount="indefinite"/></g>
    <ellipse class="fb-shadow" rx="11" ry="4"><animateMotion dur="${dur}" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.62;1" calcMode="linear" path="M70,250 L380,168"/></ellipse>
    <g class="fb-ball">
      <animateMotion dur="${dur}" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.62;1" calcMode="spline" keySplines="0.2 0.6 0.4 1;0 0 1 1" path="M70,236 Q220,30 382,150"/>
      <g><circle r="11" class="fb-ball-w"/><path d="M0,-4.5 L4.3,-1.4 L2.6,3.6 L-2.6,3.6 L-4.3,-1.4 Z" class="fb-ball-p"/>
        <animateTransform attributeName="transform" type="rotate" from="0" to="720" dur="${dur}" repeatCount="indefinite"/></g>
    </g>
    <text x="200" y="64" class="fb-gol" text-anchor="middle">${t('hob.goal')}
      <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.62;0.66;0.9;1" dur="${dur}" repeatCount="indefinite"/></text>
  </svg>`;
}

function musicArt() {
  const bars = Array.from({ length: 16 }, (_, i) => `<rect x="${40 + i * 20}" y="190" width="12" height="90" rx="2" style="--d:${((i * 0.137) % 0.9).toFixed(2)}s;--t:${(0.55 + ((i * 7) % 5) * 0.12).toFixed(2)}s"/>`).join('');
  const grooves = Array.from({ length: 9 }, (_, i) => `<circle r="${30 + i * 6}"/>`).join('');
  const notes = ['♪', '♫', '♪', '♬'].map((n, i) => `<text x="${282 + i * 18}" y="150" style="--d:${i * 0.7}s">${n}</text>`).join('');
  return `<svg viewBox="0 0 400 300" class="art art-mu">
    <g class="mu-disc" transform="translate(150,96)">
      <g class="mu-spin"><circle r="88" class="mu-v"/><g class="mu-g">${grooves}</g><circle r="26" class="mu-l"/><circle r="3" class="mu-h"/>
        <path d="M-60,-62 A86,86 0 0 1 10,-87" class="mu-sheen"/></g>
    </g>
    <g class="mu-arm"><line x1="270" y1="18" x2="214" y2="120"/><circle cx="270" cy="18" r="9"/></g>
    <g class="mu-notes">${notes}</g>
    <g class="mu-eq">${bars}</g>
  </svg>`;
}
