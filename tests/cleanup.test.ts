import { it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseSVG, exportSVG } = require("../core/document.cjs");
const { mergeRegions } = require("../core/cleanup.cjs");
const sharp = require("sharp");
it("merges adjacent and overlapping same-color vector regions", async () => {
  const doc = parseSVG(
    '<svg width="64" height="64"><rect x="4" y="4" width="30" height="30" fill="#ff0000"/><rect x="24" y="24" width="30" height="30" fill="#ff0000"/></svg>',
  );
  const merged = mergeRegions(
    doc,
    doc.shapes.map((s: any) => s.id),
  );
  expect(merged.shapes).toHaveLength(1);
  const before = await sharp(Buffer.from(exportSVG(doc)))
      .raw()
      .toBuffer(),
    after = await sharp(Buffer.from(exportSVG(merged)))
      .raw()
      .toBuffer();
  expect(after).toEqual(before);
});
it("preserves holes when merging compound paths", async () => {
  const doc = parseSVG(
    '<svg width="64" height="64"><path fill="#ff0000" fill-rule="evenodd" d="M0 0H40V40H0Z M10 10H30V30H10Z"/><rect fill="#ff0000" x="40" y="0" width="20" height="20"/></svg>',
  );
  const merged = mergeRegions(
    doc,
    doc.shapes.map((s: any) => s.id),
  );
  const image = await sharp(Buffer.from(exportSVG(merged)))
    .resize(64, 64)
    .ensureAlpha()
    .raw()
    .toBuffer();
  expect(image[(20 * 64 + 20) * 4 + 3]).toBe(0);
});
it("rejects unsafe cross-layer or transparent merges", () => {
  const doc = parseSVG(
    '<svg width="64" height="64"><path d="M0 0H10V10Z" fill="#ff0000"/><path d="M20 20H30V30Z" fill="#0000ff"/></svg>',
  );
  expect(() =>
    mergeRegions(
      doc,
      doc.shapes.map((s: any) => s.id),
    ),
  ).toThrow();
});
