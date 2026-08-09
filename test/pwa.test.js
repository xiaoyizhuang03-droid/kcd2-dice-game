// test/pwa.test.js —— PWA 产物断言（TDD：先失败，实现后通过）
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  \u2713', msg);
  else { failures++; console.error('  \u2717', msg); }
};

const pngInfo = (file) => {
  const b = readFileSync(file);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

console.log('\n[Task 1] 图标文件');
for (const [size, file] of [[192, 'icons/icon-192.png'], [512, 'icons/icon-512.png']]) {
  const full = join(ROOT, file);
  const info = existsSync(full) ? pngInfo(full) : null;
  ok(info !== null, `${file} 存在且为合法 PNG`);
  ok(info && info.width === size && info.height === size, `${file} 尺寸为 ${size}x${size}`);
}

if (failures > 0) { console.error(`\n${failures} 个断言失败`); process.exit(1); }
console.log('\npwa.test.js 全部通过');
