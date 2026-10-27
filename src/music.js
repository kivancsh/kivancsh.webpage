// Page soundtrack, played through Spotify's own embed. Each page names a song; switching
// pages swaps it, and coming back to a page carries on from where its song was left.
// Browsers block sound until the visitor interacts, so playback starts on the first
// click / tap / key press.
//
// Visitors logged in to Spotify in that browser hear the full song. Everyone else hears
// Spotify's 30-second preview, looped. There is no other source: if Spotify cannot be
// reached, the player hides itself and the page carries on without music.
//
// On phones the player folds into a small round button in the header; tapping it opens
// the player underneath. The embed stays mounted (only out of sight) so it keeps playing.
//
// Songs are swapped by building a fresh embed rather than controller.loadUri(): loadUri
// navigates the iframe, which (in Chrome) adds entries to the page's history, so the
// browser's back button would rewind the player instead of leaving the blog page.
//
// Safari and every iPhone/iPad browser (WebKit) only let Spotify start a song after a tap
// inside Spotify's own player, not on our page. So there, whenever a song should be
// playing but isn't, the small player opens by itself with Spotify's play button showing:
// one tap and the music goes on.
import { t } from './i18n.js';

const PREVIEW_MAX = 31000; // a track this short is Spotify's preview, not the song
const GIVE_UP = 12000; // no working player by then: hide it
const UA = navigator.userAgent;
const WEBKIT = /AppleWebKit/.test(UA) && !/Chrome|Chromium|Edg|OPR|SamsungBrowser|Android/.test(UA);

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

