import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { MPEGDecoder } from 'mpg123-decoder';
const input = 'assets/source-audio/vandal-showcase.mp3';
const original = fs.readFileSync(input);
const decoder = new MPEGDecoder();
await decoder.ready;
const { channelData, sampleRate, samplesDecoded } = decoder.decode(original);
decoder.free();
const mono = Float32Array.from(
  { length: samplesDecoded },
  (_, i) => channelData.reduce((sum, c) => sum + c[i], 0) / channelData.length,
);
// User-labelled sections, aligned to their measured attack. Shot comes from the isolated taps at 1:27; hit clips include their own recorded shot and replace the air shot.
// These are excerpts of a mixed recording, not isolated original game stems.
const cuts = {
  shot: [87.947, 88.427],
  bodyhit: [28.881, 29.361],
  headshot: [32.593, 33.073],
  kill1: [23.494, 25.35],
  kill2: [26.107, 27.95],
  kill3: [30.246, 32.05],
  kill4: [32.593, 34.5],
  reload: [35.446, 37.7],
  kill5: [39.579, 43.5],
};
const pack = {};
for (const [kind, [start, end]] of Object.entries(cuts)) {
  const data = mono.slice(Math.floor(start * sampleRate), Math.floor(end * sampleRate));
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(3, 0.8 / Math.max(peak, 0.001));
  const wav = Buffer.alloc(44 + data.length * 2);
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
  wav.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => {
    const envelope =
      Math.min(1, i / (sampleRate * 0.003)) *
      Math.min(1, (data.length - 1 - i) / (sampleRate * (kind === 'shot' ? 0.012 : 0.04)));
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, v * gain * envelope)) * 32767),
      44 + i * 2,
    );
  });
  const name = 'audio/vandal/showcase-' + kind + '.wav';
  fs.writeFileSync('public/' + name, wav);
  pack[kind] = name;
}
const packs = JSON.parse(fs.readFileSync('src/data/sound-packs.json'));
Object.assign(packs.vandal, pack);
fs.writeFileSync('src/data/sound-packs.json', JSON.stringify(packs, null, 2));
fs.writeFileSync(
  'assets/source-audio/vandal-showcase.json',
  JSON.stringify(
    {
      originalFile: 'Sovereign Vandal VALORANT FORSAKEN SKIN New Sovereign Skins Showcase.mp3',
      sha256: createHash('sha256').update(original).digest('hex'),
      cuts,
      notes:
        'Isolated tap at 87.947s; automatic fire reuses one tap per simulated round. Combined hit/kill clips replace air shots on hits, so attacks are never layered. Exclusive to Vandal.',
    },
    null,
    2,
  ),
);
console.log('Vandal: ' + Object.keys(pack).join(', '));
