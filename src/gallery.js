// ```gallery block: travel photos as thin cards standing edge-on around a flat ring.
// When the section scrolls into view the cards fly in from a scatter, line up in a row
// and sweep into the circle. On desktop the ring tilts after the cursor and the cards
// near it flip over and lean outwards; scrolling turns the ring a little. Clicking a
// card zooms the ring in until that card stands upright in the middle, with its title
// rising word by word; clicking anywhere else or Escape brings the circle back.
// Dragging (finger or mouse) spins the ring like a dial; on touch screens the cards under
// the finger flip just as they do under the cursor.

import gsap from 'gsap';
import { esc } from './markdown.js';
import { t } from './i18n.js';

const RADIUS = 275;
const SENSITIVITY = 500; // px from a card where the cursor starts to matter
const FALLOFF = 250; // px over which a card goes from fully flipped to flat
const PULL = 50; // how far a flipped card leans out along its radius
const LERP = 0.15;
const TILT = 15; // degrees of parallax at the edge of the section
const SCROLL_TURN = 24; // degrees the ring turns while the section passes by
const INTRO_SPEED = 0.55;

const baseScale = (w) => (w < 768 ? 0.6 : w < 1200 ? 0.8 : 1);
const lerp = (a, b, k) => a + (b - a) * k;

