import gsap from 'gsap';
import { loadPost } from './content.js';
import { renderMarkdown, renderInline, esc } from './markdown.js';
import { compactYears } from './labels.js';
import { hashFor } from './router.js';
import { t, getLang } from './i18n.js';
import { contactLinks } from './contact.js';

const $ = (s, r = document) => r.querySelector(s);

function splitWords(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => `<span class="w"><span style="--i:${i}">${esc(w)}</span></span>`)
    .join(' ');
}

export class Post {
  constructor({ content, reduced, onClose }) {
    this.content = content;
    this.records = content.records;
    this.reduced = reduced;
    this.el = $('#post');
    this.scroller = $('.post-scroll', this.el);
    this.inner = $('.post-inner', this.el);
    this.ring = $('.ring-arc', this.el);
    this.ringT = $('.ring-t', this.el);
    this.ringLen = 2 * Math.PI * 22;
    this.ring.style.strokeDasharray = `${this.ringLen}`;
    $('.post-close', this.el).addEventListener('click', onClose);
    $('.ring', this.el).addEventListener('click', () => this.scroller.scrollTo({ top: 0, behavior: this.reduced ? 'auto' : 'smooth' }));
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        e.preventDefault();
        onClose();
      }
    });
    this.scroller.addEventListener('scroll', () => this.queue(), { passive: true });
    addEventListener('resize', () => this.queue());
    this.io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add('in'), this.io.unobserve(en.target))),
      { root: this.scroller, rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
  }

  info(route) {
    const r = this.records[route.record];
    const child = route.child != null ? r.children[route.child] : null;
    return { r, child, accent: child ? child._color : r.accent };
  }

  async prepare(route) {
    const { r, child, accent } = this.info(route);
    const { meta, body } = await loadPost((child || r).post, getLang());
    this.teardown();
    this.inner.innerHTML = this.template(route, r, child, meta, body);
    this.el.style.setProperty('--pa', accent);
    this.scroller.scrollTop = 0;
    this.figures = [...this.inner.querySelectorAll('.fig-inner')];
    this.inner.querySelectorAll('.rv').forEach((n) => this.io.observe(n));
    await this.enhance(meta, accent);
    this.update();
    return accent;
  }

  // same page in another language, keeping the reader's place
  async rerender(route) {
    const s = this.scroller;
    const ratio = s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight);
    const accent = await this.prepare(route);
    s.scrollTop = ratio * (s.scrollHeight - s.clientHeight);
    this.update();
    return accent;
  }

  teardown() {
    (this.cleanups || []).forEach((f) => f && f());
    this.cleanups = [];
  }

  // page-specific pieces: counters, the travel map, the photo ring, the hobbies chapters
  async enhance(meta, accent) {
    const article = this.inner.querySelector('.pb');
    const opts = { reduced: this.reduced, scroller: this.scroller, postEl: this.el, accent, base: import.meta.env.BASE_URL || './' };
    if (meta.layout === 'hobbies') {
      const { mountHobbies } = await import('./hobbies.js');
      this.cleanups.push(mountHobbies(article, this.el, opts));
    }
    const maps = [...this.inner.querySelectorAll('.travel')];
    if (maps.length) {
      const { mountTravel } = await import('./travel/travel.js');
      maps.forEach((m) => mountTravel(m, opts).then((off) => this.cleanups.push(off)).catch((e) => console.warn(e)));
    }
    const sphere = this.inner.querySelector('.logo-sphere');
    if (sphere) {
      const { mountLogoSphere } = await import('./logosphere.js');
      this.cleanups.push(mountLogoSphere(sphere, opts));
    }
    const rings = [...this.inner.querySelectorAll('.ring-gallery')];
    if (rings.length) {
      const { mountRing } = await import('./gallery.js');
      rings.forEach((r) => this.cleanups.push(mountRing(r, opts)));
    }
    const nums = [...this.inner.querySelectorAll('.stat-v')];
    if (nums.length) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const m = en.target.dataset.v.match(/^(\d+)(.*)$/);
          if (!m || this.reduced) return;
          const o = { v: 0 };
          gsap.to(o, { v: +m[1], duration: 1.6, ease: 'power2.out', onUpdate: () => (en.target.textContent = Math.round(o.v) + m[2]) });
        }),
        { root: this.scroller, threshold: 0.6 },
      );
      nums.forEach((n) => {
        const m = n.dataset.v.match(/^(\d+)(.*)$/);
        if (m && !this.reduced) n.textContent = `0${m[2]}`;
        io.observe(n);
      });
      this.cleanups.push(() => io.disconnect());
    }
  }

  template(route, r, child, meta, body) {
    const i = route.record;
    const title = meta.title || (child || r).name;
    const kids = r.children || [];
    const label = child ? child._labelURL : r._labelURL;

    let tracks = '';
    if (!child && kids.length) {
      tracks = `<section class="tracks" aria-labelledby="tracks-h">
        <h2 class="tracks-h rv" id="tracks-h">${t('post.tracks')}</h2>
        <ol class="tracks-l">${kids
          .map((c, ci) => `<li class="rv" style="--i:${ci}"><a href="${hashFor({ view: 'post', record: i, child: ci }, this.records)}">
            <span class="vinyl vinyl--xs" style="--label:url(${c._labelURL})"></span>
            <span class="t-name">${esc(c.name)}</span><span class="t-go">${t('post.read')}</span></a></li>`)
          .join('')}</ol></section>`;
    }

    // two ways out: carry on to the next page, or go back to the records
    let next;
    if (child) {
      const nc = (route.child + 1) % kids.length;
      next = { route: { view: 'post', record: i, child: nc }, k: t('post.nextTrack'), t: kids[nc].name, l: kids[nc]._labelURL };
    } else {
      const n = this.records.length;
      const ni = (i + 1) % n;
      const nr = this.records[ni];
      next = { route: { view: 'post', record: ni, child: null }, k: t('post.nextRecord'), t: nr.name, y: nr.years, l: nr._labelURL, a: nr.accent };
    }

    return `
      <header class="ph">
        <div class="ph-year${compactYears(r.years).length > 7 ? ' ph-year--long' : ''}" aria-hidden="true"><span>${esc(compactYears(r.years))}</span></div>
        <div class="ph-disc" aria-hidden="true"><div class="vinyl vinyl--lg spin" style="--label:url(${label})"></div><div class="vinyl-sheen"></div></div>
        <h1 class="ph-title" tabindex="-1">${splitWords(title)}</h1>
        ${meta.lede ? `<p class="ph-lede">${renderInline(meta.lede)}</p>` : ''}
      </header>
      <article class="pb">${renderMarkdown(body)}</article>
      ${tracks}
      <footer class="pf">
        <section class="pf-contact rv" aria-labelledby="pfc-h">
          <h2 class="pf-ch" id="pfc-h">${t('contact.title')}</h2>
          <p class="pf-cl">${t('contact.lede')}</p>
          <div class="pf-cx">${contactLinks(this.content.site.contact, { long: true })}</div>
        </section>
        <div class="pf-out">
          <a class="pf-card pf-next" href="${hashFor(next.route, this.records)}"${next.a ? ` style="--ca:${next.a}"` : ''}>
            <span class="pf-k">${next.k}</span>
            <span class="vinyl vinyl--md" style="--label:url(${next.l})"></span>
            ${next.y ? `<span class="pf-y">${esc(next.y)}</span>` : ''}<span class="pf-t">${esc(next.t)}</span></a>
          <button type="button" class="pf-back" data-close><span class="vinyl vinyl--xs" style="--label:url(${r._labelURL})"></span>${t('post.back')}</button>
        </div>
      </footer>`;
  }

  queue() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.update();
    });
  }

  update() {
    const s = this.scroller;
    const max = Math.max(1, s.scrollHeight - s.clientHeight);
    const p = Math.min(1, s.scrollTop / max);
    this.ring.style.strokeDashoffset = `${this.ringLen * (1 - p)}`;
    this.ringT.textContent = `${Math.round(p * 100)}`;
    if (this.reduced || !this.figures) return;
    const vh = s.clientHeight;
    for (const f of this.figures) {
      const r = f.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const c = (r.top + r.height / 2 - vh / 2) / vh;
      f.style.transform = `translate3d(0,${(c * -9).toFixed(2)}%,0)`;
    }
  }

  // visible behind the canvas, waiting for the portal to open
  open() {
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.inert = false;
  }

  reveal() {
    this.el.classList.add('is-in');
  }

  focus() {
    const h = $('.ph-title', this.el);
    h && h.focus({ preventScroll: true });
  }

  leave() {
    this.el.classList.add('is-leaving');
  }

  close() {
    this.el.classList.remove('is-open', 'is-in', 'is-leaving');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.inert = true;
  }

  async swap(route) {
    const out = this.reduced ? 0.2 : 0.35;
    this.el.classList.add('is-swapping');
    await new Promise((res) => gsap.to(this.inner, { opacity: 0, y: -20, duration: out, ease: 'power2.in', onComplete: res }));
    this.el.classList.remove('is-in');
    const accent = await this.prepare(route);
    gsap.set(this.inner, { opacity: 1, y: 0 });
    this.el.classList.remove('is-swapping');
    void this.inner.offsetWidth;
    this.reveal();
    this.focus();
    return accent;
  }
}