export class Music {
  constructor({ el, track, onChange }) {
    this.el = el;
    this.frame = el.querySelector('.np-frame');
    this.pill = el.querySelector('.np-pill');
    this.open = false;
    this.onChange = onChange || (() => {});
    this.track = track;
    this.playing = false;
    this.userPaused = false;
    this.interacted = false;
    this.pending = false;
    // where each song was left (ms), per song; previews are remembered separately
    this.positions = new Map();
    this.previews = new Set();

    this.sp = null;
    this.spApi = null;
    this.gen = 0;
    this.last = { position: 0, duration: 0 };
    this.resumeAt = 0;
    this.seeking = false;

    this.setLabel(track);
    if (track?.spotify) this.loadSpotify();
    else this.fail();

    this.pill?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });
    document.addEventListener('pointerdown', (e) => this.open && !this.el.contains(e.target) && this.setOpen(false));
    // touching the player itself keeps it open
    this.el.addEventListener('pointerdown', () => clearTimeout(this.foldTimer));
    addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !this.open) return;
        e.preventDefault(); // closes the player only, not the article behind it
        this.setOpen(false);
      },
      true,
    );
    const kick = () => {
      this.interacted = true;
      if (this.userPaused || this.playing) return;
      this.play();
      this.offerPlay();
    };
    ['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, kick, { capture: true, passive: true }));
    // at the end of a song (or preview) Spotify just goes quiet, without a "paused"
    // report: notice the silence at the very end and go round again
    setInterval(() => {
      const { position, duration } = this.last;
      if (this.sp && this.playing && !this.userPaused && duration > 0 && position > duration - 1500 && performance.now() - this.lastUpdate > 1200) this.restart();
    }, 1000);
  }

  restart() {
    const from = this.startMs();
    this.positions.set(this.key(), from);
    this.last = { position: from, duration: this.last.duration };
    this.lastUpdate = performance.now();
    this.sp.seek(from / 1000);
    this.sp.play();
  }

  // Safari / iPhone: if the song could not start by itself, open the player so Spotify's
  // play button is right there (Spotify may still be loading: keep checking a while)
  offerPlay() {
    if (!WEBKIT) return;
    clearTimeout(this.helpTimer);
    let tries = 0;
    const help = () => {
      if (this.playing || this.userPaused || this.open || this.el.dataset.state === 'error') return;
      if (this.el.dataset.state !== 'ready' || !this.sp) {
        if (++tries < 20) this.helpTimer = setTimeout(help, 600);
        return;
      }
      this.autoOpened = true;
      this.setOpen(true);
    };
    this.helpTimer = setTimeout(help, 2000);
  }

  key(track = this.track) {
    return track?.spotify || '';
  }

  // where a song begins when it hasn't been heard yet: `start` (seconds) skips a silent
  // intro. A preview is already a cut from the middle of the song, so it starts at 0.
  startMs(track = this.track) {
    return this.previews.has(this.key(track)) ? 0 : (track?.start || 0) * 1000;
  }

  resumeMs() {
    return this.positions.has(this.key()) ? this.positions.get(this.key()) : this.startMs();
  }

  // ---- shared -----------------------------------------------------------------

  setLabel(track) {
    if (!track) return;
    this.el.querySelectorAll('[data-music-title]').forEach((n) => (n.textContent = track.title || ''));
    this.el.querySelectorAll('[data-music-artist]').forEach((n) => (n.textContent = track.artist || ''));
  }

  setPlaying(v) {
    if (v === this.playing) return;
    this.playing = v;
    // the player opened itself to show Spotify's play button: tuck it away once playing
    if (v && this.autoOpened) {
      this.autoOpened = false;
      clearTimeout(this.foldTimer);
      this.foldTimer = setTimeout(() => this.playing && this.setOpen(false), 2500);
    }
    this.el.classList.toggle('is-playing', v);
    this.relabel();
    this.onChange(v);
  }

  relabel() {
    this.pill?.setAttribute('aria-label', `${this.open ? t('music.close') : t('music.open')} · ${this.track?.title || ''}`);
  }

  setOpen(v) {
    clearTimeout(this.foldTimer);
    // a gentle peek: once the song is on, the player tucks itself away again
    if (v) this.foldTimer = setTimeout(() => this.playing && this.setOpen(false), 4000);
    this.open = v;
    this.el.classList.toggle('is-open', v);
    this.pill?.setAttribute('aria-expanded', String(v));
    this.relabel();
  }

  // Spotify is out of reach (blocked network, extension, outage): no player at all
  fail() {
    this.el.dataset.state = 'error';
    this.setOpen(false);
    this.setPlaying(false);
  }

  // give the embed a while to come up; a late one still wins (see 'ready')
  watchdog() {
    clearTimeout(this.giveUp);
    this.giveUp = setTimeout(() => this.el.dataset.state !== 'ready' && this.fail(), GIVE_UP);
  }

  play() {
    if (!this.sp) {
      this.pending = true;
      return;
    }
    this.sp.play();
  }

  // the page changed: swap the song, keep playing if the visitor hadn't paused
  setTrack(track) {
    if (!track || this.key(track) === this.key()) return;
    this.savePosition();
    this.track = track;
    this.setLabel(track);
    this.relabel();
    this.pending = this.interacted && !this.userPaused;
    this.setPlaying(false);
    this.mountSpotify();
    if (this.pending) this.offerPlay();
  }

  savePosition() {
    if (this.last.duration > 0 && !this.seeking) this.positions.set(this.key(), this.last.position);
  }

  // ---- spotify ------------------------------------------------------------------

  loadSpotify() {
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      prev && prev(api);
      this.spApi = api;
      this.mountSpotify();
    };
    const go = () => {
      this.watchdog();
      loadScript('https://open.spotify.com/embed/iframe-api/v1').catch(() => this.fail());
    };
    // the embed is heavy; wait for the first frames (or the first interaction) before loading it
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      go();
    };
    setTimeout(start, 1500);
    addEventListener('pointerdown', start, { once: true, capture: true, passive: true });
  }

  destroySpotify() {
    this.gen++;
    if (this.sp) {
      try {
        this.sp.pause();
        this.sp.destroy();
      } catch {
        /* already gone */
      }
    }
    this.sp = null;
    this.frame.querySelectorAll('iframe, .np-sp').forEach((n) => n.remove());
  }

  // a fresh embed for the current song; events from older embeds are ignored
  mountSpotify() {
    if (!this.spApi || !this.track?.spotify) return;
    this.destroySpotify();
    const gen = this.gen;
    const host = document.createElement('div');
    host.className = 'np-sp';
    this.frame.appendChild(host);
    this.resumeAt = this.resumeMs();
    this.seeking = this.resumeAt > 1500;
    this.last = { position: 0, duration: 0 };
    if (this.el.dataset.state !== 'ready') this.watchdog();
    this.spApi.createController(host, { uri: this.track.spotify, width: '100%', height: 80 }, (c) => {
      if (gen !== this.gen) return c.destroy();
      this.sp = c;
      c.addListener('ready', () => {
        if (gen !== this.gen) return;
        clearTimeout(this.giveUp);
        this.el.dataset.state = 'ready';
        if (this.pending) {
          this.pending = false;
          c.play();
        }
      });
      c.addListener('playback_update', (e) => gen === this.gen && this.spUpdate(e.data));
    });
  }

  spUpdate({ isPaused, isBuffering, position, duration }) {
    const c = this.sp;
    this.lastUpdate = performance.now();
    // not logged in to Spotify: this is the 30-second preview, which has no silent intro
    if (duration > 0 && duration < PREVIEW_MAX && !this.previews.has(this.key())) {
      this.previews.add(this.key());
      if (!this.positions.has(this.key())) this.resumeAt = 0;
      this.seeking = this.resumeAt > 1500;
    }
    const ended = duration > 0 && this.last.position > duration - 1500;
    const wasPlaying = this.playing;
    this.setPlaying(!isPaused && !isBuffering);
    if (!isPaused && !isBuffering) {
      this.userPaused = false;
      if (this.seeking) {
        this.seeking = false;
        if (Math.abs(position - this.resumeAt) > 1500 && this.resumeAt < duration - 2000) {
          c.seek(this.resumeAt / 1000);
          this.last = { position: this.resumeAt, duration };
          return;
        }
      }
      if (duration > 0) this.positions.set(this.key(), position);
    } else if (isPaused && !isBuffering && wasPlaying) {
      if (ended && !this.userPaused) {
        this.restart(); // round again from the top (a preview loops)
        return;
      } else if (this.interacted) {
        this.userPaused = true; // paused from the embed's own button
      }
    }
    this.last = { position, duration };
  }
}