export function mountRing(el, { reduced, scroller }) {
  const items = JSON.parse(el.dataset.items || '[]');
  const n = items.length;
  if (!n) return () => {};

  const touch = matchMedia('(pointer: coarse)').matches;
  el.innerHTML = `
    <div class="rg-stage">
      <p class="rg-k rg-tl">${t('gal.archive')}</p>
      <p class="rg-k rg-tr">${t('gal.count', { n })}</p>
      <div class="rg-tilt"><div class="rg-ring">${items
        .map((it, i) => `<button type="button" class="rg-card" data-i="${i}" aria-label="${esc(it.title)}${it.place ? `, ${esc(it.place)}` : ''}">
            <img data-src="${esc(it.src)}" alt="" decoding="async" draggable="false"></button>`)
        .join('')}</div></div>
      <div class="rg-caption" aria-live="polite"></div>
      <p class="rg-k rg-bl">${t('gal.study')}</p>
      <p class="rg-k rg-br"><span class="rg-hint">${t(touch ? 'gal.hintTouch' : 'gal.hint')}</span><span class="rg-back">${t(touch ? 'gal.backTouch' : 'gal.back')}</span></p>
    </div>`;

  const stage = el.querySelector('.rg-stage');
  const tilt = el.querySelector('.rg-tilt');
  const ring = el.querySelector('.rg-ring');
  const caption = el.querySelector('.rg-caption');
  const cards = [...el.querySelectorAll('.rg-card')];

  // resting place of every card on the circle, tangent to it
  const rest = cards.map((_, i) => {
    const angle = (i / n) * Math.PI * 2;
    return { angle, x: RADIUS * Math.cos(angle), y: RADIUS * Math.sin(angle), rot: (angle * 180) / Math.PI + 90 };
  });
  const hover = cards.map(() => ({ t: { r: 0, s: 1, x: 0, y: 0 }, c: { r: 0, s: 1, x: 0, y: 0 } }));
  const par = { t: { x: 0, y: 0, z: 0 }, c: { x: 0, y: 0, z: 0 } };

  const state = { intro: true, preview: -1, busy: false, visible: false, started: false };
  let mobile = innerWidth < 1000;
  let scale = baseScale(innerWidth);
  let scrollTurn = 0; // target, from the scroll position
  let turn = 0; // current, eased
  let spin = 0; // dial rotation from dragging: target …
  let spinC = 0; // … and current
  const drag = { id: -1, a: 0, da: 0, moved: 0, touch: false };
  const center = () => {
    const r = stage.getBoundingClientRect();
    return { r, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  let raf = 0;
  const idle = () => !state.intro && !state.busy && state.preview < 0;

  gsap.set(ring, { scale });
  cards.forEach((c, i) => gsap.set(c, { x: rest[i].x, y: rest[i].y, rotation: rest[i].rot, transformPerspective: 800, opacity: 0 }));

  // ---- images arrive only when the section is near -------------------------------
  const near = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      near.disconnect();
      el.querySelectorAll('img[data-src]').forEach((img) => (img.src = img.dataset.src));
    },
    { root: scroller, rootMargin: '120% 0px' },
  );
  near.observe(el);

  // ---- intro: scatter → one row → the circle ------------------------------------
  function intro() {
    state.started = true;
    if (reduced) {
      gsap.to(cards, { opacity: 1, duration: 0.6, stagger: 0.02, onComplete: () => (state.intro = false) });
      return;
    }
    const vw = stage.clientWidth / scale;
    const vh = stage.clientHeight / scale;
    const gap = Math.min(mobile ? 54 : 84, (vw * 0.92) / n);
    const lineY = mobile ? 140 : 220;
    const startX = -((n - 1) * gap) / 2;
    const sx = mobile ? 0.95 : 0.85;
    const sy = mobile ? 0.75 : 0.55;
    cards.forEach((c) =>
      gsap.set(c, {
        x: (Math.random() - 0.5) * vw * sx,
        y: (Math.random() - 0.5) * vh * sy,
        rotation: (Math.random() - 0.5) * 120,
        opacity: mobile ? 1 : 0,
        scale: mobile ? 0.92 : 0.95,
      }),
    );
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, onComplete: () => (state.intro = false) });
    tl.to(cards, { x: (i) => startX + i * gap, y: lineY, rotation: 0, opacity: 1, scale: 1, duration: 1.3, stagger: { each: 0.035, from: 'random' } })
      .to(cards, { x: (i) => rest[i].x, y: (i) => rest[i].y, rotation: (i) => rest[i].rot, duration: 1.8, stagger: 0.035 }, '+=0.2');
    if (mobile) tl.fromTo(ring, { scale: scale * 0.75 }, { scale, duration: 3.1, ease: 'power3.out' }, 0);
    tl.timeScale(INTRO_SPEED);
  }

  // ---- the idle loop: parallax, hover flips, scroll turn ---------------------------
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!idle()) return;
    par.c.x = lerp(par.c.x, par.t.x, LERP);
    par.c.y = lerp(par.c.y, par.t.y, LERP);
    par.c.z = lerp(par.c.z, par.t.z, LERP);
    turn = lerp(turn, scrollTurn, LERP * 0.5);
    spinC = lerp(spinC, spin, 0.12);
    gsap.set(tilt, { rotateX: par.c.x, rotateY: par.c.y, rotation: par.c.z + turn + spinC });
    if (reduced) return;
    hover.forEach((h, i) => {
      const { t: tg, c } = h;
      if (Math.abs(tg.r - c.r) + Math.abs(tg.s - c.s) + Math.abs(tg.x - c.x) + Math.abs(tg.y - c.y) < 0.002) return;
      c.r = lerp(c.r, tg.r, LERP);
      c.s = lerp(c.s, tg.s, LERP);
      c.x = lerp(c.x, tg.x, LERP);
      c.y = lerp(c.y, tg.y, LERP);
      gsap.set(cards[i], { x: rest[i].x + c.x, y: rest[i].y + c.y, rotation: rest[i].rot, rotationY: c.r, scale: c.s, transformPerspective: 1000 });
    });
  }

  // distance from a point to each card's resting centre on screen (stable: no feedback
  // from the flip), taking the ring's current turn into account
  function distances(x, y) {
    const { r, cx, cy } = center();
    const a = ((par.c.z + turn + spinC) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return { r, cx, cy, d: rest.map((p) => Math.hypot(x - (cx + (p.x * cos - p.y * sin) * scale), y - (cy + (p.x * sin + p.y * cos) * scale))) };
  }

  // the cursor (or a finger on the glass) tilts the ring and flips the cards nearby
  function onMove(e) {
    if (reduced || !idle()) return;
    const { r, cx, cy, d: dist } = distances(e.clientX, e.clientY);
    const px = (e.clientX - cx) / (r.width / 2);
    const py = (e.clientY - cy) / (r.height / 2);
    par.t.y = px * TILT;
    par.t.x = -py * TILT;
    par.t.z = (px + py) * 5;
    rest.forEach((p, i) => {
      const d = dist[i];
      const tg = hover[i].t;
      if (d < SENSITIVITY * scale) {
        const f = Math.max(0, 1 - d / (FALLOFF * scale));
        tg.r = 180 * f;
        tg.s = 1 + 0.3 * f;
        tg.x = PULL * f * Math.cos(p.angle);
        tg.y = PULL * f * Math.sin(p.angle);
      } else {
        tg.r = tg.x = tg.y = 0;
        tg.s = 1;
      }
    });
  }

  function calm() {
    par.t.x = par.t.y = par.t.z = 0;
    hover.forEach((h) => Object.assign(h.t, { r: 0, s: 1, x: 0, y: 0 }));
  }

  // ---- preview: zoom until the chosen card stands upright in the middle ------------
  function words(text) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `<span class="rg-w"><span>${esc(w)}</span></span>`)
      .join(' ');
  }

  function open(i) {
    if (!idle()) return;
    state.busy = true;
    state.preview = i;
    stage.classList.add('is-preview');
    const it = items[i];
    caption.innerHTML = `<p class="rg-title">${words(it.title)}</p>${it.place ? `<p class="rg-place">${esc(it.place)}</p>` : ''}`;
    // turn the ring so this card sits at the top, then zoom past it
    let swing = (Math.PI * 3) / 2 - rest[i].angle;
    swing = Math.atan2(Math.sin(swing), Math.cos(swing));
    const d = reduced ? 0.6 : 2;
    calm();
    gsap.to(tilt, { rotateX: 0, rotateY: 0, rotation: 0, duration: d * 0.6, ease: 'power3.out' });
    Object.assign(par.c, { x: 0, y: 0, z: 0 });
    turn = 0;
    spin = spinC = 0;
    hover.forEach((h) => Object.assign(h.c, { r: 0, s: 1, x: 0, y: 0 }));
    gsap.to(cards, { x: (k) => rest[k].x, y: (k) => rest[k].y, rotationY: 0, scale: 1, duration: 1.25, ease: 'power4.out' });
    gsap.to(ring, { scale: 5, y: 1300, rotation: (swing * 180) / Math.PI + 360, duration: d, ease: 'power4.inOut', onComplete: () => (state.busy = false) });
    gsap.fromTo(caption.querySelectorAll('.rg-w > span, .rg-place'), { yPercent: 125, opacity: 1 }, { yPercent: 0, duration: 0.75, delay: reduced ? 0.2 : 1.25, stagger: 0.1, ease: 'power4.out' });
  }

  function close({ quick = false } = {}) {
    if (state.preview < 0 || (state.busy && !quick)) return;
    state.busy = true;
    const d = reduced || quick ? 0.6 : 2.5;
    gsap.to(caption.querySelectorAll('.rg-w > span, .rg-place'), { yPercent: -125, duration: 0.75, delay: quick ? 0 : 0.5, stagger: 0.1, ease: 'power4.out' });
    gsap.to(ring, {
      scale,
      x: 0,
      y: 0,
      rotation: 0,
      duration: d,
      ease: 'power4.inOut',
      onComplete: () => {
        state.busy = false;
        state.preview = -1;
        stage.classList.remove('is-preview');
        caption.innerHTML = '';
      },
    });
    cards[state.preview]?.focus({ preventScroll: true });
  }

  stage.addEventListener('click', (e) => {
    if (state.preview >= 0) return close();
    if (drag.moved > 8) return (drag.moved = 0); // that was a spin, not a pick
    // a hovered card leans away from the cursor, so a click goes to the nearest card
    const card = e.target.closest('.rg-card');
    if (card && e.detail === 0) return open(+card.dataset.i); // keyboard
    const { d } = distances(e.clientX, e.clientY);
    const i = d.indexOf(Math.min(...d));
    if (d[i] < 70 * scale + 20) open(i);
  });
  // ---- dragging spins the ring like a dial -----------------------------------------
  const dialAngle = (e) => {
    const { cx, cy } = center();
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };
  stage.addEventListener('pointerdown', (e) => {
    if (!idle() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.id = e.pointerId;
    drag.a = dialAngle(e);
    drag.da = 0;
    drag.moved = 0;
    drag.touch = e.pointerType !== 'mouse';
    if (drag.touch) onMove(e); // a finger landing flips what is under it
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId === drag.id && idle()) {
      const a = dialAngle(e);
      let da = a - drag.a;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      drag.a = a;
      drag.da = da;
      drag.moved += Math.abs(da) * 3 + Math.abs(e.movementX || 0);
      spin += da;
    }
    if (e.pointerType === 'mouse' || e.pointerId === drag.id) onMove(e);
  });
  const release = (e) => {
    if (e.pointerId !== drag.id) return;
    drag.id = -1;
    spin += drag.da * 8; // let it coast a little
    if (drag.touch) calm();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && idle() && calm());
  // Escape closes the photo, not the article behind it
  const onKey = (e) => {
    if (e.key !== 'Escape' || state.preview < 0) return;
    e.preventDefault();
    close();
  };
  addEventListener('keydown', onKey, true);

  // ---- visibility: intro on first sight, loop only while on screen ------------------
  const seen = new IntersectionObserver(
    ([en]) => {
      state.visible = en.isIntersecting;
      if (state.visible) {
        if (!state.started && en.intersectionRatio >= 0.35) intro();
        if (!raf) loop();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        if (state.preview >= 0) close({ quick: true });
      }
    },
    { root: scroller, threshold: [0, 0.35] },
  );
  seen.observe(el);

  const onScroll = () => {
    if (!state.visible) return;
    const r = el.getBoundingClientRect();
    const vh = scroller.clientHeight;
    const p = (vh - r.top) / (vh + r.height); // 0 entering → 1 leaving
    scrollTurn = reduced ? 0 : (p - 0.5) * SCROLL_TURN;
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  const onResize = () => {
    mobile = innerWidth < 1000;
    scale = baseScale(innerWidth);
    if (idle()) {
      gsap.set(ring, { scale });
      calm();
    }
  };
  addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(raf);
    near.disconnect();
    seen.disconnect();
    scroller.removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey, true);
    gsap.killTweensOf([ring, tilt, ...cards]);
  };
}
