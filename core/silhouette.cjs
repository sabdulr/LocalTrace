// Fill only enclosed background in an original-raster color mask. This never rasterizes vector geometry.
function fillHoles(mask, width, height) {
  const exterior = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length);
  let head = 0,
    tail = 0;
  const add = (i) => {
    if (!mask[i] && !exterior[i]) {
      exterior[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const i = queue[head++],
      x = i % width,
      y = Math.floor(i / width);
    if (x) add(i - 1);
    if (x + 1 < width) add(i + 1);
    if (y) add(i - width);
    if (y + 1 < height) add(i + width);
  }
  return mask.map((v, i) => (v || !exterior[i] ? 1 : 0));
}
module.exports = { fillHoles };
