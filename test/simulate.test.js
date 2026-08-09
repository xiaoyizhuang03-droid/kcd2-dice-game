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
    // 爆骰时结算并轮换（引擎 act 在非 bust 阶段为 noop，安全）
    if (s.phase === 'bust') s = act(s, { type: 'bustAccept' });
    s = runAIStep(s, level);
    guard++;
  }
  assert.equal(s.phase, 'gameover', `对局应能结束 (level=${level}, steps=${guard})`);
  assert.ok(s.winner === 0 || s.winner === 1, '应有胜者');
  assert.ok(s.players[s.winner].total >= 2000, '胜者总分应达目标');
}
console.log('simulate.test.js 全部通过');
