const svgpath = require("svgpath");
const color = (s) =>
  typeof s === "string" &&
  /^(#[0-9a-f]{3,8}|[a-z]+|rgb\([\d ,. %]+\))$/i.test(s);
function transform(s) {
  if (typeof s !== "string" || s.length > 10000) return false;
  const commands = [
    ...s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g),
  ];
  if (
    s
      .replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, "")
      .trim()
  )
    return false;
  const arities = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  };
  return commands.every(([, name, args]) => {
    const numbers =
      args.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi) || [];
    return (
      !args
        .replace(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi, "")
        .replace(/[,\s]/g, "") &&
      arities[name].includes(numbers.length) &&
      numbers.every(
        (n) => Number.isFinite(Number(n)) && Math.abs(Number(n)) <= 1e9,
      )
    );
  });
}
function validateDoc(doc) {
  if (
    !doc ||
    doc.version !== 1 ||
    ![doc.width, doc.height, doc.physicalWidth].every(
      (v) => Number.isFinite(v) && v > 0 && v <= 50000,
    ) ||
    !Array.isArray(doc.layers) ||
    !Array.isArray(doc.shapes) ||
    doc.layers.length > 200000 ||
    doc.shapes.length > 200000
  )
    throw Error("Invalid project dimensions or structure");
  if (
    doc.registrationMarks !== undefined &&
    typeof doc.registrationMarks !== "boolean"
  )
    throw Error("Invalid registration marks");
  const ids = new Set();
  for (const l of doc.layers) {
    if (
      !/^layer-[\w-]+$/.test(l.id) ||
      ids.has(l.id) ||
      typeof l.name !== "string" ||
      l.name.length > 500 ||
      !color(l.color) ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean"
    )
      throw Error("Invalid layer");
    ids.add(l.id);
  }
  const shapeIds = new Set();
  let length = 0;
  for (const s of doc.shapes) {
    length += s.d?.length || 0;
    if (
      !/^shape-[\w-]+$/.test(s.id) ||
      shapeIds.has(s.id) ||
      !ids.has(s.layerId) ||
      typeof s.d !== "string" ||
      s.d.length > 5e6 ||
      !color(s.fill) ||
      !color(s.stroke) ||
      !transform(s.transform) ||
      !Number.isFinite(s.opacity) ||
      s.opacity < 0 ||
      s.opacity > 1 ||
      !["evenodd", "nonzero"].includes(s.fillRule) ||
      typeof s.visible !== "boolean"
    )
      throw Error("Invalid shape");
    if (svgpath(s.d).err || /NaN|Infinity/.test(s.d))
      throw Error("Invalid geometry");
    shapeIds.add(s.id);
  }
  if (
    doc.shapes.some(
      (s) =>
        s.strokeWidth !== undefined &&
        (!Number.isFinite(s.strokeWidth) ||
          s.strokeWidth < 0 ||
          s.strokeWidth > 50000),
    )
  )
    throw Error("Invalid stroke width");
  for (const shape of doc.shapes) {
    let finite = true;
    svgpath(shape.d).iterate((segment) => {
      if (
        segment.slice(1).some((n) => !Number.isFinite(n) || Math.abs(n) > 1e9)
      )
        finite = false;
    });
    if (!finite) throw Error("Path coordinates exceed supported limits");
  }
  if (length > 25e6) throw Error("Project geometry is too large");
  return doc;
}
module.exports = { validateDoc, color, transform };
