import { teamPalettes } from '../data/vct-teams.js';
import { read, save } from '../lib/storage.js';
export const palettes = {
    ...teamPalettes,
    blue: {
      label: 'Azul · gris',
      accent: '#79a8d5',
      bg: '#0e1117',
      panel: '#181e28',
      arena: '#121a27',
      floor: '#222c39',
    },
    green: {
      label: 'Verde · salvia',
      accent: '#7cb99f',
      bg: '#0e1412',
      panel: '#18221d',
      arena: '#14221c',
      floor: '#23332a',
    },
    violet: {
      label: 'Violeta · humo',
      accent: '#ab91d2',
      bg: '#110e18',
      panel: '#1c1727',
      arena: '#1b142a',
      floor: '#2c233c',
    },
    rose: {
      label: 'Rosa · grafito',
      accent: '#ff4b92',
      bg: '#100e13',
      panel: '#1b171f',
      arena: '#171023',
      floor: '#23212d',
    },
};
export function applyPalette(id) {
    const p = palettes[id] || palettes.blue;
    document.body.dataset.palette = id;
    const vars = {
      '--palette-bg': p.bg,
      '--palette-panel': p.panel,
      '--palette-accent': p.accent,
      '--palette-secondary': p.secondary || p.accent,
      '--arena-bg': p.arena,
      '--arena-floor': p.floor,
    };
    for (const [key, value] of Object.entries(vars)) document.body.style.setProperty(key, value);
    save('wa-palette', id);
}
export function initPalettes() {
  const apply = applyPalette;
  document.querySelectorAll('.palette-select').forEach(node=>node.remove());
  const saved=read('wa-palette','rose');
  apply(palettes[saved] ? saved : 'rose');
  save('wa-palette-revision', 2);
}
