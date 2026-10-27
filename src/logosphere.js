// ```logosphere block: partner logos spread over a slowly turning sphere behind the
// whole article. Every logo appears once; the sphere is stretched to the window so they
// spread across the screen. Logos are faint (at most 40% opacity, less on phones) and dimmer
// still on the far side, so the page stays easy to read. Each sits in the same box, scaled to fit.

const SPIN = 70; // seconds per turn
const TILT = 0.32; // radians the axis leans towards the reader
const MAX_OPACITY = 0.4;
const MAX_OPACITY_PHONE = 0.28; // on a phone the text column covers the whole sphere

export function mountLogoSphere(el, { reduced, postEl }) {
  const logos = JSON.parse(el.dataset.logos || '[]');
  if (!logos.length || !postEl) return () => {};

  const layer = document.createElement('div');
  layer.className = 'ls-layer';
  layer.setAttribute('aria-hidden', 'true');
  const n = logos.length;
  layer.innerHTML = logos.map((l) => `<div class="ls-item"><img src="${l.src}" alt="" decoding="async" draggable="false"></div>`).join('');
  postEl.prepend(layer);
  const items = [...layer.children];

  // evenly spaced points on a unit sphere (golden-angle spiral)
  const pts = items.map((_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });

  // half-widths of the ellipsoid: almost the whole window
  let rx = 0;
  let ry = 0;
  let maxOpacity = MAX_OPACITY;
  const size = () => {
    const phone = innerWidth < 700;
    rx = innerWidth * (phone ? 0.4 : 0.42);
    ry = innerHeight * (phone ? 0.4 : 0.4);
    maxOpacity = phone ? MAX_OPACITY_PHONE : MAX_OPACITY;
  };
  size();
  addEventListener('resize', size);

  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  function place(angle) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const persp = Math.max(rx, ry) * 4;
    const rz = Math.min(rx, ry);
    pts.forEach(([x, y, z], i) => {
      // spin around the vertical axis, then lean the whole sphere forward
      const x1 = x * ca + z * sa;
      const z1 = -x * sa + z * ca;
      const y2 = y * cosT - z1 * sinT;
      const z2 = y * sinT + z1 * cosT;
      const s = persp / (persp - z2 * rz);
      const depth = (z2 + 1) / 2; // 0 far side … 1 nearest
      const st = items[i].style;
      st.transform = `translate3d(${(x1 * rx * s).toFixed(1)}px,${(y2 * ry * s).toFixed(1)}px,0) scale(${(s * (0.7 + depth * 0.3)).toFixed(3)})`;
      st.opacity = (maxOpacity * (0.2 + 0.8 * depth)).toFixed(3);
      st.zIndex = Math.round(depth * 100);
    });
  }

  let raf = 0;
  let start = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    place(((now - start) / 1000 / SPIN) * Math.PI * 2);
  };
  if (reduced) place(0.6);
  else raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', size);
    layer.remove();
  };
}
