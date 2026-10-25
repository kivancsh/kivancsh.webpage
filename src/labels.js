// Paper labels drawn on canvas. Used as textures on the 3D records and, as data URLs,
// on the DOM vinyls (mobile strip, blog motif) so both share one look.
import { hexToRgb, mixHex, pad } from './color.js';
import { t, upper } from './i18n.js';

const TAU = Math.PI * 2;
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const NUM = '"Big Shoulders Display", "Fraunces", sans-serif';
const SERIF = '"Fraunces", Georgia, serif';

export function compactYears(years) {
  const m = String(years).match(/^(\d{4})\s*[–-]\s*(\d{4})$/);
  if (!m) return String(years);
  return m[1].slice(0, 2) === m[2].slice(0, 2) ? `${m[1]}–${m[2].slice(2)}` : `${m[1]}–${m[2]}`;
}

let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = 4211;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 820; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,250,240,0.07)' : 'rgba(0,0,0,0.08)';
    g.fillRect(rnd() * 128, rnd() * 128, 1.4, 1.4);
  }
  grainTile = c;
  return c;
}

function paper(g, R, color, seed) {
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fillStyle = color;
  g.fill();
  const rg = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
  rg.addColorStop(0, 'rgba(255,244,222,0.20)');
  rg.addColorStop(0.55, 'rgba(255,244,222,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = rg;
  g.fill();
  // paper fibre / print grain, offset per label so no two look alike
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.clip();
  const pattern = g.createPattern(grain(), 'repeat');
  pattern.setTransform(new DOMMatrix().translate((seed * 37) % 128, (seed * 53) % 128));
  g.fillStyle = pattern;
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
}

function ring(g, r, w, style) {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.lineWidth = w;
  g.strokeStyle = style;
  g.stroke();
}

function circleText(g, text, radius, font, color, start = -Math.PI / 2) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = start - total / radius / 2;
  chars.forEach((c, i) => {
    const w = widths[i];
    a += w / 2 / radius;
    g.save();
    g.rotate(a);
    g.translate(0, -radius);
    g.fillText(c, 0, 0);
    g.restore();
    a += w / 2 / radius;
  });
  g.restore();
}

function fitFont(g, text, weightStyle, family, maxSize, maxWidth) {
  let size = maxSize;
  g.font = `${weightStyle} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxWidth) size = Math.floor(size * (maxWidth / w));
  g.font = `${weightStyle} ${size}px ${family}`;
  return size;
}

function wrap(g, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxWidth && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function recordLabel(rec, index, total, siteName, size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const k = size / 1024;
  g.translate(R, R);
  const base = mixHex(rec.accent, '#f2e6cf', 0.08);
  const ink = mixHex(rec.accent, '#120c08', 0.86);
  paper(g, R, base, index + 1);

  ring(g, R * 0.955, 3 * k, ink + 'aa');
  ring(g, R * 0.925, 1.4 * k, ink + '88');
  circleText(g, t('label.ring', { site: upper(siteName), i: pad(index + 1), n: pad(total) }),
    R * 0.86, `500 ${24 * k}px ${MONO}`, ink);

  g.textAlign = 'center';
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  const yr = compactYears(rec.years);
  fitFont(g, yr, '800', NUM, 236 * k, R * 1.34);
  g.fillText(yr, 0, -R * 0.13);

  g.font = `500 ${28 * k}px ${MONO}`;
  g.textBaseline = 'middle';
  g.fillText(t('label.side'), -R * 0.27, 0);
  g.fillText('33⅓', R * 0.29, 0);

  g.textBaseline = 'alphabetic';
  fitFont(g, rec.name, 'italic 400', SERIF, 92 * k, R * 1.3);
  g.fillText(rec.name, 0, R * 0.37);

  g.font = `500 ${21 * k}px ${MONO}`;
  g.fillText(`${rec.years.replace(/[–-]/, ' — ')}`, 0, R * 0.53);
  g.globalAlpha = 0.6;
  g.font = `400 ${17 * k}px ${MONO}`;
  g.fillText(t('label.rights'), 0, R * 0.64);
  g.globalAlpha = 1;
  return c;
}

export function miniLabel(parent, child, index, color, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const k = size / 512;
  g.translate(R, R);
  const ink = mixHex(color, '#120c08', 0.86);
  paper(g, R, color, 40 + index);
  ring(g, R * 0.95, 2.5 * k, ink + 'aa');
  circleText(g, t('label.mini', { parent: upper(parent.name), i: pad(index + 1) }),
    R * 0.84, `500 ${19 * k}px ${MONO}`, ink);
  g.textAlign = 'center';
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.font = `800 ${150 * k}px ${NUM}`;
  g.fillText(pad(index + 1), 0, -R * 0.14);
  const text = child.label || child.name;
  g.font = `italic 400 ${54 * k}px ${SERIF}`;
  let lines = wrap(g, text, R * 1.25);
  if (lines.length > 2) {
    g.font = `italic 400 ${40 * k}px ${SERIF}`;
    lines = wrap(g, text, R * 1.3).slice(0, 3);
  }
  const step = lines.length > 2 ? 0.17 : 0.22;
  lines.forEach((l, i) => g.fillText(l, 0, R * (0.36 + i * step)));
  return c;
}

export function houseLabel(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  g.translate(R, R);
  paper(g, R, '#191513', 7);
  ring(g, R * 0.94, 2, 'rgba(236,229,216,0.25)');
  ring(g, R * 0.6, 1, 'rgba(236,229,216,0.15)');
  return c;
}

export function miniColor(accent, i, n) {
  // variations of the parent's colour world: walk lightness and a touch of hue
  const [r, g, b] = hexToRgb(accent);
  const t = n > 1 ? i / (n - 1) : 0.5;
  const toward = t < 0.5 ? '#2a1214' : '#f0dcc2';
  const amt = Math.abs(t - 0.5) * 0.7;
  const shifted = `#${[r, g, b].map((v, j) => Math.round(Math.min(255, v * (1 + (j === 0 ? 0.04 : -0.02) * (t - 0.5)))).toString(16).padStart(2, '0')).join('')}`;
  return mixHex(shifted, toward, amt);
}
