// Decorative hero card: CSS balls paint first, then the arena's real WebGL orbs take over.
const HIT_INTERVAL = 2.4;
const MAX_FRAME_STEP = 0.05;
const PARALLAX_EASE = 4;
const STILL_FRAME_TIME = 0.6;
const HITMARKER_FLASH = [
  { opacity: 1, transform: 'rotate(45deg) scale(1.3)' },
  { opacity: 0, transform: 'rotate(45deg) scale(1)' },
];
const HITMARKER_TIMING = { duration: 320, easing: 'ease-out' };
const CENTER = { x: 0, y: 0 };

const clampUnit = (value) => Math.min(Math.max(value, -1), 1);

/** Pointer position relative to the card centre, in [-1, 1] on each axis. */
export function pointerToParallax(rect, x, y) {
  return {
    x: clampUnit(((x - rect.left) / rect.width) * 2 - 1),
    y: clampUnit(((y - rect.top) / rect.height) * 2 - 1),
  };
}

export function formatHits(count) {
  return String(count % 1000).padStart(3, '0');
}

const easeToward = (current, target, dt) =>
  current + (target - current) * (1 - Math.exp(-PARALLAX_EASE * dt));

export function installHeroArt() {
  const card = document.querySelector('.hero-art');
  const canvas = card?.querySelector('.hero-orbs');
  if (!canvas) return { dispose() {} };
  const cross = card.querySelector('.cross');
  const hitmarker = card.querySelector('.hitmarker');
  const hud = card.querySelector('.hero-hud');
  const hudCount = hud.querySelector('b');
  const game = document.getElementById('game');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;
  let isLoading = false;
  let isVisible = false;
  let isDisposed = false;
  let frame = 0;
  let previous = 0;
  let time = 0;
  let nextHitAt = HIT_INTERVAL;
  let hits = 0;
  let pointer = null;
  let parallax = CENTER;

  const readAccent = () => getComputedStyle(card).getPropertyValue('--lime').trim() || '#ff4b92';
  const shouldAnimate = () =>
    scene && isVisible && !document.hidden && !game?.open && !reducedMotion.matches;

  const drawStill = () => scene?.render(STILL_FRAME_TIME, 0, CENTER);

  let parallaxVars = '';
  const setParallaxVars = (next) => {
    const x = next.x.toFixed(3);
    const y = next.y.toFixed(3);
    if (parallaxVars === `${x},${y}`) return;
    parallaxVars = `${x},${y}`;
    card.style.setProperty('--hero-px', x);
    card.style.setProperty('--hero-py', y);
  };

  const registerHit = () => {
    hits += 1;
    nextHitAt = time + HIT_INTERVAL;
    scene.hit(time);
    hudCount.textContent = formatHits(hits);
    hitmarker.animate(HITMARKER_FLASH, HITMARKER_TIMING);
  };

  function tick(now) {
    if (!shouldAnimate()) {
      frame = 0;
      if (reducedMotion.matches) start();
      return;
    }
    frame = requestAnimationFrame(tick);
    const dt = Math.min((now - previous) / 1000, MAX_FRAME_STEP);
    previous = now;
    time += dt;
    const target = pointer
      ? pointerToParallax(card.getBoundingClientRect(), pointer.x, pointer.y)
      : CENTER;
    parallax = { x: easeToward(parallax.x, target.x, dt), y: easeToward(parallax.y, target.y, dt) };
    setParallaxVars(parallax);
    if (time >= nextHitAt) registerHit();
    scene.render(time, dt, parallax);
  }

  const start = () => {
    hud.hidden = !scene || reducedMotion.matches;
    if (scene && reducedMotion.matches) {
      parallax = CENTER;
      setParallaxVars(CENTER);
      drawStill();
      return;
    }
    if (frame || !shouldAnimate()) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const resize = () => {
    if (!scene || !card.clientWidth) return;
    scene.resize(card.clientWidth, card.clientHeight, cross.offsetTop + cross.offsetHeight / 2);
    if (reducedMotion.matches) drawStill();
  };

  async function load() {
    isLoading = true;
    try {
      // Split point: three.js stays out of the landing bundle until the hero is on screen.
      const { createHeroOrbScene } = await import('../renderer/heroOrbScene.js');
      if (isDisposed) return;
      scene = createHeroOrbScene(canvas);
    } catch (error) {
      console.warn('Hero art: 3D orbs unavailable, keeping the CSS illustration.', error?.message);
      return;
    }
    scene.setAccent(readAccent());
    resize();
    card.classList.add('is-live');
    start();
  }

  const visibility = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible && !scene && !isLoading) load();
    else start();
  });
  const sizeObserver = new ResizeObserver(resize);
  const paletteObserver = new MutationObserver(() => {
    scene?.setAccent(readAccent());
    if (reducedMotion.matches) drawStill();
  });
  const trackPointer = (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  };
  const releasePointer = (event) => {
    if (!event.relatedTarget) pointer = null;
  };

  visibility.observe(card);
  sizeObserver.observe(card);
  paletteObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class', 'data-palette'],
  });
  window.addEventListener('pointermove', trackPointer, { passive: true });
  document.addEventListener('pointerout', releasePointer);
  document.addEventListener('visibilitychange', start);
  game?.addEventListener('close', start);
  reducedMotion.addEventListener('change', start);

  return {
    dispose() {
      isDisposed = true;
      cancelAnimationFrame(frame);
      visibility.disconnect();
      sizeObserver.disconnect();
      paletteObserver.disconnect();
      window.removeEventListener('pointermove', trackPointer);
      document.removeEventListener('pointerout', releasePointer);
      document.removeEventListener('visibilitychange', start);
      game?.removeEventListener('close', start);
      reducedMotion.removeEventListener('change', start);
      scene?.dispose();
      card.classList.remove('is-live');
    },
  };
}
