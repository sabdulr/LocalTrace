// Windows BI_RGB bitmaps: 8-bit indexed, 24-bit BGR, 32-bit BGRA. Other compression is rejected.
function decodeBMP(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 54 || b.toString("ascii", 0, 2) !== "BM")
    throw Error("Invalid BMP");
  const offset = b.readUInt32LE(10),
    header = b.readUInt32LE(14),
    width = b.readInt32LE(18),
    signedHeight = b.readInt32LE(22),
    height = Math.abs(signedHeight),
    bits = b.readUInt16LE(28),
    compression = b.readUInt32LE(30);
  if (
    header < 40 ||
    width < 1 ||
    height < 1 ||
    width * height > 16000000 ||
    ![8, 24, 32].includes(bits) ||
    compression !== 0 ||
    b.readUInt16LE(26) !== 1
  )
    throw Error(
      "BMP supports uncompressed 8-, 24- and 32-bit images up to 16 megapixels",
    );
  const stride = Math.ceil((width * bits) / 32) * 4;
  if (offset + stride * height > b.length) throw Error("Truncated BMP");
  const data = Buffer.alloc(width * height * 4);
  let hasAlpha = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const src =
          offset +
          (signedHeight > 0 ? height - y - 1 : y) * stride +
          (x * bits) / 8,
        dst = (y * width + x) * 4;
      let c = src;
      if (bits === 8) {
        c = 14 + header + b[src] * 4;
        if (c + 4 > offset) throw Error("Invalid BMP palette");
      }
      data[dst] = b[c + 2];
      data[dst + 1] = b[c + 1];
      data[dst + 2] = b[c];
      data[dst + 3] = bits === 32 ? b[c + 3] : 255;
      if (data[dst + 3]) hasAlpha = true;
    }
  if (bits === 32 && !hasAlpha)
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data, width, height };
}
module.exports = { decodeBMP };
