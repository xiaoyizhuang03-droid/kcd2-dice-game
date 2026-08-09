import assert from 'node:assert/strict';
import { newGame, act, player } from '../js/engine.js';
import { scoreSelection } from '../js/rules.js';

const P1 = { name: '亨瑞', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null };
const P2 = { name: 'AI', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: null };
const base = { mode: 'ai', target: 2000, players: [P1, P2] };

// 开局：phase=idle，轮到我方，掷骰数=6
let s = newGame(base, () => 0); // 受控 rng：恒掷出 1，避免首掷爆骰导致 flaky
assert.equal(s.phase, 'idle');
assert.equal(s.turn, 0);
assert.equal(s.roll.length, 0);

// 掷骰后 phase=rolling，6 颗
s = act(s, { type: 'roll' });
assert.equal(s.phase, 'rolling');
assert.equal(s.roll.length, 6);

// 受控 rng：固定返回 0（普通骰第一面=1）
const rng = () => 0;
let s1 = newGame(base, rng);
s1 = act(s1, { type: 'roll' });
assert.deepEqual(s1.roll, [1, 1, 1, 1, 1, 1], 'rng=0 应全为1');

// 保留三1收手
s1 = act(s1, { type: 'select', i: 0 });
s1 = act(s1, { type: 'select', i: 1 });
s1 = act(s1, { type: 'select', i: 2 });
s1 = act(s1, { type: 'pass' });
assert.equal(s1.players[0].total, 1000, '保留三1收手=1000');

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

// 爆骰：序列 rng 掷出 [2,3,4,6,2,3]（无1无5无三同）→ 无分即爆
// 注：不能用恒定 rng——六颗同面（如恒3）会组成三同点，必然有分
let midI = 0;
const midSeq = [0.2, 0.4, 0.55, 0.9, 0.2, 0.4]; // → 面 [2,3,4,6,2,3]
const midRng = () => midSeq[midI++ % midSeq.length];
let s4 = newGame(base, midRng);
s4 = act(s4, { type: 'roll' });
assert.equal(s4.phase, 'bust', '无分组合应爆骰');

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

// 转生徽章：爆骰后可重掷
const RS = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'resurrection' };
let s10 = newGame({ mode: 'ai', target: 2000, players: [RS, P2] }, midRng);
s10 = act(s10, { type: 'roll' }); // 爆骰
assert.equal(s10.phase, 'bust');
s10 = act(s10, { type: 'resurrect' }); // 重掷（序列仍为无分组合 → 再次爆骰）
assert.equal(s10.phase, 'bust');
assert.equal(s10.players[0].resurrectUsed, true);

// 法师徽章（额外骰）：使用后下一次掷骰骰子数 +1
const MG = { name: 'A', dieIds: ['normal','normal','normal','normal','normal','normal'], badge: 'might' };
let s11 = newGame({ mode: 'ai', target: 2000, players: [MG, P2] }, rng);
s11 = act(s11, { type: 'roll' }); // 6颗
s11 = act(s11, { type: 'select', i: 0 });
s11 = act(s11, { type: 'useBadge' }); // 启用法师
s11 = act(s11, { type: 'continueRoll' }); // 剩余5 +1 → 6颗
assert.equal(s11.roll.length, 6, '法师徽章额外骰生效');
assert.equal(s11.players[0].badgeUsed, true, '法师徽章标记已用');

// 爆骰认输：turnScore 清零并轮换
const midRng2 = (() => { let i = 0; const seq = [0.2, 0.4, 0.55, 0.9, 0.2, 0.4]; return () => seq[i++ % seq.length]; })();
let s12 = newGame(base, midRng2);
s12 = act(s12, { type: 'roll' }); // [2,3,4,6,2,3] 爆骰
assert.equal(s12.phase, 'bust');
s12 = act(s12, { type: 'bustAccept' });
assert.equal(s12.phase, 'idle');
assert.equal(s12.turn, 1, '爆骰认输后轮到对手');
assert.equal(s12.turnScore, 0, '本回合得分清零');
assert.equal(s12.roll.length, 0);

// state 可 JSON 序列化（联机基础）
let s13 = newGame(base);
s13 = act(s13, { type: 'roll' });
const revived = JSON.parse(JSON.stringify(s13));
assert.deepEqual(revived.players[0], s13.players[0], 'state 可序列化往返');

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

// rollCount：每次新掷骰递增（供 UI 识别"刚掷出"）
let sC = newGame(base, () => 0);
sC = act(sC, { type: 'roll' });
assert.equal(sC.rollCount, 1, '首次掷骰 rollCount=1');
sC = act(sC, { type: 'select', i: 0 });
sC = act(sC, { type: 'continueRoll' });
assert.equal(sC.rollCount, 2, '继续掷骰 rollCount=2');

console.log('engine.test.js 全部通过');
