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

console.log('\n[Task 2] manifest');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
ok(manifest.name === '骰子 \u00b7 酒馆博弈', 'manifest.name 正确');
ok(manifest.display === 'standalone', 'manifest.display 为 standalone');
ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest.icons 含图标');
for (const ic of manifest.icons) {
  ok(existsSync(join(ROOT, ic.src)), `图标 ${ic.src} 文件存在`);
}

console.log('\n[Task 3] Service Worker');
const swSrc = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const assetsMatch = swSrc.match(/const ASSETS = \[([\s\S]*?)\];/);
ok(assetsMatch !== null, 'sw.js 含 ASSETS 白名单');
const assets = assetsMatch[1].match(/'[^']+'/g).map((s) => s.slice(1, -1).replace(/^\.\//, ''));
for (const rel of assets) {
  ok(existsSync(join(ROOT, rel)), `缓存名单覆盖实际文件 ${rel}`);
}
// 覆盖检查：index.html 引用的本地静态资源全部在缓存名单内
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="((?!https?:|#)[^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ''));
for (const ref of refs) {
  if (!existsSync(join(ROOT, ref))) continue; // 跳过尚不存在的挂载（Task 4 才加）
  const rel = ref.replace(/^\.\//, '');
  if (rel === 'js/sw-register.js') continue; // SW 不缓存自身注册脚本
  ok(assets.includes(rel), `资源 ${rel} 在缓存名单内`);
}
// js/ 目录所有业务模块都被覆盖
for (const f of readdirSync(join(ROOT, 'js'))) {
  if (f === 'sw-register.js') continue;
  ok(assets.includes(`js/${f}`), `js/${f} 在缓存名单内`);
}
ok(swSrc.includes('self.skipWaiting()'), 'sw.js 使用 skipWaiting');
ok(swSrc.includes('clients.claim'), 'sw.js 使用 clients.claim');
const register = readFileSync(join(ROOT, 'js/sw-register.js'), 'utf8');
ok(register.includes("'serviceWorker' in navigator"), '注册脚本检测 SW 支持');

console.log('\n[Task 4] index.html 挂载与移动端样式');
ok(html.includes('rel="manifest" href="manifest.webmanifest"'), '挂载 manifest');
ok(html.includes('name="theme-color" content="#3d2b1f"'), '含 theme-color meta');
ok(html.includes('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"'), 'viewport 已加固');
ok(html.includes('js/sw-register.js'), '挂载 SW 注册脚本');
const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
ok(css.includes('@media (max-width: 640px)'), 'CSS 含移动端媒体查询');

if (failures > 0) { console.error(`\n${failures} 个断言失败`); process.exit(1); }
console.log('\npwa.test.js 全部通过');
