# 天国拯救2 风格骰子游戏 Demo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个纯 Web 单页面的《天国拯救2》风格骰子游戏 Demo，含完整计分规则、8+1 种骰子、4 个徽章、自定义目标分、两种模式（玩家 vs AI / 本地双人）、新手教程与写实拟真风格渲染。

**Architecture:** 游戏逻辑与 UI 完全解耦：`rules.js`（计分纯函数）→ `engine.js`（可序列化状态机）→ `ui.js`（只读渲染）。Canvas 2D 程序化绘制木桌纹理与骨制骰子，零外部图片资源。引擎 reducer 式 API 为后续联机打包预留。

**Tech Stack:** 原生 ES Modules + Canvas 2D + CSS 动画 + WebAudio（程序化音效），Node（仅用于跑测试），零构建链，静态目录可直接打包 App。

**规格文档:** `docs/superpowers/specs/2026-08-08-kcd2-dice-game-design.md`

---

## 文件结构

```
d:\骰子\
  package.json           "type":"module"（测试用）
  index.html             单页入口
  css\style.css          写实拟真主题
  js\
    rules.js             计分纯函数（含通配骰、切口组合）
    dice.js              骰子定义（8+1 种）+ 加权掷骰
    badges.js            4 个徽章定义
    engine.js            可序列化游戏状态机
    ai.js                对手 AI（保守/激进）
    tutorial.js          新手教程（3 步 + 规则手册）
    ui.js                Canvas 渲染 + DOM 交互
    main.js              装配启动
  test\
    rules.test.js        rules/dice 单测
    engine.test.js       engine/badges/ai 单测
```

所有 JS 为 ES Module。测试用 `node test/xxx.test.js` 直接运行（`package.json` 声明 `"type":"module"`），断言用 Node 内置 `node:assert`。

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `index.html`（骨架）
- Create: `css/style.css`（占位）
- Create: `test/rules.test.js`（占位空文件，防 git 空目录）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "kcd2-dice-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node test/rules.test.js && node test/engine.test.js",
    "start": "npx serve ."
  }
}
```

- [ ] **Step 2: 创建 index.html 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>骰子 · 酒馆博弈</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: 创建 css/style.css 占位**

```css
:root {
  --wood-dark: #241a10;
  --wood: #3d2b1f;
  --bone: #f0e3c8;
  --gold: #c9976b;
  --text-light: #e8d5b0;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--wood-dark); color: var(--text-light); font-family: Georgia, "Times New Roman", serif; }
```

- [ ] **Step 4: 创建占位测试文件（空）**

```bash
mkdir -p test
# test/rules.test.js 留空占位，Task 2 填充
```

- [ ] **Step 5: 提交**

```bash
git add package.json index.html css/style.css
git commit -m "chore: 项目脚手架"
```

---

## Task 2: rules.js 计分核心（TDD）

**Files:**
- Create: `js/rules.js`
- Test: `test/rules.test.js`

**约定：** 骰面用 1-6；通配骰（恶魔之头）用 `DEVIL = 0`。`scoreSelection` 对通配骰做暴力分配（≤6 个通配，46656 次穷举，性能可接受）。

- [ ] **Step 1: 写失败测试**

`test/rules.test.js`：

```js
import assert from 'node:assert/strict';
import { scoreSelection, isBust, scoringDiceIndices, isValidSelection, DEVIL } from '../js/rules.js';

// 单骰
assert.equal(scoreSelection([1]), 100, '单1=100');
assert.equal(scoreSelection([5]), 50, '单5=50');
assert.equal(scoreSelection([2]), 0, '单2无分');
assert.equal(scoreSelection([]), 0, '空集合无分');

// 三同点
assert.equal(scoreSelection([1, 1, 1]), 1000, '三1=1000');
assert.equal(scoreSelection([2, 2, 2]), 200, '三2=200');
assert.equal(scoreSelection([3, 3, 3]), 300, '三3=300');
assert.equal(scoreSelection([4, 4, 4]), 400, '三4=400');
assert.equal(scoreSelection([5, 5, 5]), 500, '三5=500');
assert.equal(scoreSelection([6, 6, 6]), 600, '三6=600');

// 每多一颗翻倍
assert.equal(scoreSelection([1, 1, 1, 1]), 2000, '四1=2000');
assert.equal(scoreSelection([2, 2, 2, 2, 2]), 800, '五2=800');
assert.equal(scoreSelection([6, 6, 6, 6, 6, 6]), 4800, '六6=4800');

// 组合
assert.equal(scoreSelection([1, 1, 1, 5]), 1050, '三1+单5');
assert.equal(scoreSelection([1, 5]), 150, '1+5');

// 顺子
assert.equal(scoreSelection([1, 2, 3, 4, 5]), 500, '顺子1-5=500');
assert.equal(scoreSelection([2, 3, 4, 5, 6]), 750, '顺子2-6=750');
assert.equal(scoreSelection([1, 2, 3, 4, 5, 6]), 1500, '全顺=1500');

// 通配骰
assert.equal(scoreSelection([DEVIL]), 0, '单独恶魔之头无分');
assert.equal(scoreSelection([1, 1, DEVIL]), 1000, '恶魔补三1');
assert.equal(scoreSelection([2, 2, DEVIL]), 200, '恶魔补三2');
assert.equal(scoreSelection([DEVIL, 2, 3, 4, 5, 6]), 1500, '恶魔补全顺');

// 爆骰判定
assert.equal(isBust([2, 3, 4, 6, 2, 3]), true, '无分即爆骰');
assert.equal(isBust([1, 2, 3, 4, 6, 2]), false, '有1不爆');

// 高亮索引
assert.deepEqual(scoringDiceIndices([1, 2, 5]), [0, 2], '高亮1和5');
assert.deepEqual(scoringDiceIndices([2, 2, 2, 3]), [0, 1, 2], '高亮三2');
assert.deepEqual(scoringDiceIndices([1, 2, 3, 4, 5]), [0, 1, 2, 3, 4], '高亮顺子');

// 有效保留校验：每颗骰子都必须为得分所必需
assert.equal(isValidSelection([1]), true, '单1有效');
assert.equal(isValidSelection([2]), false, '单2无效');
assert.equal(isValidSelection([2, 2, 2]), true, '三2有效');
assert.equal(isValidSelection([1, 5]), true, '1+5有效');
assert.equal(isValidSelection([1, 2, 3, 4, 5, 6]), true, '全顺有效');
assert.equal(isValidSelection([2, 2, 2, 2]), true, '四2有效');
assert.equal(isValidSelection([2, 2, 2, 4]), false, '多带一个无分4无效');
assert.equal(isValidSelection([1, 2, 3, 4, 5]), true, '顺子1-5有效');
assert.equal(isValidSelection([1, 1, 1]), true, '三1有效');
assert.equal(isValidSelection([1, 1, 1, 1]), true, '四1有效');
assert.equal(isValidSelection([2, 3]), false, '无分组合无效');

console.log('rules.test.js 全部通过');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/rules.test.js`
Expected: `ERR_MODULE_NOT_FOUND` / `Cannot find module ...js/rules.js`

- [ ] **Step 3: 实现 js/rules.js**

```js
// 计分纯函数。面值 1-6；DEVIL=0 表示恶魔之头（通配）。
export const DEVIL = 0;

const TRIPLET_BASE = { 1: 1000, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600 };

// 无通配基础计分（三同点以上、单1单5；carpenter=切口组合 3+5=150）
function fixedScore(faces, carpenter = false) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) if (f >= 1) c[f]++;
  let total = 0;
  if (carpenter && c[3] >= 1 && c[5] >= 1) {
    total += 150;
    c[3]--;
    c[5]--;
  }
  for (let v = 1; v <= 6; v++) {
    if (c[v] >= 3) total += TRIPLET_BASE[v] * Math.pow(2, c[v] - 3);
    else if (v === 1) total += c[v] * 100;
    else if (v === 5) total += c[v] * 50;
  }
  return total;
}

// 顺子：集合长度精确匹配时才成立
function straightScore(faces) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) if (f >= 1) c[f]++;
  const hasAll = (a, b) => { for (let v = a; v <= b; v++) if (c[v] < 1) return false; return true; };
  if (faces.length === 6 && hasAll(1, 6)) return 1500;
  if (faces.length === 5 && hasAll(1, 5)) return 500;
  if (faces.length === 5 && hasAll(2, 6)) return 750;
  return 0;
}

