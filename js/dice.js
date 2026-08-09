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

// 按权重掷一个面（rng 可注入，供测试与引擎使用；默认 Math.random）
export function rollFace(die, rng = Math.random) {
  const total = die.weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < die.faces.length; i++) {
    r -= die.weights[i];
    if (r < 0) return die.faces[i];
  }
  return die.faces[die.faces.length - 1];
}

// 掷一组骰子，返回 { faces, dieIds }
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
