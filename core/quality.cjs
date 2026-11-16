const sharp = require("sharp");
const svgpath = require("svgpath");
const { quantize } = require("./palette.cjs");

// Repair only small, enclosed transparent components. Never fill the exterior or large intentional holes.
function repairHoles(pixels, width, height, limit) {
  const out = Buffer.from(pixels),
    seen = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || out[start * 4 + 3]) continue;
    let head = 0,
      tail = 1,
      exterior = false;
    queue[0] = start;
    seen[start] = 1;
    const neighbors = new Map();
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      if (!x || !y || x === width - 1 || y === height - 1) exterior = true;
      for (const n of [
        x ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y ? p - width : -1,
        y + 1 < height ? p + width : -1,
      ]) {
        if (n < 0) continue;
        if (out[n * 4 + 3]) {
          const key = out.subarray(n * 4, n * 4 + 3).toString("hex");
          neighbors.set(key, (neighbors.get(key) || 0) + 1);
        } else if (!seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (!exterior && tail <= limit && neighbors.size) {
      const color = [...neighbors].sort((a, b) => b[1] - a[1])[0][0],
        rgb = Buffer.from(color, "hex");
      for (let i = 0; i < tail; i++) {
        out.set(rgb, queue[i] * 4);
        out[queue[i] * 4 + 3] = 255;
      }
    }
  }
  return out;
}
async function tracingPixels(image, palette, settings = {}) {
  const requested =
      settings.mode === "pixel" ? 1 : Number(settings.edgeQuality ?? 4),
    holes = Number(settings.fillHoles ?? 0);
  if (
    ![1, 2, 3, 4].includes(requested) ||
    !Number.isInteger(holes) ||
    holes < 0 ||
    holes > 256
  )
    throw Error("Invalid edge quality or hole threshold");
  // Keep supersampling bounded. Large inputs already have sufficient edge samples.
  const factor = Math.max(
    1,
    Math.min(
      requested,
      Math.floor(Math.sqrt(16000000 / (image.width * image.height))),
    ),
  );
  let data = image.data;
  if (factor > 1)
    data = await sharp(data, {
      raw: { width: image.width, height: image.height, channels: 4 },
    })
      .resize(image.width * factor, image.height * factor, { kernel: "cubic" })
      .raw()
      .toBuffer();
  const width = image.width * factor,
    height = image.height * factor;
  let pixels = quantize(data, palette);
  if (holes)
    pixels = repairHoles(pixels, width, height, holes * factor * factor);
  return { pixels, width, height, factor };
}
function restoreDimensions(doc, image, factor) {
  if (factor !== 1)
    doc.shapes.forEach((s) => {
      s.d = svgpath(s.d)
        .scale(1 / factor)
        .round(4)
        .toString();
    });
  doc.width = image.width;
  doc.height = image.height;
  doc.physicalWidth = (image.width * 25.4) / 96;
  return doc;
}
module.exports = { tracingPixels, restoreDimensions, repairHoles };
