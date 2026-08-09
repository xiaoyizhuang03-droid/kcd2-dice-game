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
