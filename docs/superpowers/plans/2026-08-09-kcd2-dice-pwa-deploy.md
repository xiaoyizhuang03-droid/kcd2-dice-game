# 骰子游戏 PWA 化与 GitHub Pages 部署 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将骰子游戏部署为 GitHub Pages 即点即玩网站，并增加 PWA 能力（可安装到主屏、离线可玩）。

**Architecture:** 游戏本体（`index.html` + `css/` + `js/`）是纯静态零构建应用，逻辑零改动。新增四类产物：程序化图标（`scripts/gen-icons.mjs` 用 Node 无依赖生成 PNG）、`manifest.webmanifest`、`sw.js` + `js/sw-register.js`（离线缓存）、`index.html`/`css/style.css` 的挂载与移动端微调。全部改动以 `test/pwa.test.js` 驱动（TDD），最后合并 `feat/kcd2-dice-game` 到 `main` 并通过 GitHub 连接器部署。

**Tech Stack:** Node.js 22（无任何新增 npm 依赖，PNG 编码用内置 `node:zlib`）、原生 ES Module、Service Worker、GitHub Pages。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| 新增 `scripts/gen-icons.mjs` | 无依赖 Node 脚本：迷你 PNG 编码器 + 程序化绘制骰子主题图标，输出 `icons/icon-192.png`、`icons/icon-512.png` |
| 新增 `icons/icon-192.png`、`icons/icon-512.png` | 应用图标（由脚本生成，提交进仓库） |
| 新增 `manifest.webmanifest` | PWA 清单：应用名、standalone、主题色、图标 |
| 新增 `sw.js` | Service Worker：白名单预缓存 + cache-first + 新版本清理 |
| 新增 `js/sw-register.js` | 仅 HTTPS/localhost 注册 SW，失败静默降级 |
| 修改 `index.html` | 挂 manifest/theme-color/图标链接、viewport 加固、挂载注册脚本 |
| 修改 `css/style.css` | 末尾追加 `@media (max-width: 640px)` 移动端适配 |
| 新增 `test/pwa.test.js` | 图标/清单/SW 覆盖/HTML 挂载的断言 |
| 修改 `package.json` | `test` 脚本追加 `node test/pwa.test.js` |

---

## Task 1: 图标生成脚本 + 生成图标

**Files:**
- Create: `scripts/gen-icons.mjs`
- Test: `test/pwa.test.js`

- [ ] **Step 1: 写失败测试（新建 test/pwa.test.js，先只测图标，骨架一次写全）**

```js
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node test/pwa.test.js`
Expected: 输出 4 个 `✗`（文件不存在），最后 `1 个断言失败`（failures=4），exit 1。

- [ ] **Step 3: 实现 scripts/gen-icons.mjs 并运行生成**

```js
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
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// —— 图标绘制（与游戏主题一致：深木底 + 骨色骰子 + 金色三点）——
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function renderIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const put = (x, y, r, g, b) => {
    const i = (Math.round(x) * size + Math.round(y)) * 4; // 注意：x 为横坐标
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
```

Run: `node scripts/gen-icons.mjs`
Expected: 输出 `生成 icons/icon-192.png`、`生成 icons/icon-512.png`。

- [ ] **Step 4: 跑测试，确认通过**

Run: `node test/pwa.test.js`
Expected: `[Task 1] 图标文件` 下 4 个 `✓`，末尾 `pwa.test.js 全部通过`，exit 0。

- [ ] **Step 5: 提交**

```bash
git add scripts/gen-icons.mjs test/pwa.test.js icons/
git commit -m "feat: 程序化生成骰子主题应用图标（PWA）"
```

---

## Task 2: manifest.webmanifest

**Files:**
- Create: `manifest.webmanifest`
- Test: `test/pwa.test.js`（追加断言）

- [ ] **Step 1: 追加失败断言（在文件末尾汇总退出逻辑之前插入）**

在 `if (failures > 0) ...` 之前插入：

```js
console.log('\n[Task 2] manifest');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
ok(manifest.name === '骰子 \u00b7 酒馆博弈', 'manifest.name 正确');
ok(manifest.display === 'standalone', 'manifest.display 为 standalone');
ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest.icons 含图标');
for (const ic of manifest.icons) {
  ok(existsSync(join(ROOT, ic.src)), `图标 ${ic.src} 文件存在`);
}
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node test/pwa.test.js`
Expected: `[Task 2] manifest` 下出现 `✗`（读文件失败抛错或断言失败），exit 1。

