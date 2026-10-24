import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { MPEGDecoder } from 'mpg123-decoder';
const input = 'assets/source-audio/sheriff-singularity.mp3';
const original = fs.readFileSync(input);
const decoder = new MPEGDecoder();
await decoder.ready;
const { channelData, sampleRate, samplesDecoded } = decoder.decode(original);
decoder.free();
const mono = Float32Array.from(
  { length: samplesDecoded },
  (_, i) => channelData.reduce((sum, c) => sum + c[i], 0) / channelData.length,
);
// User-marked Singularity kill sequence; complete combined shot/kill samples.
// These are excerpts of a mixed recording, not isolated original game stems.
const cuts = {
  kill1: [4.697, 6.25],
  kill2: [6.417, 8.02],
  kill3: [8.187, 9.75],
  kill4: [9.897, 11.5],
  kill5: [11.657, 13.4],
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
  const name = 'audio/sheriff/showcase-' + kind + '.wav';
  fs.writeFileSync('public/' + name, wav);
  pack[kind] = name;
}
const packs = JSON.parse(fs.readFileSync('src/data/sound-packs.json'));
Object.assign(packs.sheriff, pack);
fs.writeFileSync('src/data/sound-packs.json', JSON.stringify(packs, null, 2));
fs.writeFileSync(
  'assets/source-audio/sheriff-singularity.json',
  JSON.stringify(
    {
      originalFile: 'SINGULARITY SHERIFF SOUND EFFECT #whiffgodplays #valorant.mp3',
      sha256: createHash('sha256').update(original).digest('hex'),
      cuts,
      notes:
        'User marks 0:04, 0:06, 0:08, 0:09, 0:11. Attack-aligned combined shot/kill cues, exclusive to Sheriff. Repeat after stage five; skip the extra air shot on a kill.',
    },
    null,
    2,
  ),
);
console.log('Sheriff: ' + Object.keys(pack).join(', '));
