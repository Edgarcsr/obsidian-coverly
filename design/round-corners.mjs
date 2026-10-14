// Arredonda os cantos de um PNG (deixa-os transparentes), sem dependências.
// Uso: node design/round-corners.mjs docs/banner.png 72
// O raio é em pixels da imagem (o banner sai em 2x, então 72 = 36px de CSS).
import { readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const [file, radiusArg = "72"] = process.argv.slice(2);
const radius = Number(radiusArg);
const buf = readFileSync(file);

let pos = 8;
let width = 0;
let height = 0;
let colorType = 0;
const idat = [];
while (pos < buf.length) {
  const length = buf.readUInt32BE(pos);
  const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + length);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    colorType = data[9];
  }
  if (type === "IDAT") {
    idat.push(data);
  }
  pos += 12 + length;
}
if (colorType !== 2 && colorType !== 6) {
  throw new Error(`Unsupported PNG color type ${colorType}`);
}

const bpp = colorType === 6 ? 4 : 3;
const raw = inflateSync(Buffer.concat(idat));
const stride = width * bpp;
const pixels = Buffer.alloc(height * stride);
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  for (let x = 0; x < stride; x++) {
    const value = raw[y * (stride + 1) + 1 + x];
    const left = x >= bpp ? pixels[y * stride + x - bpp] : 0;
    const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
    const upLeft = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0;
    let out = value;
    if (filter === 1) {
      out = value + left;
    } else if (filter === 2) {
      out = value + up;
    } else if (filter === 3) {
      out = value + ((left + up) >> 1);
    } else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      out = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
    }
    pixels[y * stride + x] = out & 255;
  }
}

/** Cobertura (0 a 1) do pixel dentro do retângulo arredondado, com suavização. */
const coverage = (x, y) => {
  const cx = x + 0.5 < radius ? radius : x + 0.5 > width - radius ? width - radius : x + 0.5;
  const cy = y + 0.5 < radius ? radius : y + 0.5 > height - radius ? height - radius : y + 0.5;
  const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return Math.min(1, Math.max(0, radius - distance + 0.5));
};

const rgba = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++) {
  const row = y * (width * 4 + 1);
  rgba[row] = 0;
  for (let x = 0; x < width; x++) {
    const src = y * stride + x * bpp;
    const dst = row + 1 + x * 4;
    rgba[dst] = pixels[src];
    rgba[dst + 1] = pixels[src + 1];
    rgba[dst + 2] = pixels[src + 2];
    const original = bpp === 4 ? pixels[src + 3] : 255;
    rgba[dst + 3] = Math.round(original * coverage(x, y));
  }
}

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
writeFileSync(
  file,
  Buffer.concat([
    buf.subarray(0, 8),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rgba, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
);
