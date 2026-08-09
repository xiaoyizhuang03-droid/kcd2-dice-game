// scripts/gen-icons.mjs —— 无依赖生成骰子主题应用图标（192/512 PNG）
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// —— 迷你 PNG 编码器（8bit RGBA）——
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, color type 6 (RGBA)
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // 每行 filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// —— 图标绘制（与游戏主题一致：深木底 + 骨色骰子 + 金色三点）——
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function renderIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const put = (x, y, r, g, b) => {
    const i = (Math.round(y) * size + Math.round(x)) * 4; // 标准行主序：(y,x)
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  const c = size / 2;
  // 木底：中心亮起的径向渐变
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size * 0.72);
      const k = clamp(1 - d, 0, 1);
      put(x, y, 36 + k * 14, 26 + k * 10, 16 + k * 6);
    }
  }
  // 骰子主体：圆角矩形（距离场）
  const d = size * 0.64;
  const x0 = (size - d) / 2, y0 = (size - d) / 2;
  const rad = d * 0.16;
  const sd = (px, py) => {
    const qx = Math.abs(px - (x0 + d / 2)) - (d / 2 - rad);
    const qy = Math.abs(py - (y0 + d / 2)) - (d / 2 - rad);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rad;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = sd(x + 0.5, y + 0.5);
      if (s < 0) {
        const light = 1 - clamp((y - y0) / d, 0, 1) * 0.16; // 顶部略暗浮雕
        put(x, y, 240 * light, 227 * light, 200 * light);
      }
    }
  }
  // 金色三点（数字 3 的斜排列）+ 深色描边
  const dotR = d * 0.055;
  const gap = d * 0.26;
  const dots = [[c, c], [c - gap, c - gap], [c + gap, c + gap]];
  const circle = (cx, cy, r, [r1, g1, b1], [r2, g2, b2]) => {
    for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
      for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= r) put(x, y, r1, g1, b1);          // 外圈暗色描边
        if (dist <= r * 0.72) put(x, y, r2, g2, b2);   // 内部主色
      }
    }
  };
  for (const [dx, dy] of dots) {
    circle(dx, dy, dotR, [0x14, 0x0e, 0x08], [0xc9, 0x97, 0x6b]);
  }
  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePNG(size, size, renderIcon(size)));
  console.log(`生成 icons/icon-${size}.png`);
}
