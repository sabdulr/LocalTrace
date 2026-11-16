const sharp = require("sharp");
const vtracer = require("@visioncortex/vtracer");
const { detectPalette } = require("./palette.cjs");
const { parseSVG } = require("./document.cjs");
const { tracingPixels, restoreDimensions } = require("./quality.cjs");
async function decode(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 40e6)
    throw Error("Image exceeds 40 MB limit");
  const isBMP = bytes[0] === 66 && bytes[1] === 77;
  const bmp = isBMP ? require("./bmp.cjs").decodeBMP(bytes) : null;
  const source = bmp
    ? sharp(bmp.data, {
        raw: { width: bmp.width, height: bmp.height, channels: 4 },
      })
    : sharp(Buffer.from(bytes), {
        limitInputPixels: 16000000,
        animated: false,
      });
  const metadata = await source.metadata();
  if (
    !bmp &&
    !["png", "jpeg", "webp", "gif", "tiff", "heif"].includes(metadata.format)
  )
    throw Error("Unsupported raster format");
  let image = source.rotate();
  if (options.crop) {
    const { left, top, width, height } = options.crop;
    if (
      ![left, top, width, height].every(Number.isInteger) ||
      left < 0 ||
      top < 0 ||
      width < 1 ||
      height < 1
    )
      throw Error("Invalid crop");
    image = image.extract({ left, top, width, height });
  }
  if (options.resize) {
    const width = Number(options.resize);
    if (!Number.isInteger(width) || width < 16 || width > 4096)
      throw Error("Resize width must be 16–4096");
    image = image.resize({ width, withoutEnlargement: true });
  }
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
async function prepare(bytes, count = 6, options = {}) {
  if (!Number.isInteger(count) || count < 2 || count > 16)
    throw Error("Color count must be 2–16");
  const image = await decode(bytes, options),
    palette = options.palette || detectPalette(image.data, count);
  const { pixels, width, height } = await tracingPixels(
    image,
    palette,
    options,
  );
  const png = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png()
    .toBuffer();
  const preview = await sharp(pixels, {
    raw: { width, height, channels: 4 },
  })
    .resize(image.width, image.height)
    .png()
    .toBuffer();
  return {
    width: image.width,
    height: image.height,
    palette,
    original: "data:image/png;base64," + png.toString("base64"),
    preview: "data:image/png;base64," + preview.toString("base64"),
  };
}
// Adapter boundary: the UI and document model never depend on VTracer configuration types.
async function trace(bytes, settings) {
  const source = await decode(bytes, settings);
  const { pixels, width, height, factor } = await tracingPixels(
    source,
    settings.palette,
    settings,
  );
  const image = { width, height };
  if (!["stacked", "cutout", "solid"].includes(settings.geometry))
    throw Error("Unsupported geometry mode");
  if (!["spline", "polygon", "pixel"].includes(settings.mode))
    throw Error("Invalid curve mode");
  const speckle = Number(settings.speckle),
    simplify = Number(settings.simplify);
  if (
    !Number.isFinite(speckle) ||
    speckle < 0 ||
    speckle > 128 ||
    !Number.isFinite(simplify) ||
    simplify < 0 ||
    simplify > 10
  )
    throw Error("Invalid tracing parameters");
  if (settings.geometry === "solid") {
    const { fillHoles } = require("./silhouette.cjs");
    const document = {
      version: 1,
      width: image.width,
      height: image.height,
      physicalWidth: (image.width * 25.4) / 96,
      layers: [],
      shapes: [],
    };
    for (const [index, color] of settings.palette.entries()) {
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      const mask = new Uint8Array(image.width * image.height);
      for (let p = 0; p < mask.length; p++)
        mask[p] =
          pixels[p * 4 + 3] > 0 && rgb.every((v, j) => pixels[p * 4 + j] === v)
            ? 1
            : 0;
      if (!mask.some(Boolean)) continue;
      const filled = fillHoles(mask, image.width, image.height),
        rgba = Buffer.alloc(pixels.length);
      for (let p = 0; p < filled.length; p++)
        if (filled[p]) {
          rgba.set(rgb, p * 4);
          rgba[p * 4 + 3] = 255;
        }
      const part = parseSVG(
        vtracer.convertPixels(rgba, image.width, image.height, {
          mode: settings.mode,
          hierarchical: "cutout",
          filterSpeckle: Math.min(128, speckle * factor),
          simplify: simplify * factor,
          colorPrecision: 8,
          layerDifference: 0,
        }),
      );
      const layer = {
        id: `layer-${index + 1}`,
        name: `Solid ${color}`,
        color,
        visible: true,
        locked: false,
      };
      document.layers.push(layer);
      part.shapes.forEach((s) =>
        document.shapes.push({
          ...s,
          id: `shape-${document.shapes.length + 1}`,
          layerId: layer.id,
          fill: color,
        }),
      );
    }
    if (!document.shapes.length) throw Error("No visible silhouette remains");
    return restoreDimensions(document, source, factor);
  }
  const svg = vtracer.convertPixels(pixels, image.width, image.height, {
    mode: settings.mode,
    hierarchical: settings.geometry,
    filterSpeckle: Math.min(128, speckle * factor),
    simplify: simplify * factor,
    colorPrecision: 8,
    layerDifference: 0,
  });
  return restoreDimensions(parseSVG(svg), source, factor);
}
async function merge(doc, ids) {
  return require("./cleanup.cjs").mergeRegions(doc, ids);
}
module.exports = { prepare, trace, decode, merge };