// 选中集合的得分（通配骰暴力分配取最大值）
export function scoreSelection(faces, opts = {}) {
  const fixed = faces.filter(f => f !== DEVIL);
  const devils = faces.length - fixed.length;
  const best = (arr) => Math.max(straightScore(arr), fixedScore(arr, opts.carpenter));
  if (devils === 0) return best(fixed);
  // 单独一颗通配骰无法组成任何得分组合（不能当作单1/单5计分）
  if (devils > 0 && faces.length === 1) return 0;
  let max = 0;
  const walk = (idx, arr) => {
    if (idx === devils) { max = Math.max(max, best(arr)); return; }
    for (let v = 1; v <= 6; v++) { arr.push(v); walk(idx + 1, arr); arr.pop(); }
  };
  walk(0, [...fixed]);
  return max;
}

export function isBust(faces) {
  return scoreSelection(faces) === 0;
}

// 有效保留：集合可得分，且每一颗骰子都是得分所必需（移除后得分下降）
export function isValidSelection(faces, opts = {}) {
  if (faces.length === 0) return false;
  const base = scoreSelection(faces, opts);
  if (base === 0) return false;
  for (let i = 0; i < faces.length; i++) {
    const rest = faces.slice(0, i).concat(faces.slice(i + 1));
    if (scoreSelection(rest, opts) >= base) return false;
  }
  return true;
}

// 可得分骰子索引（1/5、三同点组、顺子）——用于 UI 高亮提示
export function scoringDiceIndices(faces) {
  const idx = new Set();
  const c = [0, 0, 0, 0, 0, 0, 0];
  const devils = faces.filter(f => f === DEVIL).length;
  faces.forEach((f, i) => { if (f >= 1) c[f]++; if (f === 1 || f === 5) idx.add(i); });
  for (let v = 1; v <= 6; v++) {
    if (c[v] >= 3) faces.forEach((f, i) => { if (f === v) idx.add(i); });
  }
  const cover = (a, b) => {
    const need = b - a + 1 - devils;
    if (need <= 0) return false;
    let have = 0;
    for (let v = a; v <= b; v++) if (c[v] >= 1) have++;
    return have >= need;
  };
  if (faces.length === 6 && cover(1, 6)) faces.forEach((_, i) => idx.add(i));
  else if (faces.length === 5 && cover(1, 5)) faces.forEach((_, i) => idx.add(i));
  else if (faces.length === 5 && cover(2, 6)) faces.forEach((_, i) => idx.add(i));
  return [...idx].sort((a, b) => a - b);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node test/rules.test.js`
Expected: `rules.test.js 全部通过`

- [ ] **Step 5: 提交**

```bash
git add js/rules.js test/rules.test.js
git commit -m "feat: 实现 KCD2 计分核心（rules.js）"
```

---

## Task 3: dice.js 骰子定义与加权掷骰（TDD）

**Files:**
- Create: `js/dice.js`
- Test: 追加到 `test/rules.test.js`

- [ ] **Step 1: 追加失败测试**

`test/rules.test.js` 末尾追加：

```js
import { DICE_TYPES, rollFace } from '../js/dice.js';

// 骰子类型完整
for (const key of ['normal', 'lucky', 'devil', 'antiochus', 'trinity', 'even', 'odd', 'misfortune', 'unbalanced']) {
  assert.ok(DICE_TYPES[key], `缺少骰子类型 ${key}`);
}

// 普通骰恒在 1-6 内
for (let i = 0; i < 200; i++) {
  const f = rollFace(DICE_TYPES.normal);
  assert.ok(f >= 1 && f <= 6, '普通骰面应在1-6');
}

// 幸运骰偏向 1（6 权重 vs 2 权重）→ 大样本下 1 出现多于 4
let ones = 0, fours = 0;
for (let i = 0; i < 20000; i++) {
  const f = rollFace(DICE_TYPES.lucky);
  if (f === 1) ones++;
  if (f === 4) fours++;
}
assert.ok(ones > fours, `幸运骰应偏向1 (ones=${ones}, fours=${fours})`);

// 恶魔之头骰会出现 0（通配）
let devils = 0;
for (let i = 0; i < 1000; i++) if (rollFace(DICE_TYPES.devil) === DEVIL) devils++;
assert.ok(devils > 0, '恶魔之头骰应出现通配面');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/rules.test.js`
Expected: 抛错 `Cannot find module ...js/dice.js`

- [ ] **Step 3: 实现 js/dice.js**

加权面数据来自 KCD2 官方 wiki 百分比（换算为整数权重）。

```js
import { DEVIL } from './rules.js';

export const DICE_TYPES = {
  normal:     { id: 'normal',     name: '普通骰',       desc: '六面均匀的普通骰子。',        faces: [1, 2, 3, 4, 5, 6], weights: [1, 1, 1, 1, 1, 1] },
  lucky:      { id: 'lucky',      name: '幸运骰',       desc: '幸运偏向 1 和 6。',           faces: [1, 2, 3, 4, 5, 6], weights: [6, 1, 2, 1, 3, 6] },
  devil:      { id: 'devil',      name: '恶魔之头骰',   desc: '一面为恶魔之头，可补任意组合。', faces: [DEVIL, 2, 3, 4, 5, 6], weights: [1, 1, 1, 1, 1, 1] },
  antiochus:  { id: 'antiochus',  name: '圣人骰',       desc: '偏爱掷出 3。',                faces: [1, 2, 3, 4, 5, 6], weights: [3, 1, 6, 1, 1, 3] },
  trinity:    { id: 'trinity',    name: '圣三一骰',     desc: '偏爱掷出 3 与 2。',           faces: [1, 2, 3, 4, 5, 6], weights: [4, 5, 10, 1, 1, 1] },
  even:       { id: 'even',       name: '偶数骰',       desc: '偏爱偶数。',                  faces: [1, 2, 3, 4, 5, 6], weights: [1, 4, 1, 4, 1, 4] },
  odd:        { id: 'odd',        name: '奇数骰',       desc: '偏爱奇数。',                  faces: [1, 2, 3, 4, 5, 6], weights: [4, 1, 4, 1, 4, 1] },
  misfortune: { id: 'misfortune', name: '厄运骰',       desc: '很少掷出 1 和 6。',           faces: [1, 2, 3, 4, 5, 6], weights: [1, 5, 5, 5, 5, 1] },
  unbalanced: { id: 'unbalanced', name: '失衡骰',       desc: '偏向掷出 2。',                faces: [1, 2, 3, 4, 5, 6], weights: [3, 4, 1, 1, 2, 1] },
};

// 按权重掷一个面
export function rollFace(die) {
  const total = die.weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < die.faces.length; i++) {
    r -= die.weights[i];
    if (r < 0) return die.faces[i];
  }
  return die.faces[die.faces.length - 1];
}

