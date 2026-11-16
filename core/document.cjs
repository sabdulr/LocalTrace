const { DOMParser } = require("@xmldom/xmldom");
const svgpath = require("svgpath");
const {
  validateDoc,
  color,
  transform: validTransform,
} = require("./validate.cjs");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
function parseSVG(text) {
  if (
    typeof text !== "string" ||
    text.length > 30e6 ||
    /<!DOCTYPE|<!ENTITY/i.test(text)
  )
    throw Error("Unsupported or oversized SVG");
  const errors = [];
  const xml = new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") errors.push(message);
    },
  }).parseFromString(text, "image/svg+xml");
  const root = xml.documentElement;
  if (errors.length || root?.localName !== "svg") throw Error("Invalid SVG");
  const vb = (root.getAttribute("viewBox") || "")
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  const width =
    vb.length === 4 ? vb[2] : parseFloat(root.getAttribute("width"));
  const height =
    vb.length === 4 ? vb[3] : parseFloat(root.getAttribute("height"));
  if (!(width > 0 && height > 0 && width <= 50000 && height <= 50000))
    throw Error("SVG requires valid dimensions");
  const layers = [],
    shapes = [];
  let lastColor = "";
  let current;
  function visit(
    node,
    fill = "#000000",
    transform = "",
    hidden = false,
    stroke = "none",
    opacity = 1,
    fillRule = "nonzero",
    strokeWidth = 1,
    depth = 0,
  ) {
    if (depth > 100) throw Error("SVG nesting is too deep");
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === "svg" && depth > 0)
      throw Error("Nested SVG viewports must be flattened before import");
    if (tag === "style")
      throw Error("CSS styling must be flattened before import");
    if (
      ![
        "svg",
        "g",
        "path",
        "rect",
        "circle",
        "ellipse",
        "polygon",
        "polyline",
        "line",
      ].includes(tag)
    )
      return;
    if (
      [
        "clip-path",
        "mask",
        "filter",
        "style",
        "fill-opacity",
        "stroke-opacity",
        "vector-effect",
        "stroke-dasharray",
      ].some((k) => node.hasAttribute(k))
    )
      throw Error(
        "SVG styles, clipping, masks, filters and advanced paint attributes must be flattened before import",
      );
    if (
      tag === "g" &&
      node.hasAttribute("opacity") &&
      Number(node.getAttribute("opacity")) !== 1
    )
      throw Error("Group opacity must be flattened before import");
    fill = node.getAttribute("fill") || fill;
    if (!/^(#[0-9a-f]{3,8}|[a-z]+|rgb\([\d ,. %]+\))$/i.test(fill))
      throw Error("Unsupported SVG fill");
    hidden = hidden || node.getAttribute("display") === "none";
    stroke = node.getAttribute("stroke") || stroke;
    strokeWidth = node.hasAttribute("stroke-width")
      ? Number(node.getAttribute("stroke-width"))
      : strokeWidth;
    opacity = node.hasAttribute("opacity")
      ? Number(node.getAttribute("opacity"))
      : opacity;
    fillRule = node.getAttribute("fill-rule") || fillRule;
    transform = [transform, node.getAttribute("transform")]
      .filter(Boolean)
      .join(" ");
    if (!validTransform(transform)) throw Error("Invalid SVG transform");
    if (node.hasAttribute("stroke") && !color(node.getAttribute("stroke")))
      throw Error("Unsupported stroke");
    const n = (k) => Number(node.getAttribute(k) || 0);
    let d = node.getAttribute("d");
    if (tag === "rect") {
      const x = n("x"),
        y = n("y"),
        w = n("width"),
        h = n("height"),
        rx = Math.min(n("rx") || n("ry"), w / 2),
        ry = Math.min(n("ry") || rx, h / 2);
      d =
        rx && ry
          ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
          : `M${x} ${y}h${w}v${h}h${-w}Z`;
    }
    if (tag === "circle" || tag === "ellipse") {
      const x = n("cx"),
        y = n("cy"),
        rx = tag === "circle" ? n("r") : n("rx"),
        ry = tag === "circle" ? rx : n("ry");
      d = `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    if (tag === "polygon" || tag === "polyline")
      d = "M" + node.getAttribute("points") + (tag === "polygon" ? "Z" : "");
    if (tag === "line") d = `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
    if (d) {
      const path = svgpath(d);
      if (path.err) throw Error("Invalid path geometry");
      const normalized = path
        .transform(transform)
        .translate(-(vb[0] || 0), -(vb[1] || 0))
        .toString();
      // Contiguous runs preserve painter order even when the same color appears at different depths.
      if (!current || lastColor !== fill || current.visible === hidden) {
        current = {
          id: `layer-${layers.length + 1}`,
          name: `Color ${fill} · ${layers.length + 1}`,
          color: fill,
          visible: !hidden,
          locked: false,
        };
        layers.push(current);
        lastColor = fill;
      }
      shapes.push({
        id: `shape-${shapes.length + 1}`,
        layerId: current.id,
        d: normalized,
        fill,
        stroke,
        strokeWidth,
        opacity,
        fillRule: fillRule === "evenodd" ? "evenodd" : "nonzero",
        transform: "",
        visible: !hidden,
      });
    }
    for (let c = node.firstChild; c; c = c.nextSibling)
      visit(
        c,
        fill,
        transform,
        hidden,
        stroke,
        opacity,
        fillRule,
        strokeWidth,
        depth + 1,
      );
  }
  visit(root);
  if (!shapes.length) throw Error("No supported vector geometry found");
  return validateDoc({
    version: 1,
    width,
    height,
    layers,
    shapes,
    physicalWidth: (width * 25.4) / 96,
  });
}
function exportSVG(doc, layerId) {
  validateDoc(doc);
  const layers = doc.layers.filter(
    (l) => l.visible && (!layerId || l.id === layerId),
  );
  if (
    !layers.some((l) => doc.shapes.some((s) => s.layerId === l.id && s.visible))
  )
    throw Error("Nothing visible to export");
  const body = layers
    .map(
      (l) =>
        `<g id="${esc(l.id)}" inkscape:groupmode="layer" inkscape:label="${esc(l.name)}" fill="${esc(l.color)}">` +
        doc.shapes
          .filter((s) => s.layerId === l.id && s.visible)
          .map(
            (s) =>
              `<path id="${esc(s.id)}" d="${esc(s.d)}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth ?? 1}" opacity="${s.opacity}" fill-rule="${s.fillRule}" transform="${esc(s.transform)}"/>`,
          )
          .join("") +
        "</g>",
    )
    .join("");
  const margin = doc.registrationMarks
      ? (doc.width / doc.physicalWidth) * 5
      : 0,
    r = margin * 0.2;
  const marks = margin
    ? `<g id="registration-marks" fill="#000000">` +
      [
        [-margin / 2, -margin / 2],
        [doc.width + margin / 2, -margin / 2],
        [-margin / 2, doc.height + margin / 2],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x - r} ${y - r}h${r * 2}v${r * 2}h${-r * 2}Z"/>`,
        )
        .join("") +
      "</g>"
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="${-margin} ${-margin} ${doc.width + 2 * margin} ${doc.height + 2 * margin}" width="${doc.physicalWidth + 10 * (margin ? 1 : 0)}mm" height="${(doc.physicalWidth * doc.height) / doc.width + 10 * (margin ? 1 : 0)}mm">${body}${marks}</svg>`;
}
module.exports = { parseSVG, exportSVG };
