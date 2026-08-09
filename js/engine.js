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
