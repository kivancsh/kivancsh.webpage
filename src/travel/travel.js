import gsap from 'gsap';
import { geoNaturalEarth1 } from 'd3-geo';
import { FLAGS, flagSvg } from './flags.js';
import { t as msg, getLang, upper } from '../i18n.js';

// Countries the travel map knows. `map` is the Natural Earth name in world.json;
// `ll` is the capital (lon, lat) where the plane lands.
export const COUNTRIES = {
  FI: { name: { tr: 'Finlandiya', en: 'Finland' }, map: 'Finland', capital: { tr: 'Helsinki', en: 'Helsinki' }, ll: [24.94, 60.17] },
  SE: { name: { tr: 'İsveç', en: 'Sweden' }, map: 'Sweden', capital: { tr: 'Stockholm', en: 'Stockholm' }, ll: [18.07, 59.33] },
  NO: { name: { tr: 'Norveç', en: 'Norway' }, map: 'Norway', capital: { tr: 'Oslo', en: 'Oslo' }, ll: [10.75, 59.91] },
  RS: { name: { tr: 'Sırbistan', en: 'Serbia' }, map: 'Serbia', capital: { tr: 'Belgrad', en: 'Belgrade' }, ll: [20.46, 44.79] },
  MK: { name: { tr: 'Kuzey Makedonya', en: 'North Macedonia' }, map: 'Macedonia', capital: { tr: 'Üsküp', en: 'Skopje' }, ll: [21.43, 41.99] },
  KKTC: { name: { tr: 'KKTC', en: 'Northern Cyprus' }, map: 'N. Cyprus', capital: { tr: 'Lefkoşa', en: 'Nicosia' }, ll: [33.36, 35.19] },
};
// the trip's names in the current language
const local = (c) => ({ ...c, tr: c.name[getLang()] ?? c.name.tr, capital: c.capital[getLang()] ?? c.capital.tr });
const ORIGIN = { map: 'Turkey', ll: [32.85, 39.93] };

const NS = 'http://www.w3.org/2000/svg';
const PLANE = 'M0,-1 L0.16,-0.55 L0.16,-0.12 L1,0.32 L1,0.5 L0.16,0.28 L0.12,0.78 L0.38,0.98 L0.38,1.1 L0,1 L-0.38,1.1 L-0.38,0.98 L-0.12,0.78 L-0.16,0.28 L-1,0.5 L-1,0.32 L-0.16,-0.12 L-0.16,-0.55 Z';

let worldPromise = null;
const loadWorld = (base) => (worldPromise ||= fetch(`${base}content/map/world.json`).then((r) => r.json()));

