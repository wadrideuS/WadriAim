export function parseCode(code) {
  const t = code.trim().split(';');
  if (t[0] !== '0' || !t.includes('P'))
    throw Error('Pega un código de mira de VALORANT que comience con 0; e incluya P.');
  const start = t.indexOf('P') + 1,
    end = t.indexOf('S', start),
    a = t.slice(start, end < 0 ? t.length : end),
    p = {};
  for (let i = 0; i < a.length; i += 2) {
    if (a[i + 1] === undefined) throw Error('El código de mira está incompleto.');
    p[a[i]] = a[i + 1];
  }
  return p;
}
export function cross(ctx, x, y, code) {
  let p;
  try {
    p = parseCode(code);
  } catch {
    p = {};
  }
  const palette = [
    '#fff',
    '#40ff40',
    '#b4ff00',
    '#d7ff00',
    '#ffff00',
    '#00ffff',
    '#ff00ff',
    '#ff3333',
  ];
  let color = palette[Number(p.c || 0)] || '#00ffff';
  if (p.u && /^[0-9a-fA-F]{6,8}$/.test(p.u)) color = '#' + p.u;
  const line = (a, b, c, d, w, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    if (p.h === '1') {
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 2;
    }
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  ctx.save();
  [0, 1].forEach((n) => {
    if (p[n + 'b'] === '0' || (n === 1 && p['1b'] === undefined && p['1t'] === '0')) return;
    const len = Math.min(24, Number(p[n + 'l'] ?? (n === 0 ? 5 : 0))),
      v = Number(p[n + 'v'] ?? len),
      gap = Math.min(30, Number(p[n + 'o'] ?? 2)) + Number(p[n + 't'] ?? 1) / 2,
      w = Math.max(0.5, Math.min(8, Number(p[n + 't'] ?? 1))),
      alpha = Number(p[n + 'a'] ?? 1);
    line(x - gap - len, y, x - gap, y, w, alpha);
    line(x + gap, y, x + gap + len, y, w, alpha);
    line(x, y - gap - v, x, y - gap, w, alpha);
    line(x, y + gap, x, y + gap + v, w, alpha);
  });
  if (p.d === '1') {
    ctx.fillStyle = color;
    ctx.fillRect(
      x - Number(p.z ?? 2) / 2,
      y - Number(p.z ?? 2) / 2,
      Number(p.z ?? 2),
      Number(p.z ?? 2),
    );
  }
  ctx.restore();
}
