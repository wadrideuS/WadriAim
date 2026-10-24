import { read, save } from '../lib/storage.js';
import { decorateVolumeField } from '../features/volume-field.js';
import { createMusicControl } from './MusicControl.js';

/**
 * Internet radio by genre via the free, keyless Radio Browser API
 * (https://www.radio-browser.info). Only HTTPS streams are used.
 */
export const radioGenres = {
  synth: { label: 'Ambiental WadriAim', tags: [] },
  electro: { label: 'Electro', tags: ['electronic', 'edm', 'electro'] },
  pop: { label: 'Pop', tags: ['pop', 'top 40', 'hits'] },
  chill: { label: 'Chill · Lo-fi', tags: ['lofi', 'chillout', 'chill'] },
  synthwave: { label: 'Synthwave', tags: ['synthwave', 'retrowave'] },
  dance: { label: 'Dance · House', tags: ['house', 'dance'] },
  ambient: { label: 'Ambient', tags: ['ambient'] },
};
const radioServers = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];
async function findStations(tags) {
  for (const server of radioServers.slice().sort(() => Math.random() - 0.5)) {
    try {
      const found = [];
      for (const tag of tags) {
        const query = new URLSearchParams({ tag, hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: '25' });
        const response = await fetch(`${server}/json/stations/search?${query}`, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw Error('radio ' + response.status);
        found.push(...(await response.json()));
      }
      const seen = new Set();
      return found.filter((station) => {
        const url = station.url_resolved || station.url;
        if (!url?.startsWith('https://') || seen.has(url) || !/mp3|aac|ogg/i.test(station.codec || 'mp3')) return false;
        seen.add(url);
        return true;
      });
    } catch {}
  }
  return [];
}
/** A quiet original ambient pad. Starts only after a user gesture. */
export class AmbientMusic {
  constructor() {
    this.volume = read('wa-music-volume', 0.08);
    this.enabled = read('wa-music-enabled', true);
    this.ducked = false;
    this.started = false;
    this.nodes = new Set();
    this.abort = new AbortController();
    this.id = crypto.randomUUID();
    this.owner = true;
    this.channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel('wadriaim-music') : null;
    if (this.channel)
      this.channel.onmessage = (e) => {
        if (e.data?.type === 'playing' && e.data.id !== this.id) {
          this.owner = false;
          this.context?.suspend();
          this.radio?.pause();
        }
      };
    this.genre = radioGenres[read('wa-music-genre', 'synth')] ? read('wa-music-genre', 'synth') : 'synth';
    this.control = createMusicControl({
      genres: radioGenres,
      genre: this.genre,
      onToggle: () => this.setEnabled(!this.enabled),
      onGenre: (id) => this.setGenre(id),
      onSkip: () => this.skipStation(),
    });
    this.button = this.control.button;
    this.genreSelect = this.control.genreSelect;
    this.updateLabel();
    this.setStatus('');
    document.querySelector('header>div').prepend(this.control.root);
    this.radio = new Audio();
    this.radio.preload = 'none';
    this.radio.onerror = () => {
      if (this.genre !== 'synth') this.nextStation();
    };
    this.stations = [];
    this.stationIndex = -1;
    const label = document.createElement('label');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '30';
    slider.value = String(this.volume * 100);
    slider.setAttribute('aria-label', 'Volumen de música de fondo');
    slider.oninput = () => {
      this.volume = Number(slider.value) / 100;
      save('wa-music-volume', this.volume);
      this.updateGain();
    };
    decorateVolumeField(label, slider, 'music', 'Música de fondo');
    const form = document.getElementById('form');
    form.insertBefore(label, form.querySelector('button.primary'));
    this.volumeControl = label;
    document.addEventListener(
      'pointerdown',
      () => {
        if (this.enabled) this.start();
      },
      { once: true, signal: this.abort.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.context?.suspend(); // radio keeps playing in the background
        else if (this.enabled && this.started) this.start();
      },
      { signal: this.abort.signal },
    );
  }
  updateLabel() {
    this.control.setPlaying(this.enabled);
  }
  setStatus(text, title = text) {
    const label = text || (this.genre === 'synth' ? 'Ambiente original' : 'Radio en espera');
    this.control.setStatus(label, title || label);
    this.control.setSkipAvailable(this.genre !== 'synth');
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    save('wa-music-enabled', enabled);
    this.updateLabel();
    if (enabled) return this.start();
    this.context?.suspend();
    this.radio.pause();
  }
  skipStation() {
    if (!this.enabled) {
      this.enabled = true;
      save('wa-music-enabled', true);
      this.updateLabel();
    }
    return this.nextStation();
  }
  async setGenre(id) {
    this.genre = radioGenres[id] ? id : 'synth';
    save('wa-music-genre', this.genre);
    this.stations = [];
    this.stationIndex = -1;
    this.radio.pause();
    this.setStatus('');
    if (this.enabled) await this.start();
  }
  async nextStation() {
    if (this.genre === 'synth') return;
    const genre = this.genre;
    if (!this.stations.length) {
      this.setStatus('Buscando emisoras…');
      const found = await findStations(radioGenres[genre].tags);
      if (genre !== this.genre) return;
      this.stations = found.sort(() => Math.random() - 0.5);
      this.stationIndex = -1;
      if (!this.stations.length) {
        this.genre = 'synth';
        this.genreSelect.value = 'synth';
        this.setStatus('Sin conexión con la radio · ambiental');
        return this.start();
      }
    }
    this.stationIndex = (this.stationIndex + 1) % this.stations.length;
    const station = this.stations[this.stationIndex];
    this.radio.src = station.url_resolved || station.url;
    this.updateGain();
    this.setStatus('♪ ' + station.name.trim(), station.name.trim());
    if (!this.enabled) return;
    try {
      await this.radio.play();
    } catch {
      if (this.radio.paused && this.enabled) this.setStatus('No suena · prueba «Otra emisora»');
    }
  }
  async start() {
    if (!this.enabled) return;
    if (this.genre !== 'synth') {
      this.context?.suspend();
      this.owner = true;
      this.channel?.postMessage({ type: 'playing', id: this.id });
      this.started = true;
      if (this.radio.src && this.stations.length) {
        this.updateGain();
        await this.radio.play().catch(() => {});
      } else await this.nextStation();
      return;
    }
    this.radio.pause();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      this.context = new Audio();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      this.next = this.context.currentTime + 0.08;
      this.chord = 0;
      this.timer = setInterval(() => this.schedule(), 500);
    }
    this.owner = true;
    this.channel?.postMessage({ type: 'playing', id: this.id });
    await this.context.resume();
    if (!this.enabled) return this.context.suspend();
    this.started = true;
    this.updateGain();
    this.schedule();
  }
  updateGain() {
    // stations are mastered loud: 0–30 % slider maps to a usable range
    if (this.radio) this.radio.volume = Math.min(1, this.volume * 2.4 * (this.ducked ? 0.45 : 1));
    if (this.gain)
      this.gain.gain.setTargetAtTime(
        this.volume * (this.ducked ? 0.32 : 1),
        this.context.currentTime,
        0.65,
      );
  }
  duck(active) {
    this.ducked = active;
    this.updateGain();
  }
  schedule() {
    if (!this.context || !this.enabled || !this.owner || this.context.state !== 'running') return;
    const progression = [
      [146.83, 174.61, 220, 261.63],
      [130.81, 164.81, 196, 246.94],
      [110, 130.81, 164.81, 196],
      [116.54, 146.83, 174.61, 220],
    ];
    while (this.next < this.context.currentTime + 1) {
      const notes = progression[this.chord++ % progression.length],
        time = Math.max(this.next, this.context.currentTime + 0.02);
      for (const [i, note] of notes.entries()) {
        const osc = this.context.createOscillator(),
          env = this.context.createGain(),
          filter = this.context.createBiquadFilter(),
          pan = this.context.createStereoPanner();
        osc.type = 'sine';
        osc.frequency.value = note;
        osc.detune.value = i % 2 ? 3 : -3;
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(0.085, time + 2.0);
        env.gain.setTargetAtTime(0.0001, time + 6, 1.2);
        pan.pan.value = (i - 1.5) * 0.25;
        osc.connect(filter).connect(env).connect(pan).connect(this.gain);
        this.nodes.add(osc);
        osc.onended = () => this.nodes.delete(osc);
        osc.start(time);
        osc.stop(time + 10);
      }
      this.next = time + 8;
    }
  }
  dispose() {
    clearInterval(this.timer);
    this.abort.abort();
    this.channel?.close();
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {}
    });
    this.context?.close();
    this.radio.pause();
    this.radio.src = '';
    this.control.dispose();
    this.volumeControl.remove();
  }
}
