// Flags as small SVG fragments: [viewBox width, height, markup].
function star(cx, cy, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.382 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(' ');
}

const mkRays = () => {
  const c = '14,7';
  const rays = [
    '0,5.6 0,8.4', '28,5.6 28,8.4', '12.6,0 15.4,0', '12.6,14 15.4,14',
    '0,0 4,0 0,2', '28,0 24,0 28,2', '0,14 4,14 0,12', '28,14 24,14 28,12',
  ];
  return rays.map((r) => `<polygon points="${c} ${r}" fill="#FFE600"/>`).join('');
};

export const FLAGS = {
  FI: [18, 11, '<rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#002F6C"/><rect y="4" width="18" height="3" fill="#002F6C"/>'],
  SE: [16, 10, '<rect width="16" height="10" fill="#006AA7"/><rect x="5" width="2" height="10" fill="#FECC02"/><rect y="4" width="16" height="2" fill="#FECC02"/>'],
  NO: [22, 16, '<rect width="22" height="16" fill="#BA0C2F"/><rect x="6" width="4" height="16" fill="#fff"/><rect y="6" width="22" height="4" fill="#fff"/><rect x="7" width="2" height="16" fill="#00205B"/><rect y="7" width="22" height="2" fill="#00205B"/>'],
  RS: [3, 2, '<rect width="3" height="2" fill="#fff"/><rect width="3" height="1.333" fill="#0C4076"/><rect width="3" height="0.667" fill="#C6363C"/>'],
  MK: [28, 14, `<rect width="28" height="14" fill="#D20000"/>${mkRays()}<circle cx="14" cy="7" r="3.2" fill="#D20000"/><circle cx="14" cy="7" r="2.7" fill="#FFE600"/>`],
  KKTC: [300, 200, `<rect width="300" height="200" fill="#fff"/><rect y="22" width="300" height="20" fill="#E30A17"/><rect y="158" width="300" height="20" fill="#E30A17"/><circle cx="132" cy="100" r="44" fill="#E30A17"/><circle cx="143" cy="100" r="35.5" fill="#fff"/><polygon points="${star(170, 100, 18, Math.PI)}" fill="#E30A17"/>`],
  TR: [30, 20, `<rect width="30" height="20" fill="#E30A17"/><circle cx="11.25" cy="10" r="5" fill="#fff"/><circle cx="12.5" cy="10" r="4" fill="#E30A17"/><polygon points="${star(17.4, 10, 2.5, Math.PI)}" fill="#fff"/>`],
};

export function flagSvg(code, attrs = '') {
  const f = FLAGS[code];
  if (!f) return '';
  return `<svg viewBox="0 0 ${f[0]} ${f[1]}" preserveAspectRatio="xMidYMid slice" ${attrs}>${f[2]}</svg>`;
}