// 掷一组骰子，返回 { faces, dieIds }，dieIds 用于渲染不同骰型外观
export function rollDice(dieTypes) {
  const faces = [];
  const dieIds = [];
  for (const id of dieTypes) {
    const die = DICE_TYPES[id];
    faces.push(rollFace(die));
    dieIds.push(id);
  }
  return { faces, dieIds };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node test/rules.test.js`
Expected: `rules.test.js 全部通过`

- [ ] **Step 5: 提交**

```bash
git add js/dice.js test/rules.test.js
git commit -m "feat: 实现骰子定义与加权掷骰（dice.js）"
```

---

## Task 4: badges.js 徽章定义（TDD）

**Files:**
- Create: `js/badges.js`
- Test: 追加到 `test/rules.test.js`

- [ ] **Step 1: 追加失败测试**

```js
import { BADGES } from '../js/badges.js';

for (const id of ['resurrection', 'carpenter', 'warlord', 'might']) {
  assert.ok(BADGES[id], `缺少徽章 ${id}`);
}
assert.ok(BADGES.carpenter.effect === 'carpenter', '木匠徽章 effect 为 carpenter');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/rules.test.js`
Expected: `Cannot find module ...js/badges.js`

- [ ] **Step 3: 实现 js/badges.js**

```js
// 徽章定义。effect 字段供引擎消费。
export const BADGES = {
  resurrection: {
    id: 'resurrection',
    name: '转生徽章',
    desc: '爆骰后可将本回合最后一次掷骰重掷一次。每局 1 次。',
    effect: 'resurrection',
  },
  carpenter: {
    id: 'carpenter',
    name: '木匠优势徽章',
    desc: '获得新组合「切口」：3+5 = 150 分。',
    effect: 'carpenter',
  },
  warlord: {
    id: 'warlord',
    name: '沃罗得徽章',
    desc: '本回合收手时得分 ×1.5。每局 1 次。',
    effect: 'warlord',
  },
  might: {
    id: 'might',
    name: '法师徽章',
    desc: '本回合掷骰时额外多掷一颗骰子。每局 1 次。',
    effect: 'might',
  },
};

export function getBadge(id) {
  return BADGES[id] || null;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node test/rules.test.js`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add js/badges.js test/rules.test.js
git commit -m "feat: 实现徽章定义（badges.js）"
```

---

## Task 5: engine.js 游戏状态机（TDD）

**Files:**
- Create: `js/engine.js`
- Test: `test/engine.test.js`

**API 约定：** `newGame(config)` 返回 state；`act(state, action)` 返回新 state（不可变 reducer，state 始终可 JSON 序列化）。action 形如 `{ type: 'roll' }`、`{ type: 'select', i }`、`{ type: 'continueRoll' }`、`{ type: 'pass' }`、`{ type: 'useBadge' }`、`{ type: 'resurrect' }`、`{ type: 'giveUp' }`。

**config：** `{ mode: 'ai'|'pvp', target: number, players: [{ name, dieIds:[6], badge }] }`。

**state：**

```js
{
  config, turn: 0, phase: 'idle'|'rolling'|'bust'|'gameover',
  roll: [], held: [], dieIds: [],
  turnScore: 0, hot: false, busted: false,
  players: [{ name, dieIds, badge, total: 0, badgeUsed: false, resurrectUsed: false }],
  winner: null, log: []
}
```

- [ ] **Step 1: 写失败测试**

`test/engine.test.js`：

```js
import assert from 'node:assert/strict';
import { newGame, act, player } from '../js/engine.js';
import { scoreSelection } from '../js/rules.js';

const P1 = { name: '亨瑞', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null };
const P2 = { name: 'AI', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null };
const base = { mode: 'ai', target: 2000, players: [P1, P2] };

// 开局：phase=idle，轮到我方，掷骰数=6
let s = newGame(base);
assert.equal(s.phase, 'idle');
assert.equal(s.turn, 0);
assert.equal(s.roll.length, 0);

// 掷骰后 phase=rolling，6 颗
s = act(s, { type: 'roll' });
assert.equal(s.phase, 'rolling');
assert.equal(s.roll.length, 6);
```

随机控制：`newGame(config, rng = Math.random)` 注入随机源。受控 rng 固定返回 0 时，普通骰恒掷第一面（1）；固定返回 0.45 时，普通骰掷 3（无分）→ 爆骰。完整测试如下：

```js
// 受控 rng：固定返回 0（普通骰第一面=1）
const rng = () => 0;
let s = newGame(base, rng);
s = act(s, { type: 'roll' });
assert.deepEqual(s.roll, [1, 1, 1, 1, 1, 1], 'rng=0 应全为1');

// 保留三1收手
s = act(s, { type: 'select', i: 0 });
s = act(s, { type: 'select', i: 1 });
s = act(s, { type: 'select', i: 2 });
s = act(s, { type: 'pass' });
assert.equal(s.players[0].total, 1000, '保留三1收手=1000');

// 继续掷：保留后可继续
let s2 = newGame(base, rng);
s2 = act(s2, { type: 'roll' }); // [1x6]
s2 = act(s2, { type: 'select', i: 0 });
s2 = act(s2, { type: 'continueRoll' }); // 保留1(+100)，掷余5颗（rng=0 → 5个1）
assert.equal(s2.turnScore, 100);
assert.equal(s2.roll.length, 5);

// 热骰：六个1全保留 → 累计8000，重掷6颗
let s3 = newGame(base, rng);
s3 = act(s3, { type: 'roll' }); // [1x6]
for (let i = 0; i < 6; i++) s3 = act(s3, { type: 'select', i });
s3 = act(s3, { type: 'continueRoll' }); // 全保留 → 热骰，重掷6颗
assert.equal(s3.hot, true);
assert.equal(s3.roll.length, 6);
assert.equal(s3.turnScore, 8000, '六个1=1000×2^3=8000');
```

```js
// 爆骰：序列 rng 掷出 [2,3,4,6,2,3]（无1无5无三同）→ 无分即爆
// 注：不能用恒定 rng——六颗同面（如恒3）会组成三同点，必然有分
let midI = 0;
const midSeq = [0.2, 0.4, 0.55, 0.9, 0.2, 0.4]; // → 面 [2,3,4,6,2,3]
const midRng = () => midSeq[midI++ % midSeq.length];
let s4 = newGame(base, midRng);
s4 = act(s4, { type: 'roll' });
assert.equal(s4.phase, 'bust', '无分组合应爆骰');
```

**轮换与胜利：**

```js
// 达标即胜
let s5 = newGame({ mode: 'ai', target: 200, players: [P1, P2] }, rng);
s5 = act(s5, { type: 'roll' }); // [1x6]
for (let i = 0; i < 6; i++) s5 = act(s5, { type: 'select', i });
s5 = act(s5, { type: 'pass' }); // 8000 >= 200
assert.equal(s5.phase, 'gameover');
assert.equal(s5.winner, 0);

// 未达标则轮换
let s6 = newGame(base, rng);
s6 = act(s6, { type: 'roll' });
s6 = act(s6, { type: 'select', i: 0 });
s6 = act(s6, { type: 'pass' }); // +100
assert.equal(s6.turn, 1, '收手后轮到对手');
assert.equal(s6.roll.length, 0);

// 投降
let s7 = newGame(base, rng);
s7 = act(s7, { type: 'giveUp' });
assert.equal(s7.winner, 1, '投降对手胜');
```

**徽章：**

```js
// 木匠徽章：3+5=150
const CB = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'carpenter' };
let s8 = newGame({ mode: 'ai', target: 2000, players: [CB, P2] });
s8.roll = [3, 5, 2, 4, 6, 2];
s8.phase = 'rolling';
assert.equal(scoreSelection(s8.roll, { carpenter: true }), 150, '切口3+5=150');

// 沃罗得徽章：收手×1.5
const WL = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'warlord' };
let s9 = newGame({ mode: 'ai', target: 2000, players: [WL, P2] }, rng);
s9 = act(s9, { type: 'roll' }); // [1x6]
s9 = act(s9, { type: 'useBadge' });
s9 = act(s9, { type: 'select', i: 0 });
s9 = act(s9, { type: 'pass' });
assert.equal(s9.players[0].total, 150, '沃罗得100×1.5=150');
assert.equal(s9.players[0].badgeUsed, true, '徽章标记已用');
```

**转生：**

```js
// 转生徽章：爆骰后可重掷
const RS = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'resurrection' };
let s10 = newGame({ mode: 'ai', target: 2000, players: [RS, P2] }, midRng);
s10 = act(s10, { type: 'roll' }); // 爆骰
assert.equal(s10.phase, 'bust');
s10 = act(s10, { type: 'resurrect' }); // 重掷（序列仍为无分组合 → 再次爆骰）
assert.equal(s10.phase, 'bust');
assert.equal(s10.players[0].resurrectUsed, true);
```

**法师徽章（额外骰）：** 使用后下一次掷骰骰子数 +1。

```js
const MG = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'might' };
let s11 = newGame({ mode: 'ai', target: 2000, players: [MG, P2] }, rng);
s11 = act(s11, { type: 'roll' }); // 6颗
s11 = act(s11, { type: 'select', i: 0 });
s11 = act(s11, { type: 'useBadge' }); // 启用法师
s11 = act(s11, { type: 'continueRoll' }); // 剩余5 +1 → 6颗
assert.equal(s11.roll.length, 6, '法师徽章额外骰生效');
assert.equal(s11.players[0].badgeUsed, true, '法师徽章标记已用');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/engine.test.js`
Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 实现 js/engine.js**

```js
import { isBust, scoreSelection, scoringDiceIndices, isValidSelection } from './rules.js';
import { rollFace, DICE_TYPES } from './dice.js';
import { getBadge } from './badges.js';

// 随机源与 state 弱关联（避免把函数放进 state，保证 state 可 JSON 序列化）
const rngMap = new WeakMap();

export function newGame(config, rng = Math.random) {
  const state = {
    config: {
      mode: config.mode || 'ai',
      target: config.target || 2000,
      players: config.players,
    },
    turn: 0,
    phase: 'idle',
    roll: [],
    held: [],
    dieIds: [],
    turnScore: 0,
    hot: false,
    busted: false,
    warlordActive: false,
    extraDieActive: false,
    players: config.players.map(p => ({
      name: p.name,
      dieIds: [...p.dieIds],
      badge: p.badge || null,
      total: 0,
      badgeUsed: false,
      resurrectUsed: false,
    })),
    winner: null,
    log: [],
  };
  rngMap.set(state, rng);
  return state;
}

const p = (s, i = s.turn) => s.players[i];

// 掷 count 颗骰子；骰型按玩家配置轮转
function rollPool(s, count, rng) {
  const types = p(s).dieIds;
  const faces = [], dieIds = [];
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    faces.push(rollFace(DICE_TYPES[t], rng));
    dieIds.push(t);
  }
  return { faces, dieIds };
}

const carpenterOn = (s) => getBadge(p(s).badge)?.effect === 'carpenter';

export function act(state, action) {
  const s = structuredClone(state); // 不可变 reducer；state 为纯 JSON
  const rng = rngMap.get(state) || Math.random;
  rngMap.set(s, rng);
  const pl = p(s);
  const log = (m) => s.log.push(m);
  const baseCount = 6 + (s.extraDieActive ? 1 : 0);

  switch (action.type) {
    case 'roll': {
      // 用于开局或热骰后重掷全部
      if (s.phase !== 'idle') return s;
      const pool = rollPool(s, baseCount, rng);
      s.roll = pool.faces;
      s.dieIds = pool.dieIds;
      s.held = s.roll.map(() => false);
      s.hot = false;
      if (isBust(s.roll)) {
        s.phase = 'bust';
        s.busted = true;
        log(`${pl.name} 爆骰！`);
      } else {
        s.phase = 'rolling';
        s.busted = false;
        log(`${pl.name} 掷出 ${s.roll.join(',')}`);
      }
      return s;
    }
    case 'select': {
      // 自由切换选择；合法性在 continueRoll / pass 时校验
      if (s.phase !== 'rolling') return s;
      const i = action.i;
      if (i < 0 || i >= s.roll.length) return s;
      s.held[i] = !s.held[i];
      return s;
    }
    case 'continueRoll': {
      if (s.phase !== 'rolling') return s;
      const heldFaces = s.roll.filter((_, j) => s.held[j]);
      if (!isValidSelection(heldFaces, { carpenter: carpenterOn(s) })) return s;
      const add = scoreSelection(heldFaces, { carpenter: carpenterOn(s) });
      s.turnScore += add;
      log(`${pl.name} 保留 [${heldFaces.join(',')}] +${add}`);
      if (s.held.every(Boolean)) {
        s.hot = true;
        const pool = rollPool(s, baseCount, rng);
        s.roll = pool.faces;
        s.dieIds = pool.dieIds;
        s.held = s.roll.map(() => false);
        if (isBust(s.roll)) {
          s.phase = 'bust'; s.busted = true;
          log(`${pl.name} 热骰后爆骰！`);
        } else {
          s.phase = 'rolling';
          log(`${pl.name} 热骰！重掷全部 ${s.roll.join(',')}`);
        }
        return s;
      }
      const remaining = s.roll.length - heldFaces.length;
      s.hot = false; // 非全保留重掷，热骰状态解除
      const pool = rollPool(s, remaining + (s.extraDieActive ? 1 : 0), rng);
      s.roll = pool.faces;
      s.dieIds = pool.dieIds;
      s.held = s.roll.map(() => false);
      if (isBust(s.roll)) {
        s.phase = 'bust'; s.busted = true;
        log(`${pl.name} 爆骰！`);
      } else {
        s.phase = 'rolling';
        log(`${pl.name} 继续掷出 ${s.roll.join(',')}`);
      }
      return s;
    }
    case 'pass': {
      if (s.phase !== 'rolling') return s;
      const heldFaces = s.roll.filter((_, j) => s.held[j]);
      if (heldFaces.length === 0) {
        if (s.turnScore === 0) return s;
      } else if (!isValidSelection(heldFaces, { carpenter: carpenterOn(s) })) {
        return s;
      }
      let add = s.turnScore + (heldFaces.length ? scoreSelection(heldFaces, { carpenter: carpenterOn(s) }) : 0);
      if (s.warlordActive) add = Math.round(add * 1.5);
      pl.total += add;
      pl.badgeUsed = pl.badgeUsed || s.warlordActive;
      log(`${pl.name} 收手 +${add}，总分 ${pl.total}`);
      if (pl.total >= s.config.target) {
        s.phase = 'gameover';
        s.winner = s.turn;
        log(`${pl.name} 获胜！`);
        return s;
      }
      nextTurn(s);
      return s;
    }
    case 'bustAccept': {
      if (s.phase !== 'bust') return s;
      s.turnScore = 0;
      log(`${pl.name} 爆骰认输，本回合得分清零`);
      nextTurn(s);
      return s;
    }
    case 'resurrect': {
      if (s.phase !== 'bust' || pl.resurrectUsed) return s;
      pl.resurrectUsed = true;
      s.phase = 'idle';
      s.busted = false;
      s.turnScore = 0;
      log(`${pl.name} 使用转生徽章重掷`);
      return act(s, { type: 'roll' });
    }
    case 'useBadge': {
      if (s.phase === 'gameover' || pl.badgeUsed) return s;
      const b = getBadge(pl.badge);
      if (!b) return s;
      if (b.effect === 'warlord') { s.warlordActive = true; pl.badgeUsed = true; log(`${pl.name} 使用沃罗得徽章`); }
      if (b.effect === 'might') { s.extraDieActive = true; pl.badgeUsed = true; log(`${pl.name} 使用法师徽章`); }
      return s;
    }
    case 'giveUp': {
      s.winner = (s.turn + 1) % 2;
      s.phase = 'gameover';
      log(`${pl.name} 认输，${p(s, s.winner).name} 获胜`);
      return s;
    }
    default:
      return s;
  }
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
  s.phase = 'idle';
  s.roll = []; s.held = []; s.dieIds = [];
  s.turnScore = 0; s.hot = false; s.busted = false;
  s.warlordActive = false; s.extraDieActive = false;
}

export function player(state, i = state.turn) {
  return state.players[i];
}

export { scoringDiceIndices };
```

需要同步改 `js/dice.js` 的 `rollFace(die, rng)` 支持注入：

```js
export function rollFace(die, rng = Math.random) {
  const total = die.weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < die.faces.length; i++) {
    r -= die.weights[i];
    if (r < 0) return die.faces[i];
  }
  return die.faces[die.faces.length - 1];
}
```

随机源通过模块级 `WeakMap` 与 state 关联，不出现在 state 内，`JSON.stringify(state)` 即为完整可序列化对局状态（联机基础）。

- [ ] **Step 4: 运行确认通过**

Run: `node test/engine.test.js`
Expected: `engine.test.js 全部通过`（在测试文件末尾加该打印）

- [ ] **Step 5: 提交**

```bash
git add js/engine.js js/dice.js test/engine.test.js
git commit -m "feat: 实现可序列化游戏状态机（engine.js）"
```

---

## Task 6: ai.js 对手 AI（TDD）

**Files:**
- Create: `js/ai.js`
- Test: 追加 `test/engine.test.js`

- [ ] **Step 1: 追加失败测试**

```js
import { aiDecision } from '../js/ai.js';

// 高分局面保守型应收手
assert.equal(aiDecision({ level: 'conservative', turnScore: 500, remaining: 2 }), 'pass');
// 低分局面保守型应继续
assert.equal(aiDecision({ level: 'conservative', turnScore: 100, remaining: 4 }), 'roll');
// 激进型高分继续
assert.equal(aiDecision({ level: 'aggressive', turnScore: 500, remaining: 3 }), 'roll');
// 激进型极高分收手
assert.equal(aiDecision({ level: 'aggressive', turnScore: 900, remaining: 2 }), 'pass');
// 热骰必继续
assert.equal(aiDecision({ level: 'conservative', turnScore: 300, remaining: 0, hot: true }), 'roll');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/engine.test.js`
Expected: `Cannot find module ...js/ai.js`

- [ ] **Step 3: 实现 js/ai.js**

```js
// AI 决策：返回 'pass' 或 'roll'。remaining=保留得分骰后剩余可掷骰数；hot=全骰得分。
export function aiDecision({ level, turnScore, remaining, hot }) {
  if (hot) return 'roll'; // 热骰必继续
  const thresholds = {
    conservative: { passTurn: 400, passRemaining: 2 },
    aggressive: { passTurn: 800, passRemaining: 2 },
  };
  const t = thresholds[level] || thresholds.conservative;
  if (turnScore >= t.passTurn) return 'pass';
  if (remaining <= t.passRemaining && turnScore >= 250) return 'pass';
  return 'roll';
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node test/engine.test.js`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add js/ai.js test/engine.test.js
git commit -m "feat: 实现对手 AI 决策（ai.js）"
```

---

## Task 7: tutorial.js 新手教程（TDD）

**Files:**
- Create: `js/tutorial.js`
- Test: 追加 `test/engine.test.js`

- [ ] **Step 1: 追加失败测试**

```js
import { TUTORIAL_STEPS, shouldShowTutorial, markTutorialDone, setTutorialStorage } from '../js/tutorial.js';

// Node 环境无 localStorage → 注入内存存储
const mem = new Map();
setTutorialStorage({
  getItem: k => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, v),
  removeItem: k => mem.delete(k),
});

assert.ok(TUTORIAL_STEPS.length >= 3, '至少3步');
assert.equal(TUTORIAL_STEPS[0].selector, '#btn-roll', '第一步指向掷骰按钮');
assert.equal(shouldShowTutorial(), true, '首次应显示教程');
markTutorialDone();
assert.equal(shouldShowTutorial(), false, '标记后不再显示');
```

- [ ] **Step 2: 运行确认失败**

Run: `node test/engine.test.js`
Expected: `Cannot find module ...js/tutorial.js`

- [ ] **Step 3: 实现 js/tutorial.js**

```js
const KEY = 'dice_tutorial_done';

export const TUTORIAL_STEPS = [
  { selector: '#btn-roll', title: '掷骰', text: '点击「掷骰」摇动你的骰子。目标是凑出得分组合。' },
  { selector: '#dice-area', title: '保留得分骰', text: '点击可得分骰子（高亮）将其保留，例如 1=100 分、5=50 分、三个相同点数、顺子等。' },
  { selector: '#btn-pass', title: '收手或继续', text: '「收手记分」把本回合得分存进总分；「继续掷骰」重掷剩余骰子。一旦爆骰（无得分），本回合得分全部清零！' },
];

let injected = null; // 测试注入存储

export function setTutorialStorage(s) { injected = s; }

function getStore() {
  if (injected) return injected;
  try { return localStorage; } catch { return null; }
}

export function shouldShowTutorial() {
  const st = getStore();
  return st ? st.getItem(KEY) !== '1' : true;
}
export function markTutorialDone() {
  const st = getStore();
  if (st) st.setItem(KEY, '1');
}
export function resetTutorial() {
  const st = getStore();
  if (st) st.removeItem(KEY);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node test/engine.test.js`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add js/tutorial.js test/engine.test.js
git commit -m "feat: 实现新手教程数据与状态（tutorial.js）"
```

---

## Task 8: ui.js 渲染层（Canvas 骰子 + 木桌纹理 + DOM）

**Files:**
- Create: `js/ui.js`

**职责：** 只读渲染。`render(state)` 渲染记分板/按钮区；`drawDiceFace(canvas, face, opts)` 用 Canvas 2D 画骨制骰子；`drawTableTexture(canvas)` 生成木桌纹理；`createUI({ onAction })` 绑定 DOM 交互。

- [ ] **Step 1: 实现 js/ui.js（完整代码）**

```js
import { scoringDiceIndices } from './rules.js';
import { BADGES } from './badges.js';

const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDevil(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#5a1f1f';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7ecd2';
  ctx.font = `${Math.round(r)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☠', cx, cy + r * 0.08);
  ctx.restore();
}

// 绘制一颗骨制骰子到 canvas（面值 1-6 或 0=恶魔之头）
function drawDiceFace(canvas, face, { held = false, highlighted = false } = {}) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  const pad = s * 0.04;
  const x = pad, y = pad, size = s - pad * 2;

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = held ? 10 : 4;
  ctx.shadowOffsetY = held ? 4 : 2;
  if (highlighted) {
    ctx.shadowColor = 'rgba(255,200,80,0.9)';
    ctx.shadowBlur = 12;
  }
  const body = ctx.createLinearGradient(x, y, x + size, y + size);
  body.addColorStop(0, '#f7ecd2');
  body.addColorStop(0.5, '#e6d6b4');
  body.addColorStop(1, '#cbb892');
  roundRect(ctx, x, y, size, size, size * 0.14);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8a7a55';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (face === 0) {
    drawDevil(ctx, x + size / 2, y + size / 2, size * 0.22);
    return;
  }
  for (const [px, py] of PIP_LAYOUT[face] || []) {
    const cx = x + size * px, cy = y + size * py, r = size * 0.075;
    const pip = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    pip.addColorStop(0, '#3a3430');
    pip.addColorStop(1, '#0c0a08');
    ctx.fillStyle = pip;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 一次性生成木桌纹理背景
export function drawTableTexture(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    const shade = 30 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade + 40},${shade + 25},${shade},0.25)`;
    ctx.fillRect(0, y, w, 2 + Math.random() * 2);
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(255,180,90,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function createUI({ onAction }) {
  const diceArea = document.getElementById('dice-area');
  const btnRoll = document.getElementById('btn-roll');
  const btnContinue = document.getElementById('btn-continue');
  const btnPass = document.getElementById('btn-pass');
  const btnGiveUp = document.getElementById('btn-giveup');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');

  function renderDice(state) {
    diceArea.innerHTML = '';
    const hl = scoringDiceIndices(state.roll);
    state.roll.forEach((face, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'die-wrap' + (state.held[i] ? ' held' : '') + (hl.includes(i) ? ' scoring' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      drawDiceFace(cv, face, { held: state.held[i], highlighted: hl.includes(i) });
      wrap.appendChild(cv);
      wrap.dataset.index = i;
      wrap.addEventListener('click', () => { if (state.phase === 'rolling') onAction({ type: 'select', i }); });
      diceArea.appendChild(wrap);
      if (state.busted === false && state.phase === 'rolling') wrap.classList.add('tumble');
    });
  }

  function renderScoreboard(state) {
    state.players.forEach((pl, i) => {
      const el = document.getElementById(`p${i}-score`);
      const nameEl = document.getElementById(`p${i}-name`);
      const badgeEl = document.getElementById(`p${i}-badge`);
      if (el) el.textContent = pl.total;
      if (nameEl) {
        nameEl.textContent = pl.name;
        nameEl.parentElement.classList.toggle('active', i === state.turn && state.phase !== 'gameover');
      }
      if (badgeEl) {
        badgeEl.textContent = pl.badge ? BADGES[pl.badge].name : '';
        badgeEl.classList.toggle('used', pl.badgeUsed);
      }
    });
    const turnEl = document.getElementById('turn-score');
    if (turnEl) turnEl.textContent = state.turnScore;
    if (btnRoll) btnRoll.disabled = state.phase !== 'idle' || state.hot;
    if (btnContinue) btnContinue.disabled = !state.roll.some((_, i) => state.held[i]);
    if (btnPass) btnPass.disabled = state.phase !== 'rolling' || !state.roll.some((_, i) => state.held[i]);
    if (btnGiveUp) btnGiveUp.disabled = state.phase === 'gameover';
  }

  function renderStatus(state) {
    if (!statusEl) return;
    if (state.phase === 'gameover') statusEl.textContent = `${state.players[state.winner].name} 获胜！`;
    else if (state.phase === 'bust') statusEl.textContent = `${state.players[state.turn].name} 爆骰！本回合得分清零`;
    else if (state.phase === 'rolling') statusEl.textContent = `${state.players[state.turn].name} 的回合 — 选择得分骰子`;
    else statusEl.textContent = `${state.players[state.turn].name} 的回合 — 点击掷骰`;
  }

  function render(state) {
    renderScoreboard(state);
    renderDice(state);
    renderStatus(state);
    if (logEl) logEl.textContent = state.log.slice(-3).join(' · ');
  }

  btnRoll?.addEventListener('click', () => onAction({ type: 'roll' }));
  btnContinue?.addEventListener('click', () => onAction({ type: 'continueRoll' }));
  btnPass?.addEventListener('click', () => onAction({ type: 'pass' }));
  btnGiveUp?.addEventListener('click', () => onAction({ type: 'giveUp' }));

  return { render };
}
```

- [ ] **Step 2: 提交**

```bash
git add js/ui.js
git commit -m "feat: 实现渲染层（Canvas 骰子与木桌纹理，ui.js）"
```

---

## Task 9: index.html + style.css 完整界面与开局设置

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Create: `js/main.js`

- [ ] **Step 1: 重写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>骰子 · 酒馆博弈</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <canvas id="table-bg" aria-hidden="true"></canvas>
  <div id="app" class="game">
    <header class="game-header">
      <h1>骰子 · 酒馆博弈</h1>
      <div class="header-actions">
        <button id="btn-rules" class="btn ghost">规则手册</button>
        <button id="btn-restart" class="btn ghost">重开一局</button>
      </div>
    </header>

    <section class="scoreboard">
      <div class="player-card" id="p0-card">
        <div class="player-name" id="p0-name">玩家</div>
        <div class="player-score" id="p0-score">0</div>
        <div class="player-badge" id="p0-badge"></div>
      </div>
      <div class="turn-panel">
        <div class="label">本回合暂得分</div>
        <div class="turn-score" id="turn-score">0</div>
      </div>
      <div class="player-card" id="p1-card">
        <div class="player-name" id="p1-name">对手</div>
        <div class="player-score" id="p1-score">0</div>
        <div class="player-badge" id="p1-badge"></div>
      </div>
    </section>

    <section class="table">
      <div class="status" id="status">开局</div>
      <div class="dice-area" id="dice-area"></div>
      <div class="actions">
        <button id="btn-roll" class="btn primary">掷骰</button>
        <button id="btn-continue" class="btn">继续掷骰</button>
        <button id="btn-pass" class="btn primary">收手记分</button>
        <button id="btn-badge" class="btn badge-btn">使用徽章</button>
        <button id="btn-giveup" class="btn ghost">投降</button>
      </div>
      <div class="log" id="log"></div>
    </section>
  </div>

  <!-- 开局设置弹层 -->
  <div class="modal-backdrop" id="setup-modal">
    <div class="modal">
      <h2>开局设置</h2>
      <div class="field">
        <label>模式</label>
        <div class="seg">
          <button data-mode="ai" class="seg-btn active">对战 AI</button>
          <button data-mode="pvp" class="seg-btn">本地双人</button>
        </div>
      </div>
      <div class="field">
        <label>目标分</label>
        <div class="target-opts">
          <button data-target="1000" class="seg-btn">1000</button>
          <button data-target="1500" class="seg-btn">1500</button>
          <button data-target="2000" class="seg-btn active">2000</button>
          <button data-target="2500" class="seg-btn">2500</button>
          <input id="custom-target" type="number" min="100" max="10000" step="100" placeholder="自定义">
        </div>
      </div>
      <div class="field">
        <label>AI 难度（仅对战 AI）</label>
        <div class="seg">
          <button data-ai="conservative" class="seg-btn active">保守</button>
          <button data-ai="aggressive" class="seg-btn">激进</button>
        </div>
      </div>
      <div class="field">
        <label>我的骰子（选 6 颗）</label>
        <div class="dice-picker" id="dice-picker"></div>
      </div>
      <div class="field">
        <label>我的徽章（选 1 个，可无）</label>
        <div class="badge-picker" id="badge-picker"></div>
      </div>
      <button id="btn-start" class="btn primary">开始游戏</button>
    </div>
  </div>

  <!-- 规则手册弹层 -->
  <div class="modal-backdrop hidden" id="rules-modal">
    <div class="modal wide">
      <h2>规则手册</h2>
      <div id="rules-content"></div>
      <button id="btn-close-rules" class="btn primary">关闭</button>
    </div>
  </div>

  <!-- 教程气泡 -->
  <div class="tutorial hidden" id="tutorial">
    <h3 id="tut-title"></h3>
    <p id="tut-text"></p>
    <div class="tutorial-actions">
      <button id="tut-skip" class="btn ghost">跳过</button>
      <button id="tut-next" class="btn primary">下一步</button>
    </div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 追加 css/style.css**

```css
/* —— 布局 —— */
#table-bg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; }
.game { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
.game-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.game-header h1 { font-family: Georgia, serif; letter-spacing: 3px; color: var(--gold); text-shadow: 0 2px 6px rgba(0,0,0,.6); }
.header-actions { display: flex; gap: 8px; }

.scoreboard { display: grid; grid-template-columns: 1fr 160px 1fr; gap: 12px; align-items: stretch; }
.player-card {
  background: linear-gradient(180deg, rgba(60,42,28,.92), rgba(36,26,16,.92));
  border: 1px solid #5c452a; border-radius: 12px; padding: 14px 18px;
  box-shadow: 0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
  text-align: center;
}
.player-card.active { border-color: var(--gold); box-shadow: 0 0 18px rgba(201,151,107,.35), 0 6px 16px rgba(0,0,0,.5); }
.player-name { font-size: 15px; color: var(--gold); letter-spacing: 2px; }
.player-score { font-size: 44px; font-weight: bold; color: var(--text-light); text-shadow: 0 2px 8px rgba(0,0,0,.5); }
.player-badge { font-size: 12px; color: #b99b6a; min-height: 16px; }
.player-badge.used { color: #7a6a50; text-decoration: line-through; }

.turn-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(20,14,8,.85); border: 1px solid #3a2c1c; border-radius: 12px; padding: 10px; }
.turn-panel .label { font-size: 12px; color: #b99b6a; }
.turn-score { font-size: 34px; color: #ffd08a; text-shadow: 0 0 12px rgba(255,170,80,.4); }

.table { margin-top: 16px; background: rgba(24,17,10,.72); border: 1px solid #3a2c1c; border-radius: 16px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.55); }
.status { text-align: center; color: var(--text-light); font-size: 16px; letter-spacing: 1px; margin-bottom: 14px; min-height: 24px; }

.dice-area { display: flex; gap: 14px; justify-content: center; align-items: center; min-height: 132px; flex-wrap: wrap; padding: 8px 0; }
.die-wrap { position: relative; transition: transform .18s ease; cursor: pointer; }
.die-wrap canvas { display: block; border-radius: 14px; box-shadow: 0 8px 18px rgba(0,0,0,.55); }
.die-wrap.held { transform: translateY(-14px); }
.die-wrap.scoring canvas { box-shadow: 0 0 0 3px rgba(255,200,80,.55), 0 8px 18px rgba(0,0,0,.55); }
.die-wrap.tumble { animation: tumble .4s ease; }
@keyframes tumble {
  0% { transform: rotate(-12deg) translateY(0); }
  40% { transform: rotate(10deg) translateY(-18px); }
  100% { transform: rotate(0) translateY(0); }
}

.actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
.btn {
  padding: 10px 20px; font-family: inherit; font-size: 15px; letter-spacing: 1px; cursor: pointer;
  background: linear-gradient(180deg, #5c452a, #3d2b1f); color: var(--text-light);
  border: 1px solid #6b5436; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,.4);
}
.btn:hover { filter: brightness(1.15); }
.btn:disabled { opacity: .4; cursor: not-allowed; filter: none; }
.btn.primary { background: linear-gradient(180deg, #a5723f, #7a4f26); border-color: #c9976b; color: #fff6e6; }
.btn.ghost { background: transparent; }
.badge-btn { color: #ffd08a; }

.log { margin-top: 14px; color: #b99b6a; font-size: 13px; line-height: 1.7; min-height: 42px; text-align: center; }

/* —— 弹层 —— */
.modal-backdrop { position: fixed; inset: 0; background: rgba(10,7,4,.78); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal-backdrop.hidden { display: none; }
.modal {
  background: linear-gradient(180deg, #33241a, #241a10); border: 1px solid #5c452a;
  border-radius: 16px; padding: 26px 30px; width: min(560px, 92vw); max-height: 86vh; overflow: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,.7);
}
.modal.wide { width: min(720px, 92vw); }
.modal h2 { color: var(--gold); letter-spacing: 2px; margin-bottom: 16px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; color: #c9a86f; margin-bottom: 6px; }
.seg { display: flex; gap: 8px; flex-wrap: wrap; }
.seg-btn {
  padding: 8px 14px; background: #2a1e12; color: #d8c49a; border: 1px solid #4a3a24; border-radius: 8px; cursor: pointer;
}
.seg-btn.active { background: #7a4f26; color: #fff6e6; border-color: #c9976b; }
.target-opts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.target-opts input { width: 110px; padding: 8px; background: #1c140c; color: var(--text-light); border: 1px solid #4a3a24; border-radius: 8px; }
.dice-picker, .badge-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.pick-item {
  padding: 8px 10px; background: #2a1e12; color: #d8c49a; border: 1px solid #4a3a24; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.pick-item.selected { background: #7a4f26; border-color: #c9976b; color: #fff6e6; }
.pick-item:disabled { opacity: .35; cursor: not-allowed; }

/* —— 教程 —— */
.tutorial {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); width: min(440px, 92vw);
  background: linear-gradient(180deg, #3a2b1c, #2a1e12); border: 1px solid #7a6236; border-radius: 14px;
  padding: 18px 20px; z-index: 80; box-shadow: 0 16px 40px rgba(0,0,0,.7);
}
.tutorial h3 { color: #ffd08a; margin-bottom: 6px; }
.tutorial p { color: #e8d5b0; font-size: 14px; line-height: 1.6; }
.tutorial-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.tutorial-highlight { outline: 3px solid rgba(255,208,138,.85); outline-offset: 4px; border-radius: 10px; animation: pulse 1.2s ease infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,208,138,.5); } 50% { box-shadow: 0 0 0 10px rgba(255,208,138,0); } }

#rules-content { color: #e8d5b0; font-size: 14px; line-height: 1.8; margin-bottom: 16px; }
#rules-content table { width: 100%; border-collapse: collapse; margin: 8px 0; }
#rules-content th, #rules-content td { border: 1px solid #4a3a24; padding: 5px 8px; text-align: left; }
#rules-content th { background: #2a1e12; color: #c9a86f; }
```

- [ ] **Step 3: 实现 js/main.js（装配）**

```js
import { newGame, act } from './engine.js';
import { createUI } from './ui.js';
import { scoringDiceIndices } from './rules.js';
import { BADGES } from './badges.js';
import { DICE_TYPES } from './dice.js';
import { aiDecision } from './ai.js';
import { TUTORIAL_STEPS, shouldShowTutorial, markTutorialDone } from './tutorial.js';

const DICE_CHOICES = ['normal', 'lucky', 'devil', 'antiochus', 'trinity', 'even', 'odd', 'misfortune', 'unbalanced'];

// —— 设置面板状态 ——
let settings = {
  mode: 'ai', target: 2000, aiLevel: 'conservative',
  myDice: [...DICE_CHOICES.slice(0, 6)], myBadge: null,
};

function renderRulesContent() {
  const el = document.getElementById('rules-content');
  el.innerHTML = `
    <h3>得分组合</h3>
    <table>
      <tr><th>组合</th><th>得分</th></tr>
      <tr><td>每个 1</td><td>100</td></tr>
      <tr><td>每个 5</td><td>50</td></tr>
      <tr><td>三个 1 / 2 / 3 / 4 / 5 / 6</td><td>1000 / 200 / 300 / 400 / 500 / 600</td></tr>
      <tr><td>四个 / 五个 / 六个同点</td><td>三同点 ×2 / ×4 / ×8</td></tr>
      <tr><td>顺子 1-5 / 2-6 / 1-6</td><td>500 / 750 / 1500</td></tr>
      <tr><td>恶魔之头（通配）</td><td>可补任意组合</td></tr>
    </table>
    <h3>回合</h3>
    <p>掷 6 颗骰子 → 保留至少一组得分骰 → 收手记分或继续掷剩余骰子。全部骰子得分后（热骰）可重掷全部 6 颗。爆骰（无任何得分）则本回合得分全部清零。先达到目标分者获胜。</p>
    <h3>特殊骰子</h3>
    <ul>${DICE_CHOICES.map(k => `<li><b>${DICE_TYPES[k].name}</b> — ${DICE_TYPES[k].desc}</li>`).join('')}</ul>
    <h3>徽章</h3>
    <ul>${Object.values(BADGES).map(b => `<li><b>${b.name}</b> — ${b.desc}</li>`).join('')}</ul>
  `;
}

function initSetupPanel() {
  // 模式
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.mode = b.dataset.mode;
    });
  });
  // 目标分
  document.querySelectorAll('[data-target]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-target]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.target = Number(b.dataset.target);
      document.getElementById('custom-target').value = '';
    });
  });
  document.getElementById('custom-target').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= 100 && v <= 10000) {
      settings.target = v;
      document.querySelectorAll('[data-target]').forEach(x => x.classList.remove('active'));
    }
  });
  // AI 难度
  document.querySelectorAll('[data-ai]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-ai]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.aiLevel = b.dataset.ai;
    });
  });
  // 骰子选择（6 颗）
  const picker = document.getElementById('dice-picker');
  DICE_CHOICES.forEach(id => {
    const b = document.createElement('button');
    b.className = 'pick-item' + (settings.myDice.includes(id) ? ' selected' : '');
    b.textContent = DICE_TYPES[id].name;
    b.addEventListener('click', () => {
      const has = settings.myDice.includes(id);
      if (has) {
        if (settings.myDice.length <= 1) return;
        settings.myDice = settings.myDice.filter(x => x !== id);
      } else {
        if (settings.myDice.length >= 6) return;
        settings.myDice.push(id);
      }
      b.classList.toggle('selected', !has);
    });
    picker.appendChild(b);
  });
  // 徽章选择
  const bpicker = document.getElementById('badge-picker');
  const none = document.createElement('button');
  none.className = 'pick-item selected';
  none.textContent = '无徽章';
  none.addEventListener('click', () => {
    settings.myBadge = null;
    bpicker.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
    none.classList.add('selected');
  });
  bpicker.appendChild(none);
  Object.values(BADGES).forEach(b => {
    const el = document.createElement('button');
    el.className = 'pick-item';
    el.textContent = b.name;
    el.title = b.desc;
    el.addEventListener('click', () => {
      settings.myBadge = b.id;
      bpicker.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
    bpicker.appendChild(el);
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('setup-modal').classList.add('hidden');
    startGame();
  });
  document.getElementById('btn-rules').addEventListener('click', () => {
    renderRulesContent();
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('setup-modal').classList.remove('hidden');
  });
  document.getElementById('btn-badge').addEventListener('click', () => handleAction({ type: 'useBadge' }));
  renderRulesContent();
}

let state = null;
let ui = null;
let aiRunning = false;

function startGame() {
  const isPvp = settings.mode === 'pvp';
  const players = [
    { name: isPvp ? '玩家一' : '亨利', dieIds: [...settings.myDice], badge: settings.myBadge },
    { name: isPvp ? '玩家二' : '酒馆老手', dieIds: Array(6).fill('normal'), badge: null },
  ];
  if (!isPvp && settings.myDice.length < 6) players[0].dieIds = players[0].dieIds.concat(Array(6 - players[0].dieIds.length).fill('normal'));
  state = newGame({ mode: settings.mode, target: settings.target, players });
  // 只创建一次 UI：重复 createUI 会累加按钮监听器（重开一局后一次点击触发多次动作）
  if (!ui) ui = createUI({ onAction: handleAction });
  render();
  startTutorialIfNeeded();
}

function render() {
  ui.render(state);
  const logEl = document.getElementById('log');
  logEl.textContent = state.log.slice(-3).join(' · ');
  document.getElementById('btn-badge').disabled = state.phase === 'gameover' || !state.players[state.turn].badge || state.players[state.turn].badgeUsed;
}

function handleAction(action) {
  if (aiRunning) return;
  state = act(state, action);
  render();
  afterAction();
}

function afterAction() {
  const pl = state.players[state.turn];
  // AI 回合
  if (settings.mode === 'ai' && state.turn === 1 && state.phase !== 'gameover') {
    aiRunning = true;
    runAITurn();
  }
  // 爆骰：转生徽章处理
  if (state.phase === 'bust') {
    const p = state.players[state.turn];
    const isHuman = settings.mode === 'pvp' || state.turn === 0;
    if (p.badge === 'resurrection' && !p.resurrectUsed) {
      if (!isHuman) {
        state = act(state, { type: 'resurrect' });
        render();
      } else {
        showBustChoices();
        return;
      }
    }
    if (isHuman) {
      const autoBust = () => {
        state = act(state, { type: 'bustAccept' });
        render();
        afterAction();
      };
      if (!p.badge === 'resurrection' || p.resurrectUsed) { autoBust(); return; }
      // 无徽章：自动结算
      if (!(p.badge === 'resurrection' && !p.resurrectUsed)) { autoBust(); return; }
    } else {
      state = act(state, { type: 'bustAccept' });
      render();
      afterAction();
    }
  }
  if (state.phase === 'gameover') {
    setTimeout(() => alert(`${state.players[state.winner].name} 获胜！目标分 ${state.config.target}`), 50);
  }
}
```

说明：`afterAction` 中爆骰分支存在冗余，Step 4 统一精简为：人类爆骰且有转生徽章 → 弹确认（`confirm`）选择是否重掷；否则 `bustAccept`。AI 一律 `bustAccept`（除非转生徽章，AI 用一次）。

- [ ] **Step 4: 精简爆骰分支（替换 Step 3 中的 afterAction）**

```js
function afterAction() {
  if (settings.mode === 'ai' && state.turn === 1 && state.phase !== 'gameover') {
    aiRunning = true;
    runAITurn();
    return;
  }
  if (state.phase === 'bust') {
    const pl = state.players[state.turn];
    const canResurrect = pl.badge === 'resurrection' && !pl.resurrectUsed;
    const isHuman = settings.mode === 'pvp' || state.turn === 0;
    if (canResurrect && isHuman) {
      if (confirm('爆骰！是否使用转生徽章重掷？')) {
        state = act(state, { type: 'resurrect' });
        render();
        afterAction();
        return;
      }
    } else if (canResurrect) {
      state = act(state, { type: 'resurrect' });
      render();
      afterAction();
      return;
    }
    state = act(state, { type: 'bustAccept' });
    render();
    afterAction();
    return;
  }
  if (state.phase === 'gameover') {
    setTimeout(() => alert(`${state.players[state.winner].name} 获胜！目标分 ${state.config.target}`), 80);
  }
}

async function runAITurn() {
  while (state.turn === 1 && state.phase !== 'gameover') {
    await delay(650);
    if (state.phase === 'idle') {
      state = act(state, { type: 'roll' });
    } else if (state.phase === 'rolling') {
      const hold = scoringDiceIndices(state.roll);
      hold.forEach(i => { state = act(state, { type: 'select', i }); });
      const heldCount = state.held.filter(Boolean).length;
      const remaining = state.roll.length - heldCount;
      const decision = aiDecision({
        level: settings.aiLevel,
        turnScore: state.turnScore,
        remaining: state.hot ? 0 : remaining,
        hot: state.hot,
      });
      if (state.hot || remaining === 0 || decision === 'roll') {
        if (heldCount > 0) state = act(state, { type: 'continueRoll' });
        else state = act(state, { type: 'roll' });
      } else if (heldCount > 0) {
        state = act(state, { type: 'pass' });
      }
    } else {
      break; // bust 等其他阶段交由 afterAction 处理
    }
    render();
  }
  aiRunning = false;
  afterAction();
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// —— 教程 ——
function startTutorialIfNeeded() {
  if (!shouldShowTutorial()) return;
  const tut = document.getElementById('tutorial');
  const title = document.getElementById('tut-title');
  const text = document.getElementById('tut-text');
  let idx = 0;
  const show = () => {
    const step = TUTORIAL_STEPS[idx];
    title.textContent = step.title;
    text.textContent = step.text;
    tut.classList.remove('hidden');
    document.querySelectorAll('.tutorial-highlight').forEach(e => e.classList.remove('tutorial-highlight'));
    const target = document.querySelector(step.selector);
    if (target) target.classList.add('tutorial-highlight');
  };
  document.getElementById('tut-next').onclick = () => {
    idx++;
    if (idx >= TUTORIAL_STEPS.length) {
      tut.classList.add('hidden');
      markTutorialDone();
    } else show();
  };
  document.getElementById('tut-skip').onclick = () => {
    tut.classList.add('hidden');
    markTutorialDone();
  };
  show();
}

// 启动
initSetupPanel();
```

- [ ] **Step 5: 本地验证（静态服务器）**

Run: `npx serve .` 或任意静态服务器，浏览器打开 index.html
Expected: 开局设置弹层可见 → 选模式/目标分/骰子 → 开始游戏 → 掷骰、保留、收手流程正常；AI 自动出牌；规则手册、教程可用

- [ ] **Step 6: 提交**

```bash
git add index.html css/style.css js/main.js
git commit -m "feat: 完成游戏界面与开局设置（index/style/main）"
```

---

## Task 10: 集成验收与文档收尾

**Files:**
- Modify: `package.json`（scripts 追加模拟测试）
- Create: `test/simulate.test.js`

- [ ] **Step 1: 写整局模拟测试（无 UI，纯引擎 + AI 跑完整局）**

`test/simulate.test.js`：

```js
import assert from 'node:assert/strict';
import { newGame, act } from '../js/engine.js';
import { scoringDiceIndices } from '../js/rules.js';
import { aiDecision } from '../js/ai.js';

function runAIStep(state, level) {
  if (state.phase === 'idle') return act(state, { type: 'roll' });
  const hold = scoringDiceIndices(state.roll);
  let s = state;
  hold.forEach(i => { s = act(s, { type: 'select', i }); });
  const heldCount = s.held.filter(Boolean).length;
  const remaining = s.roll.length - heldCount;
  const d = aiDecision({ level, turnScore: s.turnScore, remaining: s.hot ? 0 : remaining, hot: s.hot });
  if (s.hot || remaining === 0 || d === 'roll') return heldCount > 0 ? act(s, { type: 'continueRoll' }) : act(s, { type: 'roll' });
  return act(s, { type: 'pass' });
}

// 完整对局（随机种子可控性不强，但需保证能在有限步内结束）
for (const level of ['conservative', 'aggressive']) {
  let s = newGame({
    mode: 'ai', target: 2000,
    players: [
      { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null },
      { name: 'B', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null },
    ],
  });
  let guard = 0;
  while (s.phase !== 'gameover' && guard < 20000) {
    s = act(s, { type: 'pass' }); // noop 若 phase 不符，安全
    if (s.phase !== 'rolling' && s.phase !== 'idle') s = act(s, { type: 'bustAccept' });
    if (s.phase === 'bust') { s = act(s, { type: 'bustAccept' }); continue; }
    s = runAIStep(s, level);
    guard++;
  }
  assert.equal(s.phase, 'gameover', `对局应能结束 (level=${level}, steps=${guard})`);
  assert.ok(s.winner === 0 || s.winner === 1, '应有胜者');
  assert.ok(s.players[s.winner].total >= 2000, '胜者总分应达目标');
}
console.log('simulate.test.js 全部通过');
```

- [ ] **Step 2: 更新 package.json scripts**

```json
{
  "name": "kcd2-dice-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node test/rules.test.js && node test/engine.test.js && node test/simulate.test.js",
    "start": "npx serve ."
  }
}
```

- [ ] **Step 3: 运行全部测试**

Run: `npm test`
Expected: 三个测试文件均打印「全部通过」

- [ ] **Step 4: 浏览器人工验收清单**

1. 打开页面（静态服务器）→ 开局设置弹层
2. 自定义目标分（输入 1000）→ 开始
3. 掷骰 → 高亮可得分骰 → 点击保留 → 收手记分
4. 故意掷出爆骰（若出现）→ 转生徽章提示
5. 特殊骰子：装备 6 颗幸运骰，多次掷骰观察偏 1/6
6. 徽章：沃罗得收手翻倍；木匠 3+5 组合
7. 新手教程三步可跳过；规则手册内容完整
8. 本地双人模式轮流操作正常
9. 投降按钮生效

- [ ] **Step 5: 提交**

```bash
git add test/simulate.test.js package.json
git commit -m "test: 整局模拟与验收"
```

---

## 自审记录

**规格覆盖核对：**
- 完整计分表 → Task 2 ✓
- 特殊骰子 8+1 → Task 3 ✓
- 4 徽章 → Task 4/5 ✓
- 自定义目标分 → Task 5 engine + Task 9 设置面板 ✓
- 两种模式 → Task 9 ✓
- 新手教程 + 规则手册 → Task 7/9 ✓
- 程序化素材（Canvas 木桌/骰子）→ Task 8 ✓
- 可序列化 state → Task 5（reducer + structuredClone + WeakMap 隔离随机源）✓
- 联机预留 → Task 5 state 纯 JSON ✓
- 测试策略 → Task 2/5/10 ✓

**已知取舍：** 切口组合（3+5=150）为演示近似；恶魔之头通配为暴力穷举；UI 骰子用 DOM+Canvas 混合渲染（视觉目标一致）。
