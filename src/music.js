// Page soundtrack. Each page names a song; switching pages swaps it, and coming back to
// a page carries on from where its song was left. Browsers block sound until the
// visitor interacts, so playback starts on the first click / tap / key press.
//
// Spotify first: visitors logged in to Spotify in that browser hear the full song.
// Everyone else only gets Spotify's 30-second preview (cut from the middle of the song),
// so as soon as the embed reports a preview-length track the player switches to the
// song's official YouTube upload for the rest of the visit: full length, from the start,
// at the configured volume.
//
// Spotify songs are swapped by building a fresh embed rather than controller.loadUri():
// loadUri navigates the iframe, which adds entries to the page's history, so the
// browser's back button would rewind the player instead of leaving the blog page.
import { t } from './i18n.js';

const PREVIEW_MAX = 31000;
const YT = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

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
  constructor({ el, track, volume = 50, onChange }) {
    this.el = el;
    this.frame = el.querySelector('.np-frame');
    this.ytHost = el.querySelector('.np-yt');
    this.btn = el.querySelector('.np-btn');
    this.volume = volume;
    this.onChange = onChange || (() => {});
    this.mode = 'spotify';
    this.track = track;
    this.playing = false;
    this.userPaused = false;
    this.interacted = false;
    this.pending = false;
    // where each song was left (ms), per song
    this.positions = new Map();

    // spotify
    this.sp = null;
    this.spApi = null;
    this.gen = 0;
    this.last = { position: 0, duration: 0 };
    this.resumeAt = 0;
    this.seeking = false;

    // youtube
    this.yt = null;
    this.ytReady = false;
    this.ytSwitching = false;

    this.el.dataset.mode = 'spotify';
    this.setLabel(track);
    if (track?.spotify) this.loadSpotify();
    else if (track?.youtube) this.toYouTube();

    this.btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    const kick = () => {
      this.interacted = true;
      if (!this.userPaused && !this.playing) this.play();
    };
    ['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, kick, { capture: true, passive: true }));
    setInterval(() => this.poll(), 500);
  }

  key(track = this.track) {
    return track ? track.spotify || track.youtube : '';
  }

  // where a song begins when it hasn't been heard yet: `start` (seconds) skips a silent intro
  startMs(track = this.track) {
    return (track?.start || 0) * 1000;
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
    this.el.classList.toggle('is-playing', v);
    this.btn?.setAttribute('aria-pressed', String(v));
    this.relabel();
    this.onChange(v);
  }

  relabel() {
    this.btn?.setAttribute('aria-label', this.playing ? t('music.pause') : t('music.play'));
  }

  play() {
    if (this.mode === 'youtube') return this.ytPlay();
    if (!this.sp) {
      this.pending = true;
      return;
    }
    this.sp.play();
  }

  toggle() {
    if (this.playing) {
      this.userPaused = true;
      if (this.mode === 'youtube') this.yt?.pauseVideo();
      else this.sp?.pause();
    } else {
      this.userPaused = false;
      this.interacted = true;
      this.play();
    }
  }

  // the page changed: swap the song, keep playing if the visitor hadn't paused
  setTrack(track) {
    if (!track || this.key(track) === this.key()) return;
    this.savePosition();
    this.track = track;
    this.setLabel(track);
    this.pending = this.interacted && !this.userPaused;
    if (this.mode === 'youtube') this.ytLoad();
    else {
      this.setPlaying(false);
      this.mountSpotify();
    }
  }

  savePosition() {
    if (this.mode === 'youtube') {
      if (this.ytReady && !this.ytSwitching) this.positions.set(this.key(), this.yt.getCurrentTime() * 1000);
    } else if (this.last.duration > 0 && !this.seeking) {
      this.positions.set(this.key(), this.last.position);
    }
  }

  poll() {
    if (this.mode === 'youtube' && this.playing && this.ytReady && !this.ytSwitching) {
      this.positions.set(this.key(), this.yt.getCurrentTime() * 1000);
    }
  }

  // ---- spotify ------------------------------------------------------------------

  loadSpotify() {
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      prev && prev(api);
      this.spApi = api;
      if (this.mode === 'spotify') this.mountSpotify();
    };
    const go = () => loadScript('https://open.spotify.com/embed/iframe-api/v1').catch(() => this.toYouTube());
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
    this.spApi.createController(host, { uri: this.track.spotify, width: '100%', height: 80 }, (c) => {
      if (gen !== this.gen) return c.destroy();
      this.sp = c;
      c.addListener('ready', () => {
        if (gen !== this.gen) return;
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
    // a 30-second preview means the visitor isn't logged in to Spotify
    if (duration > 0 && duration < PREVIEW_MAX && this.track?.youtube) return this.toYouTube();
    const c = this.sp;
    const ended = duration > 0 && this.last.position > duration - 1500;
    const wasPlaying = this.playing;
    this.setPlaying(!isPaused && !isBuffering);
    if (!isPaused && !isBuffering) {
      this.userPaused = false;
      if (this.seeking) {
        this.seeking = false;
        if (Math.abs(position - this.resumeAt) > 1500) {
          c.seek(this.resumeAt / 1000);
          this.last = { position: this.resumeAt, duration };
          return;
        }
      }
      if (duration > 0) this.positions.set(this.key(), position);
    } else if (isPaused && !isBuffering && wasPlaying) {
      if (ended && !this.userPaused) {
        this.positions.set(this.key(), this.startMs());
        c.seek(this.startMs() / 1000);
        c.play();
      } else if (this.interacted) {
        this.userPaused = true; // paused from the embed's own button
      }
    }
    this.last = { position, duration };
  }

  // ---- youtube ------------------------------------------------------------------

  toYouTube() {
    if (this.mode === 'youtube') return;
    this.mode = 'youtube';
    this.el.dataset.mode = 'youtube';
    this.destroySpotify();
    this.setPlaying(false);
    // positions so far belonged to preview clips: every song starts from its beginning
    this.positions.clear();
    this.pending = this.interacted && !this.userPaused;
    const make = () => {
      this.yt = new window.YT.Player(this.ytHost, {
        width: '100%',
        height: '100%',
        videoId: this.track.youtube,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, start: Math.floor(this.startMs() / 1000) },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.el.dataset.state = 'ready';
            this.yt.setVolume(this.volume);
            if (this.pending) this.ytPlay();
          },
          onStateChange: (e) => this.ytState(e.data),
          onError: () => (this.el.dataset.state = 'error'),
        },
      });
    };
    if (window.YT?.Player) return make();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev && prev();
      make();
    };
    loadScript('https://www.youtube.com/iframe_api').catch(() => (this.el.dataset.state = 'error'));
  }

  ytState(s) {
    if (s === YT.PLAYING) {
      this.ytSwitching = false;
      this.userPaused = false;
      this.setPlaying(true);
    } else if (s === YT.PAUSED) {
      if (!this.ytSwitching && this.interacted) this.userPaused = true;
      this.setPlaying(false);
    } else if (s === YT.CUED) {
      this.ytSwitching = false;
      this.setPlaying(false);
    } else if (s === YT.ENDED) {
      // round again from the top
      this.positions.set(this.key(), this.startMs());
      if (!this.userPaused) {
        this.yt.seekTo(this.startMs() / 1000, true);
        this.yt.playVideo();
      }
    }
  }

  ytPlay() {
    if (!this.ytReady) {
      this.pending = true;
      return;
    }
    this.pending = false;
    this.yt.unMute();
    this.yt.setVolume(this.volume);
    this.yt.playVideo();
  }

  // swap the video inside the same player (no iframe navigation, no history entries)
  ytLoad() {
    if (!this.ytReady) return;
    this.ytSwitching = true;
    const opts = { videoId: this.track.youtube, startSeconds: this.resumeMs() / 1000 };
    if (this.pending) {
      this.pending = false;
      this.yt.loadVideoById(opts);
      this.yt.setVolume(this.volume);
    } else {
      this.yt.cueVideoById(opts);
    }
  }
}
