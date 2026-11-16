import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { trace, prepare } = require("../core/engine.cjs");
const { parseSVG, exportSVG } = require("../core/document.cjs");
const { detectPalette, quantize } = require("../core/palette.cjs");
const settings = {
  palette: ["#ffffff", "#000000", "#e63946", "#2563eb"],
  geometry: "cutout",
  mode: "pixel",
  speckle: 0,
  simplify: 0,
};
const fixtures: Record<string, string> = {
  "black on white":
    '<rect width="64" height="64" fill="#ffffff"/><rect x="12" y="12" width="40" height="40" fill="#000000"/>',
  "two color logo":
    '<rect width="64" height="64" fill="#e63946"/><rect x="16" y="16" width="32" height="32" fill="#2563eb"/>',
  "multicolor illustration":
    '<rect width="64" height="64" fill="#ffffff"/><rect x="5" y="5" width="35" height="30" fill="#e63946"/><rect x="24" y="24" width="35" height="35" fill="#2563eb"/><rect x="30" y="30" width="10" height="10" fill="#000000"/>',
  "true transparency":
    '<rect x="10" y="10" width="44" height="44" fill="#e63946"/>',
  "nested holes":
    '<path d="M4 4H60V60H4Z M12 12H52V52H12Z M24 24H40V40H24Z" fill="#e63946" fill-rule="evenodd"/>',
  "disconnected shapes":
    '<rect x="4" y="4" width="12" height="12" fill="#e63946"/><rect x="40" y="40" width="12" height="12" fill="#e63946"/>',
  "thin details":
    '<rect x="4" y="4" width="56" height="2" fill="#000000"/><rect x="30" y="4" width="2" height="56" fill="#000000"/>',
  "same color different depths":
    '<rect width="64" height="64" fill="#e63946"/><rect x="8" y="8" width="48" height="48" fill="#2563eb"/><rect x="20" y="20" width="24" height="24" fill="#e63946"/>',
  "partial occlusion":
    '<rect x="4" y="4" width="40" height="40" fill="#e63946"/><rect x="24" y="24" width="36" height="36" fill="#2563eb"/>',
};
async function png(body: string) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${body}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
describe("actual offline VTracer conversions", () => {
  for (const [name, body] of Object.entries(fixtures))
    it(name, async () => {
      const input = await png(body);
      const doc = await trace(input, settings);
      const output = exportSVG(doc);
      expect(output).toContain("<path");
      expect(output).toContain('inkscape:groupmode="layer"');
      expect(output).not.toMatch(/<image|base64/);
      const parsed = parseSVG(output);
      expect(parsed.shapes.length).toBeGreaterThan(0);
      const a = await sharp(input).ensureAlpha().raw().toBuffer();
      const b = await sharp(Buffer.from(output))
        .resize(64, 64)
        .ensureAlpha()
        .raw()
        .toBuffer();
      let differences = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (
          Math.abs(a[i + 3] - b[i + 3]) > 10 ||
          (a[i + 3] > 0 &&
            [0, 1, 2].some((c) => Math.abs(a[i + c] - b[i + c]) > 10))
        )
          differences++;
      }
      const mismatch = differences / 4096;
      console.log(`${name}: ${(mismatch * 100).toFixed(2)}% pixels differ`);
      expect(mismatch).toBeLessThan(0.025);
      if (name === "multicolor illustration") {
        await fs.mkdir("test-results", { recursive: true });
        await fs.writeFile("test-results/artwork.png", input);
        await fs.writeFile("test-results/artwork.svg", output);
        await sharp(Buffer.from(output))
          .png()
          .toFile("test-results/traced.png");
      }
    });
  it("JPEG artifacts", async () => {
    const bytes = await sharp(await png(fixtures["two color logo"]))
      .jpeg({ quality: 65 })
      .toBuffer();
    const prepared = await prepare(bytes, 2);
    const doc = await trace(bytes, {
      ...settings,
      palette: prepared.palette,
      mode: "spline",
      speckle: 4,
      simplify: 1,
    });
    expect(doc.layers.length).toBeGreaterThan(1);
  });
  it("deterministic meaningful palettes and transparency", () => {
    const pixels = Buffer.from([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 0,
    ]);
    expect(detectPalette(pixels, 2)).toEqual(detectPalette(pixels, 2));
    expect(detectPalette(pixels, 2)).toHaveLength(2);
    expect(quantize(pixels, ["#ff0000", "#0000ff"])[15]).toBe(0);
  });
  it("preserves painter order rather than merging repeated colors", () => {
    const doc = parseSVG(
      `<svg width="64" height="64">${fixtures["same color different depths"]}</svg>`,
    );
    expect(doc.layers.map((l: any) => l.color)).toEqual([
      "#e63946",
      "#2563eb",
      "#e63946",
    ]);
  });
  it("sanitizes scripts, handlers, external content", () => {
    const doc = parseSVG(
      '<svg width="64" height="64" onload="evil()"><script>evil()</script><image href="https://evil.test/x"/><foreignObject><iframe/></foreignObject><path d="M0 0H20V20Z" onclick="evil()"/></svg>',
    );
    expect(exportSVG(doc)).not.toMatch(
      /evil|script|image|foreignObject|onclick|onload/,
    );
  });
  it("rejects malformed and unsupported content", () => {
    expect(() => parseSVG("<svg><path/></svg>")).toThrow();
    expect(() =>
      parseSVG('<!DOCTYPE svg><svg width="10" height="10"/>'),
    ).toThrow();
    expect(() =>
      parseSVG(
        '<svg width="10" height="10"><path style="fill:red" d="M0 0H5V5Z"/></svg>',
      ),
    ).toThrow();
  });
  it("round-trips editable project", async () => {
    const document = await trace(
      await png(fixtures["multicolor illustration"]),
      settings,
    );
    document.layers[0].locked = true;
    document.shapes[0].transform = "translate(3 4)";
    const project = { document, settings };
    const copy = JSON.parse(JSON.stringify(project));
    expect(copy).toEqual(project);
    expect(parseSVG(exportSVG(copy.document)).shapes.length).toBe(
      document.shapes.length,
    );
  });
  it("rejects malformed raster input", async () => {
    await expect(prepare(Buffer.from("bad image"), 6)).rejects.toThrow();
  });
  it("solid silhouettes fill enclosed holes without touching vectors", async () => {
    const input = await png(fixtures["nested holes"]);
    const doc = await trace(input, {
      ...settings,
      geometry: "solid",
      palette: ["#e63946"],
    });
    const out = await sharp(Buffer.from(exportSVG(doc)))
      .resize(64, 64)
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(out[(16 * 64 + 16) * 4 + 3]).toBe(255);
  });
  it("rejects project references and malicious transform/style fields", async () => {
    const doc = await trace(await png(fixtures["two color logo"]), settings);
    doc.shapes[0].stroke = "url(https://evil.test)";
    expect(() => exportSVG(doc)).toThrow();
    doc.shapes[0].stroke = "none";
    doc.shapes[0].transform = "url(file:///secret)";
    expect(() => exportSVG(doc)).toThrow();
  });
  it("handles uncompressed BMP and rejects truncated bitmaps", async () => {
    const header = Buffer.alloc(54 + 16);
    header.write("BM");
    header.writeUInt32LE(header.length, 2);
    header.writeUInt32LE(54, 10);
    header.writeUInt32LE(40, 14);
    header.writeInt32LE(2, 18);
    header.writeInt32LE(2, 22);
    header.writeUInt16LE(1, 26);
    header.writeUInt16LE(24, 28);
    header.fill(255, 54);
    const p = await prepare(header, 2);
    expect(p.width).toBe(2);
    await expect(prepare(header.subarray(0, 55), 2)).rejects.toThrow();
  });
});
