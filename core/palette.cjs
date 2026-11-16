function lab(r, g, b) {
  const rgb = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const x = f(
      (rgb[0] * 0.4124564 + rgb[1] * 0.3575761 + rgb[2] * 0.1804375) / 0.95047,
    ),
    y = f(rgb[0] * 0.2126729 + rgb[1] * 0.7151522 + rgb[2] * 0.072175),
    z = f(
      (rgb[0] * 0.0193339 + rgb[1] * 0.119192 + rgb[2] * 0.9503041) / 1.08883,
    );
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const distance = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
const hex = (rgb) =>
  "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function detectPalette(rgba, count = 6) {
  const bins = new Map();
  const step = Math.max(1, Math.floor(rgba.length / 4 / 30000));
  for (let i = 0; i < rgba.length; i += 4 * step) {
    if (rgba[i + 3] < 128) continue;
    const c = [rgba[i], rgba[i + 1], rgba[i + 2]],
      key = c.map((v) => v >> 3).join(",");
    const bin = bins.get(key) || { rgb: [0, 0, 0], n: 0 };
    bin.n++;
    c.forEach((v, j) => (bin.rgb[j] += v));
    bins.set(key, bin);
  }
  const samples = [...bins.values()]
    .map((b) => ({ rgb: b.rgb.map((v) => v / b.n), n: b.n }))
    .sort((a, b) => b.n - a.n);
  if (!samples.length) throw Error("Image is completely transparent");
  const points = samples.map((s) => ({ ...s, lab: lab(...s.rgb) }));
  let centers = [points[0].lab];
  while (centers.length < Math.min(count, points.length)) {
    const next = points.reduce(
      (best, p) => {
        const score =
          Math.min(...centers.map((c) => distance(p.lab, c))) * Math.sqrt(p.n);
        return score > best.score ? { score, p } : best;
      },
      { score: -1, p: points[0] },
    );
    if (next.score < 0.001) break;
    centers.push(next.p.lab);
  }
  let colors = [];
  for (let iter = 0; iter < 12; iter++) {
    const groups = centers.map(() => ({ rgb: [0, 0, 0], n: 0 }));
    for (const p of points) {
      let best = 0;
      centers.forEach((c, i) => {
        if (distance(p.lab, c) < distance(p.lab, centers[best])) best = i;
      });
      groups[best].n += p.n;
      p.rgb.forEach((v, j) => (groups[best].rgb[j] += v * p.n));
    }
    colors = groups.filter((g) => g.n).map((g) => g.rgb.map((v) => v / g.n));
    centers = colors.map((c) => lab(...c));
  }
  return [...new Set(colors.map(hex))];
}
function quantize(rgba, palette) {
  if (
    !Array.isArray(palette) ||
    !palette.length ||
    palette.length > 16 ||
    palette.some((c) => !/^#[0-9a-f]{6}$/i.test(c))
  )
    throw Error("Palette requires 1–16 HEX colors");
  const colors = palette.map((c) =>
      [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
    ),
    labs = colors.map((c) => lab(...c));
  const out = Buffer.from(rgba),
    cache = new Map();
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 128) {
      out[i + 3] = 0;
      continue;
    }
    const key = (out[i] << 16) | (out[i + 1] << 8) | out[i + 2];
    let best = cache.get(key);
    if (best === undefined) {
      const p = lab(out[i], out[i + 1], out[i + 2]);
      best = 0;
      labs.forEach((c, j) => {
        if (distance(p, c) < distance(p, labs[best])) best = j;
      });
      if (cache.size < 65536) cache.set(key, best);
    }
    out.set(colors[best], i);
    out[i + 3] = 255;
  }
  return out;
}
module.exports = { detectPalette, quantize, lab };
