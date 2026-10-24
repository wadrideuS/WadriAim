// Decorative only: no pointer capture, suspended while the arena is open.
export function installLivingBackground() {
  const canvas = document.createElement('canvas');
  canvas.className = 'living-background';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dispose: () => canvas.remove() };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: -1000, y: -1000 };
  let width = 0,
    height = 0,
    frame,
    previous = 0,
    time = 0,
    accent = '#ff4b92',
    secondary = '#ff4b92';
  const sparks = Array.from({ length: 30 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    phase: i * 2.4,
    dx: 0,
    dy: 0,
  }));
  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const palette = () => {
    accent =
      getComputedStyle(document.body).getPropertyValue('--palette-accent').trim() || '#ff4b92';
  };
  const updatePalette = palette;
  const colorPalette = () => {
    updatePalette();
    secondary =
      getComputedStyle(document.body).getPropertyValue('--palette-secondary').trim() || accent;
  };
  const observer = new MutationObserver(colorPalette);
  observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-palette'] });
  const move = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };
  const leave = () => {
    pointer.x = pointer.y = -1000;
  };
  function repel(x, y, radius = 260) {
    const dx = x - pointer.x,
      dy = y - pointer.y,
      distance = Math.hypot(dx, dy);
    const proximity = Math.max(0, 1 - distance / radius);
    const force = proximity * proximity * (3 - 2 * proximity);
    return { x: (dx / (distance || 1)) * force * 62, y: (dy / (distance || 1)) * force * 62 };
  }
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (now - previous < 1000 / 30) return;
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (document.hidden || document.getElementById('game')?.open) return;
    if (!reduced.matches) time += dt;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = ctx.fillStyle = ctx.shadowColor = accent;
    for (let ribbon = 0; ribbon < 3; ribbon++) {
      ctx.strokeStyle = ctx.shadowColor = ribbon === 1 ? secondary : accent;
      const points = [];
      for (let n = 0; n <= 90; n++) {
        const x = (n / 90) * (width + 180) - 90;
        const y =
          height * (0.18 + ribbon * 0.32) +
          Math.sin((n / 90) * 6 + time * 0.14 + ribbon * 2) * height * 0.17 +
          Math.cos((n / 90) * 11 - time * 0.09) * 24;
        points.push([x, y]);
      }
      for (const [lineWidth, alpha, blur] of [
        [24, 0.018, 32],
        [4, 0.075, 18],
        [1.1, 0.26, 8],
      ]) {
        ctx.beginPath();
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = blur;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.moveTo(...points[0]);
        for (let i = 1; i < points.length - 1; i++) {
          const [x, y] = points[i];
          const next = points[i + 1];
          ctx.quadraticCurveTo(x, y, (x + next[0]) / 2, (y + next[1]) / 2);
        }
        ctx.lineTo(...points.at(-1));
        ctx.stroke();
      }
    }
    ctx.fillStyle = ctx.strokeStyle = ctx.shadowColor = accent;
    for (const spark of sparks) {
      const x = (spark.x * width + Math.sin(time * 0.12 + spark.phase) * 65 + width) % width;
      const y =
        (spark.y * height - time * 5 + Math.cos(time * 0.18 + spark.phase) * 30 + height * 1000) %
        height;
      const offset = reduced.matches ? { x: 0, y: 0 } : repel(x, y, 160);
      spark.dx += (offset.x - spark.dx) * (1 - Math.exp(-1.6 * dt));
      spark.dy += (offset.y - spark.dy) * (1 - Math.exp(-1.6 * dt));
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(time * 0.55 + spark.phase);
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + spark.dx, y + spark.dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (spark.phase % 4 < 1) {
        ctx.beginPath();
        ctx.moveTo(x + spark.dx - 4, y + spark.dy);
        ctx.lineTo(x + spark.dx + 4, y + spark.dy);
        ctx.moveTo(x + spark.dx, y + spark.dy - 4);
        ctx.lineTo(x + spark.dx, y + spark.dy + 4);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  resize();
  colorPalette();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  frame = requestAnimationFrame(draw);
  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.remove();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    },
  };
}
