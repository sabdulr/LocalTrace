const svgpath = require("svgpath");
function flatten(d, transform = "", tolerance = 0.25) {
  if (!(tolerance > 0)) throw Error("Tolerance must be positive");
  const rings = [];
  let ring = null,
    point = [0, 0];
  const dist = (p, a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    return (
      Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) /
      (Math.hypot(dx, dy) || 1)
    );
  };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function cubic(a, b, c, d, depth = 0) {
    if (depth >= 16 || Math.max(dist(b, a, d), dist(c, a, d)) <= tolerance) {
      ring.points.push(d);
      return;
    }
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d),
      abc = mid(ab, bc),
      bcd = mid(bc, cd),
      m = mid(abc, bcd);
    cubic(a, ab, abc, m, depth + 1);
    cubic(m, bcd, cd, d, depth + 1);
  }
  const path = svgpath(d).transform(transform).abs().unshort().unarc();
  path.iterate((s, _i, x, y) => {
    if (s[0] === "M") {
      ring = { points: [[s[1], s[2]]], closed: false };
      rings.push(ring);
      point = [s[1], s[2]];
      return;
    }
    if (!ring) return;
    const a = [x, y];
    if (s[0] === "C") {
      cubic(a, [s[1], s[2]], [s[3], s[4]], [s[5], s[6]]);
      point = [s[5], s[6]];
    } else if (s[0] === "Q") {
      const q = [s[1], s[2]],
        b = [s[3], s[4]];
      cubic(
        a,
        [x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y)],
        [b[0] + (2 / 3) * (q[0] - b[0]), b[1] + (2 / 3) * (q[1] - b[1])],
        b,
      );
      point = b;
    } else if (s[0] === "L") {
      point = [s[1], s[2]];
      ring.points.push(point);
    } else if (s[0] === "H") {
      point = [s[1], y];
      ring.points.push(point);
    } else if (s[0] === "V") {
      point = [x, s[1]];
      ring.points.push(point);
    } else if (s[0].toUpperCase() === "Z") {
      ring.closed = true;
      point = ring.points[0];
    }
  });
  return rings;
}
function exportDXF(doc) {
  require("./validate.cjs").validateDoc(doc);
  const scale = doc.physicalWidth / doc.width,
    entities = [];
  for (const layer of doc.layers.filter((l) => l.visible))
    for (const shape of doc.shapes.filter(
      (s) => s.layerId === layer.id && s.visible,
    )) {
      for (const ring of flatten(shape.d, shape.transform, 0.15)) {
        if (ring.points.length < 2) continue;
        entities.push(
          "0",
          "LWPOLYLINE",
          "100",
          "AcDbEntity",
          "8",
          layer.id,
          "100",
          "AcDbPolyline",
          "90",
          String(ring.points.length),
          "70",
          ring.closed ? "1" : "0",
        );
        for (const [x, y] of ring.points)
          entities.push(
            "10",
            String(x * scale),
            "20",
            String((doc.height - y) * scale),
          );
      }
    }
  if (!entities.length) throw Error("No geometry to export");
  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...entities,
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\n");
}
module.exports = { flatten, exportDXF };
