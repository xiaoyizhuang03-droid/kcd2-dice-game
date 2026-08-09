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
  const best = (arr) => Math.max(straightScore(arr), fixedScore(arr), fixedScore(arr, opts.carpenter));
  if (devils === 0) return best(fixed);
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

// 可得分骰子索引（1/5、三同点组、顺子、恶魔之头及可与其搭配的伴骰）——用于 UI 高亮提示
export function scoringDiceIndices(faces, opts = {}) {
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
  if (devils > 0 && scoreSelection(faces) > 0) {
    const devilCount = faces.filter(f => f === DEVIL).length;
    faces.forEach((f, i) => {
      if (f === DEVIL) { idx.add(i); return; }
      if (idx.has(i)) return;
      // 该骰 + 全部通配骰 是否能构成有效保留
      const subset = faces.filter(x => x === DEVIL).concat([f]);
      if (isValidSelection(subset, { carpenter: opts.carpenter })) idx.add(i);
    });
  }
  return [...idx].sort((a, b) => a - b);
}
