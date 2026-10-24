import soundPacks from '../data/sound-packs.json' with { type: 'json' };
/** User-provided samples with synthesized fallbacks. Each shot owns its natural audio tail. */
export class WeaponAudio {
  constructor() {
    this.volume = 0.35;
    this.muted = false;
    this.context = null;
    this.sources = new Set();
    this.buffers = new Map();
  }
  async unlock() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context = new Audio({latencyHint:'interactive'});
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;
      this.master.connect(this.compressor).connect(this.context.destination);
      const count = this.context.sampleRate;
      this.noise = this.context.createBuffer(1, count, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  async prime(id) {
    if (!this.context) return;
    await Promise.all(
      [
        ...Object.entries(soundPacks[id] || {}).map(([kind, path]) => [id, kind, path]),
        ...Object.entries(soundPacks.shared || {}).map(([kind, path]) => ['shared', kind, path]),
      ].map(async ([owner, kind, path]) => {
        if (!path || this.buffers.has(owner + kind)) return;
        try {
          const response = await fetch(import.meta.env.BASE_URL + path.replace(/^\//, ''));
          if (!response.ok) return;
          const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
          this.buffers.set(owner + kind, buffer);
        } catch {
          /* Original generated effects remain available if an optional pack cannot load. */
        }
      }),
    );
  }
  sample(id, kind, duration = null) {
    const buffer = this.buffers.get(id + kind);
    if (!buffer || !this.context || this.muted) return false;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    if (duration && source.playbackRate) source.playbackRate.value = buffer.duration / duration;
    source.effectKind = kind;
    source.weaponId = id;
    const level = this.context.createGain();
    source.voiceGain = level;
    level.gain.value = kind.startsWith('kill') ? 0.6 : 1;
    source.connect(level).connect(this.master);
    if (kind === 'kill5') this.aceSource = source;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.aceSource === source) {
        this.aceSource = null;
        this.killSequence = 0;
      }
    };
    source.start();
    return true;
  }
  positionalNpcShot(position,listener){
    if(!this.context||this.muted)return;
    const buffer=this.buffers.get('npc-vandalshot'+(Math.random()<.5?1:2));if(!buffer)return;
    const c=this.context,source=c.createBufferSource(),panner=c.createPanner(),level=c.createGain();source.buffer=buffer;source.effectKind='npc-shot';
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=5;panner.maxDistance=60;panner.rolloffFactor=1.2;
    panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;
    const ear=c.listener;ear.positionX.value=listener.position.x;ear.positionY.value=listener.position.y;ear.positionZ.value=listener.position.z;
    ear.forwardX.value=-Math.sin(listener.yaw);ear.forwardY.value=0;ear.forwardZ.value=-Math.cos(listener.yaw);ear.upY.value=1;
    level.gain.value=.75;source.connect(panner).connect(level).connect(this.master);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();panner.disconnect();level.disconnect();};source.start();
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
  setMuted(value) {
    this.muted = value;
    this.setVolume(this.volume);
  }
  burst(time, duration, frequency, gain = 1) {
    const c = this.context,
      noise = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      envelope = c.createGain();
    noise.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    noise.connect(filter).connect(envelope).connect(this.master);
    this.sources.add(noise);
    noise.onended = () => this.sources.delete(noise);
    noise.start(time);
    noise.stop(time + duration + 0.02);
  }
  tone(time, frequency, duration, gain = 0.2, type = 'triangle', end = 60) {
    const c = this.context,
      osc = c.createOscillator(),
      envelope = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), time + duration);
    envelope.gain.setValueAtTime(gain, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(envelope).connect(this.master);
    this.sources.add(osc);
    osc.onended = () => this.sources.delete(osc);
    osc.start(time);
    osc.stop(time + duration);
  }
  shot(id, automatic = false) {
    if (this.sample(id, 'shot')) return;
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    const profiles = {
      vandal: [0.15, 4500, 0.65, 130, 0.21],
      phantom: [0.09, 1700, 0.42, 170, 0.12],
      ghost: [0.075, 1100, 0.26, 220, 0.08],
      guardian: [0.17, 3600, 0.6, 145, 0.2],
      sheriff: [0.25, 3200, 0.85, 95, 0.3],
    };
    const [duration, freq, power, bass, tail] = profiles[id] || profiles.vandal;
    this.burst(t, duration, freq, power);
    this.tone(t, bass, tail, 0.32, 'triangle', 35);
    this.burst(t + 0.012, 0.035, 7000, power * 0.22);
  }
  reload(id, duration) {
    if (this.sample(id, 'reload', duration)) return;
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    this.burst(t, 0.06, 2800, 0.18);
    this.tone(t + 0.06, 450, 0.035, 0.09, 'square', 160);
    this.burst(t + duration * 0.65, 0.08, 3500, 0.22);
    this.burst(t + duration * 0.88, 0.045, 5200, 0.17);
    if (id === 'sheriff') {
      for (let i = 0; i < 3; i++) this.tone(t + 0.15 + i * 0.065, 900, 0.035, 0.05, 'sine', 450);
    }
  }
  confirm(headshot = false, weaponId = 'vandal', killCount = 1) {
    const stage = ((Math.max(1, killCount) - 1) % 5) + 1;

    if (this.sample(weaponId, 'kill' + stage) || this.sample('shared', 'kill' + stage)) return;
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    this.tone(t, headshot ? 1250 : 850, 0.1, 0.1, 'sine', headshot ? 1650 : 1100);
  }
  combinedHitAvailable(weaponId, events) {
    if (!['vandal', 'sheriff'].includes(weaponId)) return false;
    const kill = events.find((e) => !e.sounded && e.type === 'kill');
    if (kill)
      return this.buffers.has(weaponId + 'kill' + (((Math.max(1, kill.killCount) - 1) % 5) + 1));
    const impact = events.find((e) => !e.sounded && e.type === 'impact');
    return (
      !!impact && this.buffers.has(weaponId + (impact.part === 'head' ? 'headshot' : 'bodyhit'))
    );
  }
  impact(part, weaponId) {
    if (this.sample(weaponId, part === 'head' ? 'headshot' : 'bodyhit')) return;
    if (!this.context?.createOscillator || this.muted) return;
    const t = this.context.currentTime;
    // non-lethal hits: bright "dink" on the head, short thud on body / legs
    if (part === 'head') {
      this.tone(t, 2400, 0.09, 0.09, 'sine', 2100);
      this.tone(t, 3600, 0.05, 0.04, 'sine', 3300);
    } else this.burst(t, 0.05, part === 'legs' ? 900 : 1300, 0.22);
  }
  /** Short click repeated while the tracking beam is on target. */
  trackTick() {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    this.tone(t, 1850, 0.035, 0.055, 'square', 1500);
  }
  /** Ability cue (wind-up) and detonation for the flash mode. */
  flashCue(kind = 'flash') {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    if (kind === 'nearsight') {
      this.tone(t, 180, 0.45, 0.12, 'sawtooth', 90);
      this.tone(t + 0.05, 260, 0.35, 0.05, 'sine', 140);
    } else {
      this.tone(t, 900, 0.25, 0.07, 'sine', 2400);
      this.burst(t, 0.2, 6000, 0.05);
    }
  }
  flashPop(kind = 'flash') {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    if (kind === 'nearsight') this.tone(t, 120, 0.5, 0.18, 'triangle', 50);
    else {
      this.burst(t, 0.18, 9000, 0.35);
      this.tone(t, 4200, 0.6, 0.05, 'sine', 3800);
    }
  }
  dry() {
    if (this.context && !this.muted)
      this.tone(this.context.currentTime, 680, 0.035, 0.1, 'square', 230);
  }
  stop({ preserveTails = false } = {}) {
    this.sources.forEach((source) => {
      if (preserveTails && (source.effectKind === 'shot' || source.effectKind?.startsWith('kill')))
        return;
      try {
        source.stop();
      } catch {}
    });
    if (!preserveTails) this.sources.clear();
  }
  async dispose() {
    await this.context?.close();
  }
}
