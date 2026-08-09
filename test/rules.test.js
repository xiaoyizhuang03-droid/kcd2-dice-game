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

// 木匠切口为可选组合（回归）
assert.equal(scoreSelection([3, 3, 3, 5], { carpenter: true }), 350, '三3+单5优先于切口');
assert.equal(scoreSelection([3, 5], { carpenter: true }), 150, '切口3+5=150');
assert.equal(scoreSelection([3, 5, 5, 5], { carpenter: true }), 500, '三5优先于切口');

// 通配骰补单1/单5与高亮（回归）
assert.equal(scoreSelection([1, DEVIL]), 200, '恶魔补1');
assert.equal(scoreSelection([DEVIL, 2]), 100, '恶魔当1计分');
assert.ok(scoringDiceIndices([DEVIL, 2]).includes(0), '通配骰应被高亮');
assert.deepEqual(scoringDiceIndices([DEVIL, DEVIL, DEVIL, DEVIL, DEVIL]), [0, 1, 2, 3, 4], '五个通配全高亮');

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

// 幸运骰偏向 1（权重 6 vs 1）→ 大样本下 1 出现多于 4
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

import { BADGES } from '../js/badges.js';

for (const id of ['resurrection', 'carpenter', 'warlord', 'might']) {
  assert.ok(BADGES[id], `缺少徽章 ${id}`);
}
assert.ok(BADGES.carpenter.effect === 'carpenter', '木匠徽章 effect 为 carpenter');

// 恶魔之头伴骰高亮（回归）
assert.deepEqual(scoringDiceIndices([DEVIL, 2]), [0, 1], '恶魔+2 双双高亮');
assert.ok(scoringDiceIndices([DEVIL, 2, 3, 4, 6, 2]).includes(1), '恶魔伴骰应被高亮');
assert.equal(isValidSelection([DEVIL, 2]), true, '恶魔+2 为有效保留');

console.log('rules.test.js 全部通过');
