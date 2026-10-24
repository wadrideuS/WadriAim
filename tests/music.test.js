import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientMusic, radioGenres } from '../src/audio/AmbientMusic.js';
import { read } from '../src/lib/storage.js';

function radioMusic({ enabled = true } = {}) {
  const calls = [];
  const music = Object.create(AmbientMusic.prototype);
  Object.assign(music, {
    enabled,
    genre: 'chill',
    volume: 0.08,
    ducked: false,
    channel: null,
    stations: [{ name: 'Lo-fi Uno', url: 'https://uno.example/stream' }],
    stationIndex: 0,
    radio: {
      src: 'https://uno.example/stream',
      volume: 0,
      pause: () => calls.push('pause'),
      play: async () => calls.push('play'),
    },
    context: { suspend: () => calls.push('suspend') },
    control: {
      playing: enabled,
      setPlaying(isPlaying) {
        this.playing = isPlaying;
      },
      setStatus(text) {
        this.status = text;
      },
      setSkipAvailable(isAvailable) {
        this.canSkip = isAvailable;
      },
    },
  });
  return { music, calls };
}

test('pausing stops the radio for real and remembers the choice', () => {
  const { music, calls } = radioMusic();

  music.setEnabled(false);

  assert.equal(music.enabled, false);
  assert.deepEqual(calls, ['suspend', 'pause']);
  assert.equal(music.control.playing, false);
  assert.equal(read('wa-music-enabled', true), false);
});

test('resuming plays the same station instead of jumping to another one', async () => {
  const { music, calls } = radioMusic({ enabled: false });

  await music.setEnabled(true);

  assert.equal(music.enabled, true);
  assert.equal(music.stationIndex, 0);
  assert.equal(music.radio.src, 'https://uno.example/stream');
  assert.equal(calls.at(-1), 'play');
  assert.equal(music.control.playing, true);
});

test('asking for another station while paused turns the music back on', async () => {
  const { music, calls } = radioMusic({ enabled: false });
  music.stations.push({ name: 'Lo-fi Dos', url: 'https://dos.example/stream' });

  await music.skipStation();

  assert.equal(music.enabled, true);
  assert.equal(music.radio.src, 'https://dos.example/stream');
  assert.equal(calls.at(-1), 'play');
  assert.equal(music.control.playing, true);
});

test('a station found after pausing is loaded but stays silent', async () => {
  const { music, calls } = radioMusic();
  music.stations.push({ name: 'Lo-fi Dos', url: 'https://dos.example/stream' });
  music.enabled = false;

  await music.nextStation();

  assert.equal(music.radio.src, 'https://dos.example/stream');
  assert.equal(calls.includes('play'), false);
});

test('ambient mode disables "Otra emisora" and does not repeat the genre as the station', async () => {
  const { music } = radioMusic({ enabled: false });

  await music.setGenre('synth');

  assert.equal(music.control.canSkip, false);
  assert.notEqual(music.control.status, radioGenres.synth.label);
});

test('pausing while the ambient pad is still starting leaves it silent', async () => {
  const { music } = radioMusic();
  let finishResume;
  const context = {
    state: 'suspended',
    currentTime: 0,
    resume() {
      return new Promise((resolve) => {
        finishResume = () => {
          this.state = 'running';
          resolve();
        };
      });
    },
    suspend() {
      this.state = 'suspended';
    },
  };
  Object.assign(music, { genre: 'synth', context, gain: { gain: { setTargetAtTime() {} } } });
  globalThis.window = { AudioContext: class {} };

  const starting = music.start();
  music.setEnabled(false);
  finishResume();
  await starting;

  assert.equal(context.state, 'suspended');
});
