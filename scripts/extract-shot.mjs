import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MPEGDecoder } from 'mpg123-decoder';
const [id, input, startOverride, durationOverride] = process.argv.slice(2);
if (!['phantom', 'vandal', 'sheriff', 'ghost', 'guardian'].includes(id) || !input)
  throw Error('Usage: node scripts/extract-shot.mjs <phantom|vandal> <file.mp3>');
const decoder = new MPEGDecoder();
await decoder.ready;
const original = fs.readFileSync(input),
  audio = decoder.decode(original);
decoder.free();
const { channelData, sampleRate, samplesDecoded } = audio;
const mono = new Float32Array(samplesDecoded);
for (let i = 0; i < samplesDecoded; i++)
  mono[i] = channelData.reduce((s, c) => s + c[i], 0) / channelData.length;
const hop = Math.round(sampleRate * 0.01);
let onset = -1;
for (let n = 0; n < Math.min(mono.length, sampleRate * 10); n += hop) {
  let energy = 0;
  for (let j = n; j < Math.min(n + hop, mono.length); j++) energy += mono[j] ** 2;
  if (Math.sqrt(energy / hop) > 0.035) {
    onset = Math.max(0, n - Math.round(sampleRate * 0.006));
    break;
  }
}
if (startOverride !== undefined) onset = Math.round(Number(startOverride) * sampleRate);
if (onset < 0) throw Error('No clear shot found');
const slice = mono.slice(
  onset,
  Math.min(mono.length, onset + Math.round(sampleRate * Number(durationOverride || 0.48))),
);
let peak = 0;
for (const s of slice) peak = Math.max(peak, Math.abs(s));
const gain = Math.min(3, 0.8 / peak);
for (let i = 0; i < slice.length; i++) {
  const fadeIn = Math.min(1, i / (sampleRate * 0.001)),
    fadeOut = Math.min(1, (slice.length - 1 - i) / (sampleRate * 0.04));
  slice[i] *= gain * fadeIn * fadeOut;
}
const wav = Buffer.alloc(44 + slice.length * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(slice.length * 2, 40);
slice.forEach((s, i) =>
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2),
);
const dir = 'public/audio/' + id;
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/shot.wav', wav);
fs.mkdirSync('assets/source-audio', { recursive: true });
fs.copyFileSync(input, 'assets/source-audio/' + id + '.mp3');
const record = {
  originalFile: path.basename(input),
  sourceHash: createHash('sha256').update(original).digest('hex'),
  onsetSeconds: onset / sampleRate,
  duration: slice.length / sampleRate,
  outputHash: createHash('sha256').update(wav).digest('hex'),
  source: 'user-provided',
  license: 'not-supplied',
};
fs.writeFileSync('assets/source-audio/' + id + '.json', JSON.stringify(record, null, 2));
const packs = JSON.parse(fs.readFileSync('src/data/sound-packs.json'));
packs[id].shot = 'audio/' + id + '/shot.wav';
fs.writeFileSync('src/data/sound-packs.json', JSON.stringify(packs, null, 2) + '\n');
console.log(id, record);