export async function mountTravel(el, { reduced, base = './' }) {
  const codes = (el.dataset.codes || '').split(',').filter((c) => COUNTRIES[c]);
  el.innerHTML = `<div class="tmap tmap--loading"><span>${msg('map.loading')}</span></div>`;
  const world = await loadWorld(base);
  const projection = geoNaturalEarth1().fitExtent([[4, 4], [world.w - 4, world.h - 4]], { type: 'Sphere' });
  const byName = new Map(world.countries.map((c) => [c.n, c]));
  const origin = projection(ORIGIN.ll);
  const trips = codes.map((code, i) => {
    const info = local(COUNTRIES[code]);
    const shape = byName.get(info.map);
    const dest = projection(info.ll);
    const dx = dest[0] - origin[0];
    const dy = dest[1] - origin[1];
    const dist = Math.hypot(dx, dy);
    // bow each route to the left of travel so they fan out like a departures board
    const ctrl = [origin[0] + dx / 2 + (dy / dist) * dist * 0.28, origin[1] + dy / 2 - (dx / dist) * dist * 0.28];
    return { code, info, shape, dest, ctrl, i };
  });

  // framing: whole world first, then the region the trips cover
  const xs = [origin[0], ...trips.flatMap((t) => [t.shape?.b[0] ?? t.dest[0], t.shape?.b[2] ?? t.dest[0]])];
  const ys = [origin[1], ...trips.flatMap((t) => [t.shape?.b[1] ?? t.dest[1], t.shape?.b[3] ?? t.dest[1]])];
  const region = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  const shapes = world.countries
    .filter((c) => !trips.some((t) => t.shape === c))
    .map((c) => `<path d="${c.d}"${c.n === ORIGIN.map ? ' class="home"' : ''}/>`)
    .join('');

  const visited = trips
    .map((t) => {
      if (!t.shape) return '';
      const [x0, y0, x1, y1] = t.shape.b;
      return `<g class="vc" data-code="${t.code}">
        <clipPath id="clip-${t.code}"><path d="${t.shape.d}"/></clipPath>
        <path class="vc-base" d="${t.shape.d}"/>
        <g class="vc-flag" clip-path="url(#clip-${t.code})">
          ${flagSvg(t.code, `x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"`)}
        </g>
        <path class="vc-edge" d="${t.shape.d}"/>
      </g>`;
    })
    .join('');

  const routes = trips
    .map((t) => {
      const d = `M${origin[0]},${origin[1]} Q${t.ctrl[0]},${t.ctrl[1]} ${t.dest[0]},${t.dest[1]}`;
      return `<mask id="draw-${t.code}" maskUnits="userSpaceOnUse"><path d="${d}" pathLength="1" class="route-mask"/></mask>
        <path d="${d}" class="route" mask="url(#draw-${t.code})"/>`;
    })
    .join('');

  const pins = trips
    .map((t) => `<g class="pin" data-code="${t.code}" transform="translate(${t.dest[0]},${t.dest[1]})">
        <g class="pin-s"><circle class="pin-ring" r="9"/><circle class="pin-dot" r="3.2"/>
        <text class="pin-t" y="-12">${t.info.tr}</text></g></g>`)
    .join('');

  const planes = trips.map((t) => `<g class="plane" data-code="${t.code}"><path d="${PLANE}"/></g>`).join('');

  el.innerHTML = `
    <div class="tmap">
      <svg class="tmap-svg" viewBox="0 0 ${world.w} ${world.h}" role="img"
        aria-label="${msg('map.aria', { list: trips.map((x) => x.info.tr).join(', ') })}">
        <path class="sphere" d="${world.sphere}"/>
        <g class="land">${shapes}</g>
        <g class="visited">${visited}</g>
        <g class="routes">${routes}</g>
        <g class="home-pin" transform="translate(${origin[0]},${origin[1]})">
          <g class="pin-s"><circle class="home-ring" r="12"/><circle class="home-dot" r="4.5"/>
          <text class="pin-t home-t" y="22">${msg('map.home')}</text></g></g>
        <g class="pins">${pins}</g>
        <g class="planes">${planes}</g>
      </svg>
      <div class="tmap-hud">
        <p class="tmap-count"><span class="tmap-n">0</span><span class="tmap-of">${msg('map.count', { n: trips.length })}</span></p>
        <button type="button" class="tmap-replay">${msg('map.replay')}</button>
      </div>
      <p class="tmap-board" aria-live="polite"></p>
    </div>
    <ol class="tcards">${trips
      .map((t) => `<li class="tcard" data-code="${t.code}" style="--i:${t.i}">
        <span class="tcard-flag">${flagSvg(t.code)}</span>
        <span class="tcard-n">${String(t.i + 1).padStart(2, '0')}</span>
        <span class="tcard-name">${t.info.tr}</span>
        <span class="tcard-cap">${t.info.capital}</span></li>`)
      .join('')}</ol>`;

  const svg = el.querySelector('.tmap-svg');
  const count = el.querySelector('.tmap-n');
  const board = el.querySelector('.tmap-board');
  const frame = el.querySelector('.tmap');

  // viewBox that contains a box at the frame's aspect ratio
  const fit = ([x0, y0, x1, y1], pad) => {
    const r = frame.clientWidth / Math.max(1, frame.clientHeight);
    let w = (x1 - x0) * (1 + pad * 2);
    let h = (y1 - y0) * (1 + pad * 2);
    if (w / h < r) w = h * r;
    else h = w / r;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  };
  const view = { v: [0, 0, world.w, world.h] };
  let unit = 1;
  const setView = (v) => {
    svg.setAttribute('viewBox', v.map((n) => n.toFixed(2)).join(' '));
    // map units per screen pixel: keeps pins, labels and planes a constant size while zooming
    unit = v[2] / Math.max(1, frame.clientWidth);
    svg.style.setProperty('--u', unit.toFixed(5));
  };

  const planeEls = [...el.querySelectorAll('.plane')];
  const maskEls = [...el.querySelectorAll('.route-mask')];
  const point = (t, k) => {
    const a = 1 - k;
    return [
      a * a * origin[0] + 2 * a * k * t.ctrl[0] + k * k * t.dest[0],
      a * a * origin[1] + 2 * a * k * t.ctrl[1] + k * k * t.dest[1],
    ];
  };
  const tangent = (t, k) => [
    2 * (1 - k) * (t.ctrl[0] - origin[0]) + 2 * k * (t.dest[0] - t.ctrl[0]),
    2 * (1 - k) * (t.ctrl[1] - origin[1]) + 2 * k * (t.dest[1] - t.ctrl[1]),
  ];
  const placePlane = (t, k) => {
    const [x, y] = point(t, k);
    const [tx, ty] = tangent(t, k);
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI + 90;
    const s = (1 + Math.sin(Math.PI * k) * 0.6) * 9 * unit; // climbs, then descends
    planeEls[t.i].setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${ang.toFixed(1)}) scale(${s.toFixed(4)})`);
  };

  let landed = 0;
  const land = (t) => {
    el.querySelector(`.vc[data-code="${t.code}"]`)?.classList.add('on');
    el.querySelector(`.pin[data-code="${t.code}"]`)?.classList.add('on');
    el.querySelector(`.tcard[data-code="${t.code}"]`)?.classList.add('on');
    planeEls[t.i].classList.remove('flying');
    landed++;
    count.textContent = landed;
    board.textContent = msg('map.landed', { country: t.info.tr, capital: t.info.capital });
  };

  let tl = null;
  const reset = () => {
    tl && tl.kill();
    landed = 0;
    count.textContent = '0';
    board.textContent = '';
    el.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
    planeEls.forEach((p) => p.classList.remove('flying'));
    maskEls.forEach((m) => (m.style.strokeDashoffset = '1'));
  };

  const light = matchMedia('(pointer: coarse), (max-width: 759px)').matches;
  const play = () => {
    reset();
    const target = fit(region, 0.12);
    if (light && !reduced) setView(target);
    if (reduced) {
      setView(target);
      trips.forEach((t) => {
        maskEls[t.i].style.strokeDashoffset = '0';
        land(t);
      });
      return;
    }
    view.v = light ? target.slice() : fit([0, 0, world.w, world.h], 0);
    setView(view.v);
    tl = gsap.timeline();
    if (!light) tl.to(view.v, { 0: target[0], 1: target[1], 2: target[2], 3: target[3], duration: 1.8, ease: 'power3.inOut', onUpdate: () => setView(view.v) }, 0.2);
    trips.forEach((t) => {
      const prog = { k: 0 };
      const start = (light ? 0.3 : 1.5) + t.i * 0.55;
      tl.call(() => {
        planeEls[t.i].classList.add('flying');
        board.textContent = msg('map.departing', { capital: upper(t.info.capital) });
      }, null, start);
      tl.to(prog, {
        k: 1,
        duration: 2.1,
        ease: 'power1.inOut',
        onUpdate: () => {
          placePlane(t, prog.k);
          maskEls[t.i].style.strokeDashoffset = String(1 - prog.k);
        },
        onComplete: () => land(t),
      }, start);
    });
  };

  el.querySelector('.tmap-replay').addEventListener('click', play);
  setView(fit([0, 0, world.w, world.h], 0));
  trips.forEach((t) => placePlane(t, 0));

  // take off the first time the map is properly in view
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play();
      }
    },
    { threshold: 0.45 },
  );
  io.observe(frame);
  return () => {
    io.disconnect();
    tl && tl.kill();
  };
}

export { FLAGS };
