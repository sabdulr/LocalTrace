const { flatten } = require("./geometry.cjs");
const clipping = require("polygon-clipping");
const { validateDoc } = require("./validate.cjs");
function inside(p, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
const area = (r) =>
  r.reduce((sum, p, i) => {
    const q = r[(i + 1) % r.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
function polygons(shape, tolerance) {
  const rings = flatten(shape.d, shape.transform, tolerance);
  if (rings.some((r) => !r.closed))
    throw Error("Close paths before merging regions");
  const items = rings
    .filter((r) => r.points.length >= 3)
    .map((r) => ({
      points: r.points,
      area: area(r.points),
      parent: null,
      kind: "",
      polygon: null,
    }));
  for (const r of items)
    r.parent =
      items
        .filter(
          (p) =>
            p !== r &&
            Math.abs(p.area) > Math.abs(r.area) &&
            inside(r.points[0], p.points),
        )
        .sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0] || null;
  for (const r of items) {
    let depth = 0,
      winding = 0,
      p = r.parent;
    while (p) {
      depth++;
      winding += Math.sign(p.area);
      p = p.parent;
    }
    const before =
        shape.fillRule === "evenodd" ? depth % 2 !== 0 : winding !== 0,
      after =
        shape.fillRule === "evenodd"
          ? !before
          : winding + Math.sign(r.area) !== 0;
    r.kind =
      !before && after ? "outer" : before && !after ? "hole" : "redundant";
    if (r.kind === "outer") r.polygon = [r.points];
  }
  for (const r of items.filter((r) => r.kind === "hole")) {
    let p = r.parent;
    while (p && p.kind !== "outer") p = p.parent;
    if (p) p.polygon.push(r.points);
  }
  return items.filter((r) => r.polygon).map((r) => r.polygon);
}
function mergeRegions(document, ids, tolerance = 0.2) {
  validateDoc(document);
  const doc = structuredClone(document),
    shapes = doc.shapes.filter((s) => ids.includes(s.id));
  if (shapes.length < 2)
    throw Error("Select at least two shapes in one color layer");
  const first = shapes[0],
    layer = doc.layers.find((l) => l.id === first.layerId);
  if (
    layer.locked ||
    shapes.some(
      (s) =>
        s.layerId !== first.layerId ||
        s.fill !== first.fill ||
        s.opacity !== 1 ||
        s.stroke !== "none",
    )
  )
    throw Error(
      "Merge requires unlocked, opaque, unstroked shapes of one color in the same layer",
    );
  const inputs = shapes.flatMap((s) => polygons(s, tolerance));
  if (!inputs.length) throw Error("No closed regions to merge");
  const union = clipping.union(...inputs);
  const d = union
    .map((poly) =>
      poly
        .map((r) => "M" + r.map((p) => p.join(" ")).join("L") + "Z")
        .join(" "),
    )
    .join(" ");
  doc.shapes = doc.shapes.filter(
    (s) => !ids.includes(s.id) || s.id === first.id,
  );
  doc.shapes.find((s) => s.id === first.id).d = d;
  Object.assign(
    doc.shapes.find((s) => s.id === first.id),
    { transform: "", fillRule: "evenodd" },
  );
  return validateDoc(doc);
}
module.exports = { mergeRegions, polygons };
