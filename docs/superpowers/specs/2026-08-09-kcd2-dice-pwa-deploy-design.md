# 骰子游戏 PWA 化与 GitHub Pages 部署 — 设计规格

- 日期：2026-08-09
- 状态：已确认
- 前置：`2026-08-08-kcd2-dice-game-design.md`（游戏本体已实现，测试三套件全绿）

## 1. 概述

将已完成的《天国拯救2》风格骰子游戏（纯静态网页，原生 ES Module + Canvas 2D，零构建链）改造为「即点即玩」网站：部署到 GitHub Pages 公网访问，并增加 PWA 能力（可安装到主屏、离线可玩）。游戏本体逻辑零改动。

## 2. 部署架构

- 无需构建步骤，直接部署项目根目录到 GitHub Pages（`Deploy from branch`，根目录）。
- 访问链接：`https://<用户名>.github.io/<仓库名>/`。
- 当前开发分支 `feat/kcd2-dice-game` 先合并回 `main`，再从 `main` 部署。
- 仓库包含完整源码（`js/`、`css/`、`test/`、`docs/`），Pages 只对外服务静态文件，`test/`、`docs/` 不影响站点。

## 3. PWA 能力

### 3.1 新增文件

| 文件 | 内容 |
|---|---|
| `manifest.webmanifest` | 应用名「骰子游戏」、`display: standalone`、`start_url: ./`、`theme_color`/`background_color` 取深木色（与 CSS 主题一致）、icons 192/512 |
| `sw.js` | 安装时预缓存全部静态资源（`index.html`、`css/`、`js/`、`manifest`、图标）；运行时 cache-first；`skipWaiting` + `clients.claim` 保证新版本立即生效 |
| `icons/icon-192.png`、`icons/icon-512.png` | 程序化生成的骰子主题图标（Canvas 绘制：深木底 + 骨色骰子 + 金色点坑） |

### 3.2 对 `index.html` 的改动（仅挂载，不动逻辑）

- `<head>` 增加：`<link rel="manifest" href="manifest.webmanifest">`、`<meta name="theme-color">`、`<script src="js/sw-register.js" defer>`（body 末尾）。
- 新增独立脚本 `js/sw-register.js`：仅在 HTTPS 或 `localhost` 环境注册 SW（`if ('serviceWorker' in navigator)`），注册失败静默降级（页面仍正常使用）。

### 3.3 离线策略

- SW 缓存名单为白名单精确列举（禁止缓存 Google Fonts 等跨域资源）。
- 离线时 Google Fonts 不可用，CSS 已内建 Georgia 回退，视觉可接受。
- 不引入任何 PWA 框架/构建工具，保持零依赖。

## 4. 移动端触控微调（最小改动）

- `index.html` 的 viewport meta 增加 `user-scalable=no`、`viewport-fit=cover`，避免手机双击缩放干扰点骰。
- `css/style.css` 增加一条 `@media (max-width: 640px)`：减小内边距、确保骰子画布与按钮在竖屏不溢出。
- 交互本身为 click 事件，移动端天然可用，无需额外适配。

## 5. 仓库与部署流程

1. 通过 GitHub 连接器（`trae-remote-official:github`）创建公开仓库（名称建议 `kcd2-dice-game`）。
2. 合并 `feat/kcd2-dice-game` 到 `main`，推送。
3. 启用 GitHub Pages：`Settings → Pages → Source: Deploy from a branch, main / root`。
4. 若连接器未授权，先走 `RequestAuthorization` 流程。

## 6. 验证

- 现有 `npm test` 三套件保持全绿（不受改动影响）。
- 本地验证：`npx serve .` 启动，DevTools Application 面板确认 manifest 可解析、SW 注册成功；DevTools 切 Offline 刷新页面仍可完整游玩一局。
- 部署后验证：打开 Pages URL 在线可玩；手机浏览器「添加到主屏」后全屏启动、飞行模式离线可玩。
- 移动端竖屏一局（掷骰/选骰/收手/AI 回合）无溢出。

## 7. 明确不做（YAGNI）

- 不做原生 APP 打包（Tauri/Capacitor/Electron），环境缺失且方向已改为网站。
- 不做自定义域名、CI 构建流水线、多分支版本。
- 不做跨域字体缓存。
