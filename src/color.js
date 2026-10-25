export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// 0..1 floats for shader uniforms
export function hexToVec(hex) {
  return hexToRgb(hex).map((v) => v / 255);
}

export const pad = (n) => String(n).padStart(2, '0');
