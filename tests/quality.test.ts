import { it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { trace, prepare } = require("../core/engine.cjs");
const { exportSVG } = require("../core/document.cjs");
const { repairHoles } = require("../core/quality.cjs");
const base = {
  palette: ["#e63946"],
  geometry: "cutout",
  mode: "spline",
  speckle: 0,
  simplify: 0.25,
};
it("higher edge sampling improves a low-resolution curved silhouette", async () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="17.3" fill="#e63946"/></svg>';
  const input = await sharp(Buffer.from(source)).png().toBuffer();
  const target = await sharp(Buffer.from(source), { density: 576 })
    .resize(384, 384)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const error = async (doc: any) => {
    const data = await sharp(Buffer.from(exportSVG(doc)), { density: 576 })
      .resize(384, 384)
      .ensureAlpha()
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 3; i < data.length; i += 4)
      sum += Math.abs(data[i] - target[i]);
    return sum / (384 * 384 * 255);
  };
  const old = await trace(input, {
    ...base,
    edgeQuality: 1,
    speckle: 4,
    simplify: 1,
  });
  const improved = await trace(input, { ...base, edgeQuality: 4 });
  const before = await error(old),
    after = await error(improved);
  expect(
    after,
    `silhouette error before=${before}, after=${after}`,
  ).toBeLessThan(before);
  expect(improved.width).toBe(48);
  expect(improved.height).toBe(48);
});
it("repair fills a tiny enclosed gap but preserves exterior and larger holes", () => {
  const pixels = Buffer.alloc(12 * 12 * 4);
  for (let y = 1; y < 11; y++)
    for (let x = 1; x < 11; x++)
      pixels.set([230, 57, 70, 255], (y * 12 + x) * 4);
  pixels[(3 * 12 + 3) * 4 + 3] = 0;
  for (let y = 6; y < 9; y++)
    for (let x = 6; x < 9; x++) pixels[(y * 12 + x) * 4 + 3] = 0;
  const fixed = repairHoles(pixels, 12, 12, 2);
  expect(fixed[(3 * 12 + 3) * 4 + 3]).toBe(255);
  expect(fixed[(7 * 12 + 7) * 4 + 3]).toBe(0);
  expect(fixed[3]).toBe(0);
  expect(pixels[(3 * 12 + 3) * 4 + 3]).toBe(0);
});
it("quality previews retain source dimensions and real vector exports", async () => {
  const input = await sharp({
    create: { width: 32, height: 24, channels: 4, background: "#e63946" },
  })
    .png()
    .toBuffer();
  const preview = await prepare(input, 2, { ...base, edgeQuality: 4 });
  const metadata = await sharp(
    Buffer.from(preview.preview.split(",")[1], "base64"),
  ).metadata();
  expect(metadata.width).toBe(32);
  expect(metadata.height).toBe(24);
  const doc = await trace(input, { ...base, edgeQuality: 4 });
  expect(doc.physicalWidth).toBeCloseTo((32 * 25.4) / 96);
  expect(exportSVG(doc)).not.toContain("<image");
});
it("conservative filtering keeps a small isolated colored component", async () => {
  const input = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="2" width="18" height="18" fill="#e63946"/><rect x="26" y="26" width="2" height="2" fill="#e63946"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const doc = await trace(input, { ...base, edgeQuality: 4 });
  const data = await sharp(Buffer.from(exportSVG(doc)))
    .resize(32, 32)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const old = await trace(input, {
    ...base,
    edgeQuality: 1,
    speckle: 4,
    simplify: 1,
  });
  const oldData = await sharp(Buffer.from(exportSVG(old)))
    .resize(32, 32)
    .ensureAlpha()
    .raw()
    .toBuffer();
  let area = 0,
    oldArea = 0;
  for (let y = 24; y < 30; y++)
    for (let x = 24; x < 30; x++) {
      area += data[(y * 32 + x) * 4 + 3];
      oldArea += oldData[(y * 32 + x) * 4 + 3];
    }
  expect(area).toBeGreaterThan(500);
  expect(area).toBeGreaterThan(oldArea);
});
