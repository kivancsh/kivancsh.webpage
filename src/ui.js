import gsap from 'gsap';
import { pad } from './color.js';
import { esc } from './markdown.js';
import { t } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);

// Swap the text of a masked line: the old line leaves one way, the new one arrives
// from the other, following the direction the exhibition moved.
function roll(container, text, dir, reduced) {
  const old = container.lastElementChild;
  if (old && old.textContent === text) return;
  const next = document.createElement('span');
  next.textContent = text;
  container.appendChild(next);
  if (!old || reduced) {
    if (old) old.remove();
    if (reduced) gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    return;
  }
  gsap.killTweensOf(old);
  gsap.fromTo(next, { yPercent: 105 * dir }, { yPercent: 0, duration: 0.85, ease: 'expo.out' });
  gsap.to(old, { yPercent: -105 * dir, duration: 0.6, ease: 'expo.out', onComplete: () => old.remove() });
  // never keep more than the outgoing + incoming line around
  while (container.children.length > 2) container.firstElementChild.remove();
}

export class HeroUI {
  constructor({ content, reduced, onSelect, onOpen, onOpenChild, onHoverChild }) {
    this.content = content;
    this.records = content.records;
    this.n = this.records.length;
    this.reduced = reduced;
    this.root = $('#hero');
    this.idxC = $('.idx-c', this.root);
    this.idxT = $('.idx-t', this.root);
    this.year = $('.hero-year .roll', this.root);
    this.name = $('.hero-name .roll', this.root);
    this.sub = $('.hero-sub .roll', this.root);
    this.live = $('#live');
    this.tl = $('.tl', this.root);
    this.needle = $('.tl-needle', this.root);
    this.caps = $('.minis-cap', this.root);
    this.strip = $('.minis-strip', this.root);
    this.openBtn = $('.hero-open', this.root);
    this.meta = $('.hero-meta', this.root);
    this.metaTop = -1;
    this.active = -1;
    this.capParent = -1;
    this.stripParent = -1;
    this.onOpenChild = onOpenChild;
    this.onHoverChild = onHoverChild;

    this.idxT.textContent = pad(this.n);
    this.buildTimeline();
    this.tl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const i = +b.dataset.i;
      if (i === this.active) onOpen();
      else onSelect(i);
    });
    this.tl.addEventListener('focusin', (e) => {
      const b = e.target.closest('button');
      if (b && +b.dataset.i !== this.active) onSelect(+b.dataset.i, { quiet: true });
    });
    this.openBtn.addEventListener('click', () => onOpen());
    const childClick = (e) => {
      const b = e.target.closest('button[data-c]');
      if (b) onOpenChild(+b.dataset.p, +b.dataset.c);
    };
    this.caps.addEventListener('click', childClick);
    this.strip.addEventListener('click', childClick);
    this.caps.addEventListener('pointerover', (e) => {
      const b = e.target.closest('button[data-c]');
      onHoverChild(b ? +b.dataset.c : -1);
    });
    this.caps.addEventListener('pointerleave', () => onHoverChild(-1));
  }

  buildTimeline() {
    this.tl.innerHTML = this.records
      .map((r, i) => `<li><button type="button" data-i="${i}" aria-label="${esc(t('a11y.record', { i: pad(i + 1), n: pad(this.n), name: r.name, years: r.years }))}">
          <span class="tl-tick"></span><span class="tl-y">${esc(String(r.years).split(/[–-]/)[0])}</span></button></li>`)
      .join('');
    this.tlButtons = [...this.tl.querySelectorAll('button')];
  }

  setActive(i, dir = 1) {
    const r = this.records[i];
    const kids = r.children?.length || 0;
    roll(this.year, String(r.years).replace(/[–-]/, ' — '), dir, this.reduced);
    roll(this.name, r.name, dir, this.reduced);
    roll(this.sub, kids ? t('hero.subKids', { k: kids }) : t('hero.sub'), dir, this.reduced);
    this.idxC.textContent = pad(i + 1);
    this.tlButtons.forEach((b, j) => b.toggleAttribute('aria-current', j === i));
    this.openBtn.setAttribute('aria-label', t('a11y.open', { name: r.name, years: r.years }));
    this.metaDirty = true;
    this.live.textContent = t('a11y.live', { i: pad(i + 1), n: pad(this.n), name: r.name, years: r.years }) + (kids ? t('a11y.liveKids', { k: kids }) : '');
    this.active = i;
  }

  // language changed: rebuild every string this class wrote
  relabel() {
    const focused = document.activeElement?.closest?.('.tl button')?.dataset.i;
    this.buildTimeline();
    if (focused != null) this.tlButtons[+focused]?.focus({ preventScroll: true });
    this.capParent = this.stripParent = -1;
    this.stripCalm = undefined;
    this.measure();
    if (this.active >= 0) this.setActive(this.active, 1);
  }

  buildChildren(pi) {
    const r = this.records[pi];
    const items = (r.children || []).map((c, ci) => ({ c, ci }));
    this.caps.innerHTML = items
      .map(({ c, ci }) => `<button type="button" data-p="${pi}" data-c="${ci}"><span class="mc-n">${pad(ci + 1)}</span><span class="mc-t">${esc(c.name)}</span></button>`)
      .join('');
    this.strip.innerHTML = items
      .map(({ c, ci }) => `<button type="button" data-p="${pi}" data-c="${ci}" style="--i:${ci}">
          <span class="vinyl vinyl--sm" style="--label:url(${c._labelURL})"></span>
          <span class="ms-n">${pad(ci + 1)}</span><span class="ms-t">${esc(c.label || c.name)}</span></button>`)
      .join('');
    this.capButtons = [...this.caps.children];
    this.few = items.length <= 4;
    this.caps.classList.toggle('few', this.few);
    this.strip.classList.toggle('few', items.length <= 4);
    this.capParent = this.stripParent = pi;
    this.stripCalm = undefined;
  }

  // layout reads happen here, on resize and after text changes, never every frame
  measure() {
    this.tlWidth = this.tl.clientWidth;
    this.metaDirty = true;
  }

  // per-frame: timeline needle, mini captions (desktop) and strip (compact)
  frame(stage, carouselPos) {
    if (this.tlWidth == null) this.measure();
    const f = ((carouselPos % this.n) + this.n) % this.n;
    const span = this.tlWidth / this.n;
    const x = f * span + span / 2;
    const wrapX = f > this.n - 0.5 ? (f - this.n) * span + span / 2 : x;
    const needle = `translate3d(${wrapX.toFixed(1)}px,0,0)`;
    if (needle !== this.needleT) this.needle.style.transform = this.needleT = needle;

    if (!stage) return;
    const M = stage.minis;
    const parent = M.parent;
    this.root.classList.toggle('has-minis', !stage.compact && M.cam > 0.4);
    if (!stage.compact) {
      if (parent >= 0 && parent !== this.capParent) this.buildChildren(parent);
      const show = parent >= 0 && M.reveal > 0.02 && stage.miniScreen.length;
      this.caps.classList.toggle('on', !!show);
      this.strip.classList.remove('on');
      if (show && this.capButtons) {
        stage.miniScreen.forEach((s, i) => {
          const b = this.capButtons[i];
          if (!b) return;
          b.style.transform = this.few
            ? `translate3d(${s.sx.toFixed(1)}px,${(s.sy - s.hover * 4).toFixed(1)}px,0) translate(${s.side < 0 ? '-100%' : '0'},-50%)`
            : `translate3d(${s.x.toFixed(1)}px,${(s.y + 6 - s.hover * 4).toFixed(1)}px,0) translateX(-50%)`;
          b.classList.toggle('to-left', this.few && s.side < 0);
          b.style.opacity = s.o.toFixed(3);
          const tab = s.o > 0.5 ? 0 : -1;
          if (b.tabIndex !== tab) b.tabIndex = tab;
        });
      }
    } else {
      this.caps.classList.remove('on');
      const a = stage.active;
      const has = !!this.records[a].children?.length;
      const calm = has && Math.abs(stage.pos - Math.round(stage.pos)) < 0.12 && stage.speed < 0.8 && !stage.diveTarget;
      if (has && a !== this.stripParent) this.buildChildren(a);
      // sit just above the title block, however many lines the title wraps to
      if (this.metaDirty) {
        this.metaDirty = false;
        const top = this.meta.getBoundingClientRect().top;
        this.strip.style.bottom = `${Math.round(innerHeight - top + 6)}px`;
      }
      if (calm !== this.stripCalm) {
        this.stripCalm = calm;
        this.strip.classList.toggle('on', calm);
        this.strip.querySelectorAll('button').forEach((b) => (b.tabIndex = calm ? 0 : -1));
      }
    }
  }

  hide() {
    this.root.classList.add('is-hidden');
    this.root.inert = true;
  }

  show() {
    this.root.classList.remove('is-hidden');
    this.root.inert = false;
  }
}

// Desktop cursor: a ring that says what a click will do.
export class Cursor {
  constructor() {
    this.el = document.querySelector('.cursor');
    this.label = this.el.querySelector('.cursor-t');
    this.x = this.tx = innerWidth / 2;
    this.y = this.ty = innerHeight / 2;
    this.state = '';
    document.documentElement.classList.add('has-cursor');
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.tx = e.clientX;
      this.ty = e.clientY;
      this.el.classList.add('on');
    });
    document.addEventListener('pointerleave', () => this.el.classList.remove('on'));
  }

  set(state, text = '') {
    if (state === this.state && this.label.textContent === text) return;
    this.state = state;
    this.el.dataset.state = state;
    this.label.textContent = text;
  }

  frame(dt) {
    const k = 1 - Math.exp(-dt * 22);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.el.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
  }
}
