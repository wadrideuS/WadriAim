const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_PATHS = {
  play: 'M8 5.6v12.8a.6.6 0 0 0 .9.5l10.2-6.4a.6.6 0 0 0 0-1L8.9 5.1a.6.6 0 0 0-.9.5z',
  pause: 'M7 5h3.4v14H7zM13.6 5H17v14h-3.4z',
  chevron: 'M6.5 9.5 12 15l5.5-5.5',
  skip: 'M6 6.5v11l8.5-5.5zM16 6h2.5v12H16z',
};
export const SKIP_LABEL = 'Otra emisora';
export const SKIP_UNAVAILABLE =
  'El modo Ambiental WadriAim no usa radio: elige otro género para cambiar de emisora';

export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('music-icon', 'music-icon-' + name);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconButton(className, onClick) {
  const button = element('button', className);
  button.type = 'button';
  button.onclick = onClick;
  return button;
}

function createGenreSelect(genres, selected) {
  const select = element('select', 'music-genre');
  select.setAttribute('aria-label', 'Género de música');
  for (const [id, genre] of Object.entries(genres)) {
    const option = element('option', '', genre.label);
    option.value = id;
    select.append(option);
  }
  select.value = selected;
  return select;
}

/**
 * One header pill for the background music: play/pause, next station, and
 * the current station with a small genre picker underneath.
 */
export function createMusicControl({ genres, genre, onToggle, onGenre, onSkip }) {
  const root = element('div', 'music-control');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Música de fondo');

  const button = iconButton('music-toggle', () => onToggle());
  button.id = 'music-toggle';

  const skipButton = iconButton('music-skip', () => {
    if (skipButton.getAttribute('aria-disabled') !== 'true') onSkip();
  });
  skipButton.setAttribute('aria-label', SKIP_LABEL);
  skipButton.append(icon('skip'));

  const nowPlaying = element('span', 'music-now');
  const genreText = element('span', 'music-genre-text');
  const genreLabel = element('span', 'music-genre-label');
  genreLabel.setAttribute('aria-hidden', 'true');
  genreLabel.append(genreText, icon('chevron'));
  const genreSelect = createGenreSelect(genres, genre);
  const paintGenre = () => {
    genreText.textContent = genreSelect.selectedOptions[0]?.textContent ?? '';
  };
  genreSelect.onchange = () => {
    paintGenre();
    onGenre(genreSelect.value);
  };
  paintGenre();
  const info = element('div', 'music-info');
  info.append(nowPlaying, genreLabel, genreSelect);

  root.append(button, skipButton, info);

  return {
    root,
    button,
    genreSelect,
    skipButton,
    setPlaying(isPlaying) {
      const label = isPlaying ? 'Pausar música' : 'Reproducir música';
      button.replaceChildren(icon(isPlaying ? 'pause' : 'play'));
      button.setAttribute('aria-pressed', String(isPlaying));
      button.setAttribute('aria-label', label);
      button.title = label;
      root.classList.toggle('is-paused', !isPlaying);
    },
    setStatus(text, title = text) {
      nowPlaying.textContent = text;
      info.title = title;
      paintGenre();
    },
    setSkipAvailable(isAvailable) {
      skipButton.setAttribute('aria-disabled', String(!isAvailable));
      skipButton.title = isAvailable ? SKIP_LABEL : SKIP_UNAVAILABLE;
    },
    dispose() {
      root.remove();
    },
  };
}
