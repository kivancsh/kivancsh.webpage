import './style.css';
import './blocks.css';
import './post-light.css';
import { loadContent, loadPost } from './content.js';
import { Carousel } from './carousel.js';
import { HeroUI, Cursor } from './ui.js';
import { Post } from './post.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { parseRoute, hashFor, sameRoute } from './router.js';
import { recordLabel, miniLabel, miniColor } from './labels.js';
import { t, getLang, setLang, onLang, localizeContent, applyContent, translateDom } from './i18n.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const mod = (v, n) => ((v % n) + n) % n;
const wrapN = (v, n) => mod(v + n / 2, n) - n / 2;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fontsReady() {
  if (!document.fonts) return;
  const faces = [
    '800 100px "Big Shoulders Display"',
    'italic 400 60px "Fraunces"',
    '400 60px "Fraunces"',
    '500 20px "IBM Plex Mono"',
  ];
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, 'ÖĞÇŞİ2015'))), wait(2500)]);
}

async function boot() {
  const content = await loadContent();
  localizeContent(content);
  await fontsReady();
  const { records } = content;
  const n = records.length;

  // DOM-side labels share the canvas artwork used on the 3D records
  const drawDomLabels = () =>
    records.forEach((r, i) => {
      r._labelURL = recordLabel(r, i, n, content.site.name, 320).toDataURL();
      (r.children || []).forEach((c, ci) => {
        c._color = c.accent || miniColor(r.accent, ci, r.children.length);
        c._labelURL = miniLabel(r, c, ci, c._color, 220).toDataURL();
      });
    });
  const translateStatic = () => {
    const site = content.site.name;
    translateDom({ site });
    document.querySelectorAll('[data-site-name]').forEach((e) => (e.textContent = site));
    document.querySelectorAll('[data-site-sub]').forEach((e) => (e.textContent = content.site.subtitle || ''));
    document.title = content.site.subtitle ? t('meta.title', { site, sub: content.site.subtitle }) : site;
  };
  drawDomLabels();
  translateStatic();

  const canvas = document.getElementById('gl');
  // starting quality: phones and tablets begin one tier down, weak hardware two
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  const tier = lowPower ? 0 : coarse || innerWidth < 760 ? 1 : 2;
  let stage = null;
  try {
    const { Stage } = await import('./stage/stage.js');
    stage = new Stage(canvas, content, { reduced, tier });
    // iOS and Android drop WebGL contexts under memory pressure; recover instead of freezing
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      stage.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      stage.lost = false;
      stage.sized = '';
      stage.resize();
    });
  } catch (err) {
    console.warn('WebGL unavailable, using the simple version.', err);
    document.documentElement.classList.add('no-webgl');
  }

  const car = new Carousel(n);
  const sound = new Sound();
  const cursor = finePointer ? new Cursor() : null;
  const app = { view: 'hero', route: { view: 'hero' }, target: null, busy: false, pending: null, depth: 0 };
  const root = document.documentElement;

  const setAccent = (hex) => root.style.setProperty('--accent', hex);

  const ui = new HeroUI({
    content,
    reduced,
    onSelect: (i, o) => flyTo(i, o),
    onOpen: () => navigate({ view: 'post', record: mod(Math.round(car.pos), n), child: null }),
    onOpenChild: (p, c) => navigate({ view: 'post', record: p, child: c }),
    onHoverChild: (c) => stage && (stage.hover = c >= 0 ? { kind: 'mini', index: c } : null),
  });
  const post = new Post({ content, reduced, onClose: () => requestClose() });

  // --- music: each page has its song (Spotify); it starts on the first interaction ---
  const trackFor = (route) => {
    if (!route || route.view === 'hero') return content.site.music;
    const r = records[route.record];
    const c = route.child != null ? r.children[route.child] : null;
    return c?.music || r.music || content.site.music;
  };
  const npEl = document.querySelector('.np');
  const startRoute = parseRoute(location.hash, records);
  const music = trackFor(startRoute)
    ? new Music({ el: npEl, track: trackFor(startRoute), volume: content.site.volume ?? 50, onChange: (on) => sound.setOn(on, { bed: false }) })
    : ((npEl.hidden = true), null);
  music && music.relabel();

  // --- language ------------------------------------------------------------------
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  onLang(async () => {
    applyContent();
    drawDomLabels();
    translateStatic();
    ui.relabel();
    stage && stage.relabel();
    music && music.relabel();
    // an open article is re-rendered in place once any transition has finished
    while (app.busy) await wait(80);
    if (app.view === 'post') setAccent(await post.rerender(app.route));
  });

  // --- navigation -------------------------------------------------------------
  const activeIndex = () => mod(Math.round(car.pos), n);

  // `vis` is the clicked copy on the exhibition, so the flight goes to that very disc
  function flyTo(i, { quiet = false, vis = null } = {}) {
    if (app.view !== 'hero' || app.busy) return;
    const cur = activeIndex();
    if (i === cur) return;
    const base = Math.round(car.target);
    const to = vis != null && stage ? base + Math.round(wrapN(vis - base, stage.nVis)) : car.nearest(i);
    if (stage && !reduced && !quiet) {
      const delta = to - car.pos;
      stage.fly.index = mod(to, stage.nVis);
      stage.fly.dir = Math.sign(delta) || 1;
      stage.fly.t = 0;
      car.flyToPos(to, {
        onUpdate: (p) => (stage.fly.t = p),
        onComplete: () => {
          stage.fly.t = 0;
          stage.fly.index = -1;
        },
      });
    } else {
      car.flyToPos(to, { duration: reduced ? 0.35 : 0.7 });
    }
  }

  function cancelFly() {
    if (stage) {
      stage.fly.index = -1;
      stage.fly.t = 0;
    }
  }

  // history.state.d = how many entries back the exhibition is (-1: none behind us,
  // e.g. the visit started on a shared post link)
  function navigate(route) {
    const hash = hashFor(route, records);
    if (sameRoute(route, app.route) && !app.busy) return;
    const depth = route.view === 'hero' ? 0 : app.depth >= 0 ? app.depth + 1 : -1;
    history.pushState({ d: depth }, '', hash);
    app.depth = depth;
    go(route);
  }

  function requestClose() {
    if (app.view !== 'post') return;
    if (app.depth > 0) history.go(-app.depth);
    else {
      history.pushState({ d: 0 }, '', '#/');
      app.depth = 0;
      go({ view: 'hero' });
    }
  }

  const onRouteChange = () => {
    const route = parseRoute(location.hash, records);
    app.depth = history.state?.d ?? (route.view === 'hero' ? 0 : -1);
    go(route);
  };
  addEventListener('popstate', onRouteChange);
  addEventListener('hashchange', onRouteChange);

  // intercept in-page record links so they share the history bookkeeping
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const route = parseRoute(a.getAttribute('href'), records);
    if (route.view === 'hero') requestClose();
    else navigate(route);
  });

  async function go(route, initial = false) {
    if (app.busy) {
      app.pending = route;
      return;
    }
    if (sameRoute(route, app.route) && !initial) return;
    app.busy = true;
    music && music.setTrack(trackFor(route));
    try {
      if (route.view === 'hero') {
        if (app.view === 'post') await closePost();
      } else if (app.view === 'hero') {
        await openPost(route, initial);
      } else {
        await swapPost(route);
      }
      app.route = route;
    } catch (err) {
      console.error(err);
    }
    app.busy = false;
    if (app.pending) {
      const p = app.pending;
      app.pending = null;
      if (!sameRoute(p, app.route)) go(p);
    }
  }

  const targetFor = (route) =>
    route.child != null && stage && !stage.compact
      ? { kind: 'mini', parent: route.record, index: route.child }
      : { kind: 'record', index: route.record };

  async function openPost(route, initial) {
    ui.hide();
    const accent = await post.prepare(route);
    cancelFly();
    if (activeIndex() !== route.record) {
      car.jumpTo(route.record);
      syncActive(true);
    }
    car.enabled = false;
    car.dragging = false;
    const target = targetFor(route);
    ui.hide();
    cursor && cursor.set('');
    setAccent(accent);

    if (!stage || reduced || initial) {
      post.open();
      root.classList.add('in-post');
      post.el.classList.add('fade-in');
      requestAnimationFrame(() => post.reveal());
      if (stage) {
        stage.setDived(target);
        stage.paused = true;
      }
      await wait(reduced ? 350 : 600);
      post.el.classList.remove('fade-in');
    } else {
      sound.needle();
      root.classList.add('portal');
      post.open();
      await stage.dive(target, { onInside: () => post.reveal() });
      root.classList.add('in-post');
      root.classList.remove('portal');
      stage.paused = true;
    }
    app.view = 'post';
    app.target = target;
    root.classList.remove('deeplink');
    post.focus();
  }

  async function closePost() {
    const target = app.target;
    sound.lift();
    if (!stage || reduced) {
      post.el.classList.add('fade-out');
      await wait(reduced ? 300 : 450);
      post.close();
      post.el.classList.remove('fade-out');
      root.classList.remove('in-post');
      if (stage) {
        stage.clearDive();
        stage.resume();
      }
      ui.show();
    } else {
      stage.setDived(target);
      stage.resume();
      stage.update(0);
      stage.render();
      root.classList.add('portal');
      root.classList.remove('in-post');
      post.leave();
      await stage.emerge({
        onClosed: () => {
          post.close();
          root.classList.remove('portal');
          ui.show();
        },
      });
    }
    car.enabled = true;
    app.view = 'hero';
    app.target = null;
    setAccent(records[activeIndex()].accent);
    const btn = ui.tlButtons[activeIndex()];
    btn && btn.focus({ preventScroll: true });
  }

  async function swapPost(route) {
    const accent = await post.swap(route);
    setAccent(accent);
    if (activeIndex() !== route.record) {
      car.jumpTo(route.record);
      syncActive(true);
    }
    app.target = targetFor(route);
    if (stage) stage.setDived(app.target);
  }

  // --- active record bookkeeping ---------------------------------------------
  let lastActive = -1;
  let lastPos = 0;
  function syncActive(immediate = false) {
    const a = activeIndex();
    if (a === lastActive) return;
    const dir = car.pos >= lastPos ? 1 : -1;
    const first = lastActive < 0;
    lastActive = a;
    ui.setActive(a, dir);
    if (app.view === 'hero') setAccent(records[a].accent);
    stage && stage.setAccent(records[a].accent, first || immediate || app.view !== 'hero');
    if (!first && !immediate) sound.tick();
  }

  // --- input ------------------------------------------------------------------
  const gesture = { down: false, id: -1, x: 0, y: 0, t: 0, moved: 0, samples: [] };
  const pxPerItem = () => (stage?.compact ? innerWidth * 0.62 : Math.min(innerWidth * 0.2, 380));
  const interactive = () => app.view === 'hero' && !app.busy;

  canvas.addEventListener('pointerdown', (e) => {
    if (!interactive() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    gesture.down = true;
    gesture.id = e.pointerId;
    gesture.x = e.clientX;
    gesture.y = e.clientY;
    gesture.t = performance.now();
    gesture.moved = 0;
    gesture.samples = [{ x: e.clientX, t: gesture.t }];
    cancelFly();
    car.dragStart();
    canvas.setPointerCapture(e.pointerId);
    cursor && cursor.set('drag', '');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (stage) {
      stage.mouse.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    }
    if (gesture.down && e.pointerId === gesture.id) {
      const dx = e.clientX - gesture.x;
      gesture.moved = Math.max(gesture.moved, Math.hypot(dx, e.clientY - gesture.y));
      car.dragMove(-dx / pxPerItem());
      const now = performance.now();
      gesture.samples.push({ x: e.clientX, t: now });
      while (gesture.samples.length > 2 && now - gesture.samples[0].t > 90) gesture.samples.shift();
      return;
    }
    if (!stage || !interactive() || e.pointerType !== 'mouse') return;
    const hit = stage.pick(e.clientX, e.clientY);
    stage.hover = hit;
    if (!hit) cursor && cursor.set('', '');
    else if (hit.kind === 'mini') cursor && cursor.set('open', t('cursor.read'));
    else if (hit.vis === mod(Math.round(car.pos), stage.nVis)) cursor && cursor.set('open', t('cursor.enter'));
    else cursor && cursor.set('pick', t('cursor.bring'));
    canvas.style.cursor = hit ? 'pointer' : '';
  });

  const endGesture = (e) => {
    if (!gesture.down || e.pointerId !== gesture.id) return;
    gesture.down = false;
    const dt = performance.now() - gesture.t;
    const s = gesture.samples;
    let vel = 0;
    if (s.length > 1) {
      const a = s[0];
      const b = s[s.length - 1];
      const span = Math.max(16, b.t - a.t);
      vel = (-(b.x - a.x) / span) * 1000 / pxPerItem();
    }
    if (performance.now() - (s[s.length - 1]?.t ?? 0) > 80) vel = 0;
    const isTap = gesture.moved < 7 && dt < 500 && e.type === 'pointerup';
    car.dragEnd(isTap ? 0 : vel, stage?.compact ? 1.6 : 3);
    if (isTap) {
      car.target = Math.round(car.pos);
      handleTap(e.clientX, e.clientY);
    }
    cursor && cursor.set('', '');
  };
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);

  function handleTap(x, y) {
    if (!stage) return;
    const hit = stage.pick(x, y);
    if (!hit) return;
    if (hit.kind === 'mini') navigate({ view: 'post', record: hit.parent, child: hit.index });
    else if (hit.vis === mod(Math.round(car.pos), stage.nVis) && Math.abs(car.pos - Math.round(car.pos)) < 0.25) navigate({ view: 'post', record: hit.index, child: null });
    else flyTo(hit.index, { vis: hit.vis });
  }

  addEventListener(
    'wheel',
    (e) => {
      if (app.view !== 'hero') return;
      e.preventDefault();
      if (!interactive()) return;
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 32;
      cancelFly();
      car.wheel(d);
    },
    { passive: false },
  );

  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
    if (app.view === 'post') {
      if (e.key === 'Escape') requestClose();
      return;
    }
    if (!interactive()) return;
    const onControl = e.target.closest && e.target.closest('button, a, input, textarea');
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      cancelFly();
      car.step(1);
      moveFocusWithActive(onControl);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      cancelFly();
      car.step(-1);
      moveFocusWithActive(onControl);
    } else if ((e.key === 'Enter' || e.key === ' ') && !onControl) {
      e.preventDefault();
      navigate({ view: 'post', record: activeIndex(), child: null });
    }
  });

  // keep keyboard focus on the timeline button of the record being shown
  function moveFocusWithActive(onControl) {
    if (!onControl || !onControl.closest('.tl')) return;
    requestAnimationFrame(() => {
      const i = mod(Math.round(car.target), n);
      ui.tlButtons[i]?.focus({ preventScroll: true });
    });
  }

  // mobile toolbars fire resize repeatedly while they slide; settle first
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stage && stage.resize();
      ui.measure();
    }, 120);
  });

  // --- loop -------------------------------------------------------------------
  let last = performance.now();
  let pending = 0; // time carried over from a skipped frame
  let lastInput = performance.now();
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach((ev) =>
    addEventListener(ev, () => (lastInput = performance.now()), { passive: true, capture: true }),
  );
  // frame-time watchdog: two slow seconds in a row step the scene down a quality tier
  const perf = { frames: 0, time: 0, slow: 0, since: 0 };
  function watch(dt) {
    if (app.view !== 'hero' || app.busy || dt > 0.2 || stage.tier === 0) return;
    perf.since += dt;
    if (perf.since < 1.5) return; // warm-up: shader compiles, texture uploads
    perf.frames++;
    perf.time += dt;
    if (perf.time < 1) return;
    const fps = perf.frames / perf.time;
    perf.slow = fps < 45 ? perf.slow + 1 : 0;
    perf.frames = perf.time = 0;
    if (perf.slow >= 2) {
      perf.slow = 0;
      perf.since = 0;
      stage.setTier(stage.tier - 1);
    }
  }

  let odd = false;
  function tick(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = Math.min(0.1, raw + pending);
    car.update(raw);
    syncActive();
    lastPos = car.pos;
    if (stage && !stage.paused && !stage.lost) {
      stage.pos = car.pos;
      stage.speed = car.speed;
      // on phones, a still scene redraws at half rate to save battery and heat
      odd = !odd;
      const resting = coarse && stage.idle && !car.dragging && now - lastInput > 1500;
      if (resting && odd) {
        pending = dt;
      } else {
        pending = 0;
        stage.update(dt);
        stage.render();
        if (!resting) watch(raw);
      }
      ui.frame(stage, car.pos);
    } else {
      ui.frame(null, car.pos);
    }
    cursor && cursor.frame(raw);
    requestAnimationFrame(tick);
  }

  syncActive(true);
  root.classList.add('ready');

  // warm the cache so a click dives straight in: every post, plus the map and hobbies code
  setTimeout(() => {
    records.forEach((r) => {
      loadPost(r.post, getLang());
      (r.children || []).forEach((c) => loadPost(c.post, getLang()));
    });
    import('./hobbies.js');
    import('./travel/travel.js');
  }, 1200);
  const initial = parseRoute(location.hash, records);
  app.depth = initial.view === 'post' ? -1 : 0;
  history.replaceState({ d: app.depth }, '', location.hash || location.pathname + location.search);
  if (initial.view === 'post') go(initial, true);
  requestAnimationFrame((t) => {
    last = t;
    tick(t);
  });
}

boot().catch((err) => {
  console.error(err);
  document.body.dataset.error = t('boot.error');
  document.documentElement.classList.add('boot-error');
});