- [ ] **Step 3: 创建 manifest.webmanifest**

```json
{
  "name": "骰子 · 酒馆博弈",
  "short_name": "骰子",
  "description": "天国拯救2 风格骰子游戏：对战 AI 或本地双人，掷骰、计分、收集徽章。",
  "id": "./",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#241a10",
  "theme_color": "#3d2b1f",
  "lang": "zh-CN",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node test/pwa.test.js`
Expected: `[Task 2] manifest` 下全部 `✓`，`pwa.test.js 全部通过`，exit 0。

- [ ] **Step 5: 提交**

```bash
git add manifest.webmanifest test/pwa.test.js
git commit -m "feat: 添加 PWA 清单（standalone、主题色、图标）"
```

---

## Task 3: Service Worker + 注册脚本

**Files:**
- Create: `sw.js`
- Create: `js/sw-register.js`
- Test: `test/pwa.test.js`（追加断言）

- [ ] **Step 1: 追加失败断言（末尾汇总之前插入）**

```js
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node test/pwa.test.js`
Expected: `[Task 3] Service Worker` 下多个 `✗`（sw.js 不存在），exit 1。

- [ ] **Step 3: 创建 sw.js**

```js
// Service Worker：白名单预缓存 + cache-first，离线可玩
const CACHE = 'dice-v1';
// 白名单：精确列举全部本地静态资源（相对 sw.js 的路径，部署到子路径也正确）
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/engine.js',
  './js/rules.js',
  './js/dice.js',
  './js/badges.js',
  './js/ai.js',
  './js/tutorial.js',
  './js/ui.js',
  './js/sound.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((rel) => new URL(rel, self.registration.scope).href)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 不缓存跨域资源（如 Google Fonts）
  const inWhitelist = ASSETS.some((rel) =>
    url.pathname === new URL(rel, self.registration.scope).pathname
  );
  if (!inWhitelist) return; // 白名单外走网络
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
```

- [ ] **Step 4: 创建 js/sw-register.js**

```js
// 注册 Service Worker：仅 HTTPS 或本机开发环境；失败静默降级（不影响游戏）
if ('serviceWorker' in navigator) {
  const secure = location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);
  if (secure) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `node test/pwa.test.js`
Expected: `[Task 3] Service Worker` 下全部 `✓`，`pwa.test.js 全部通过`，exit 0。

- [ ] **Step 6: 提交**

```bash
git add sw.js js/sw-register.js test/pwa.test.js
git commit -m "feat: 添加 Service Worker 白名单缓存与注册脚本"
```

---

## Task 4: index.html 挂载 + 移动端 CSS

**Files:**
- Modify: `index.html`（viewport 第 5 行、`<head>` 第 10 行后、`<body>` 末尾第 122 行后）
- Modify: `css/style.css`（文件末尾追加）
- Test: `test/pwa.test.js`（追加断言）

- [ ] **Step 1: 追加失败断言（末尾汇总之前插入）**

```js
console.log('\n[Task 4] index.html 挂载与移动端样式');
ok(html.includes('rel="manifest" href="manifest.webmanifest"'), '挂载 manifest');
ok(html.includes('name="theme-color" content="#3d2b1f"'), '含 theme-color meta');
ok(html.includes('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"'), 'viewport 已加固');
ok(html.includes('js/sw-register.js'), '挂载 SW 注册脚本');
const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
ok(css.includes('@media (max-width: 640px)'), 'CSS 含移动端媒体查询');
```

注意：此处复用的 `html` 变量在 Task 3 已定义于同一作用域（`const html = ...`），直接沿用，不要重复声明。

- [ ] **Step 2: 跑测试，确认失败**

Run: `node test/pwa.test.js`
Expected: `[Task 4]` 下多个 `✗`（viewport/manifest/css 均未改），exit 1。

- [ ] **Step 3: 修改 index.html**

第 5 行 viewport 替换为：

```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
```

第 10 行（Google Fonts link）之后插入：

```html
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#3d2b1f">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
```

第 122 行 `<script type="module" src="js/main.js"></script>` 之后插入：

```html
  <script src="js/sw-register.js" defer></script>
```

- [ ] **Step 4: 修改 css/style.css（文件末尾追加）**

```css

