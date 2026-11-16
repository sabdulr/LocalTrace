import { it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { flatten, exportDXF } = require("../core/geometry.cjs");
const { parseSVG, exportSVG } = require("../core/document.cjs");
it("flattens curves with retained closed subpaths and transforms", () => {
  const rings = flatten(
    "M0 0C0 10 10 10 10 0Z M20 20H30V30Z",
    "translate(5 10)",
    0.1,
  );
  expect(rings).toHaveLength(2);
  expect(rings[0].closed).toBe(true);
  expect(rings[0].points.length).toBeGreaterThan(5);
  expect(rings[0].points[0]).toEqual([5, 10]);
});
it("exports physical millimetres in DXF with genuine polylines", () => {
  const doc = parseSVG(
    '<svg width="100" height="100"><path d="M0 0H100V100H0Z"/></svg>',
  );
  doc.physicalWidth = 50;
  expect(exportDXF(doc)).toContain("10\n50\n20\n50");
  expect(exportDXF(doc)).toContain("$INSUNITS\n70\n4");
});
it("registration marks extend the canvas while keeping artwork scale", () => {
  const doc = parseSVG(
    '<svg width="100" height="100"><path d="M0 0H100V100H0Z"/></svg>',
  );
  doc.physicalWidth = 50;
  doc.registrationMarks = true;
  const svg = exportSVG(doc);
  expect(svg).toContain('width="60mm"');
  expect(svg).toContain("registration-marks");
  expect(svg).toContain('viewBox="-10 -10 120 120"');
});