/* —— 移动端适配（PWA 添加到主屏后竖屏） —— */
@media (max-width: 640px) {
  .game { padding: 14px 10px; }
  .game-header { flex-direction: column; gap: 10px; }
  .scoreboard { grid-template-columns: 1fr; gap: 8px; }
  .player-score { font-size: 34px; }
  .dice-area { min-height: 112px; gap: 8px; }
  .actions { gap: 8px; }
  .btn { padding: 10px 14px; font-size: 14px; }
}
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `node test/pwa.test.js`
Expected: `[Task 4]` 下全部 `✓`，`pwa.test.js 全部通过`，exit 0。

- [ ] **Step 6: 提交**

```bash
git add index.html css/style.css test/pwa.test.js
git commit -m "feat: index.html 挂载 PWA 资源并适配移动端竖屏"
```

---

## Task 5: 全量回归 + 脚本接入

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 修改 package.json，把 pwa 测试并入 test 脚本**

原 `"test": "node test/rules.test.js && node test/engine.test.js && node test/simulate.test.js"` 改为：

```json
    "test": "node test/rules.test.js && node test/engine.test.js && node test/simulate.test.js && node test/pwa.test.js",
```

- [ ] **Step 2: 语法检查新脚本**

Run: `node --check sw.js; node --check js/sw-register.js; node --check scripts/gen-icons.mjs`
Expected: 无任何输出（三个文件语法均合法），exit 0。

- [ ] **Step 3: 跑全量测试**

Run: `npm test`
Expected: `rules.test.js 全部通过`、`engine.test.js 全部通过`、`simulate.test.js 全部通过`、`pwa.test.js 全部通过`，exit 0。

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "chore: pwa 测试并入 npm test"
```

---

## Task 6: 合并 main + GitHub Pages 部署

**Files:** 无代码改动（纯 git / GitHub 连接器操作）

- [ ] **Step 1: 检查分支现状**

Run: `git branch -a`
Expected: 当前在 `feat/kcd2-dice-game`。若不存在 `main`/`master`，先创建：`git branch -m feat/kcd2-dice-game main`（之后 Step 2 跳过）。

- [ ] **Step 2: 合并到 main**

```bash
git checkout main
git merge feat/kcd2-dice-game --no-ff -m "merge: 骰子游戏完整功能与 PWA 化合并到 main"
```

- [ ] **Step 3: 确认 GitHub 连接器可用（未授权则先授权）**

通过 GitHub 插件（`trae-remote-official:github`）检查连接状态。若连接器未初始化/未授权，调用 `RequestAuthorization`（service: `trae-remote-official:github::github`）后再继续。

- [ ] **Step 4: 创建公开仓库并推送**

通过 GitHub 连接器创建公开仓库 `kcd2-dice-game`（若已存在同名仓库则复用并提示用户），推送 `main` 分支。

- [ ] **Step 5: 启用 GitHub Pages**

通过连接器在仓库 `Settings → Pages` 设置 `Source: Deploy from a branch`、分支 `main`、目录 `/ (root)`。若连接器不支持该操作，指导用户手动开启并等待部署完成（约 1 分钟）。

- [ ] **Step 6: 验证部署**

打开 `https://<用户名>.github.io/kcd2-dice-game/`。**人工验收清单**（用户执行）：
- [ ] 在线打开即玩一局（掷骰/选骰/收手/AI 回合）
- [ ] 手机浏览器「添加到主屏」→ 全屏启动
- [ ] 飞行模式（离线）下刷新仍可游玩
- [ ] 手机竖屏无溢出
- [ ] Chrome DevTools `Application` 面板：manifest 可解析、SW 已激活、`dice-v1` 缓存含全部资源

---

## 自审记录

- **Spec 覆盖**：部署架构（Task 6）、manifest（Task 2）、sw + 注册脚本（Task 3）、图标（Task 1）、index.html 挂载 + viewport（Task 4）、移动端 CSS（Task 4）、验证（Task 5 + Task 6 清单）——全部有对应任务。
- **占位符扫描**：无 TBD/TODO，所有代码块完整可直接粘贴。
- **类型/命名一致性**：`ASSETS` 白名单路径、`icons/icon-192.png`、`js/sw-register.js`、`CACHE = 'dice-v1'` 在 Task 1–4 中跨任务一致；测试中 `html` 变量由 Task 3 定义、Task 4 沿用，无重复声明。
