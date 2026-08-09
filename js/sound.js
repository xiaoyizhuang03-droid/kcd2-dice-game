// 程序化音效（WebAudio，零音频文件）。所有函数在无 AudioContext 环境下安全降级为 no-op。
let ctx = null;

function audio() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}

function blip(freqStart, freqEnd, duration, volume) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freqStart, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration + 0.02);
}

// 掷骰：低音下落碰撞声
export function playRoll() {
  blip(220, 60, 0.14, 0.14);
  setTimeout(() => blip(180, 50, 0.12, 0.10), 70);
}

// 保留骰子：短促点击
export function playHold() {
  blip(520, 380, 0.06, 0.08);
}

// 收手记分：上行双音
export function playBank() {
  blip(330, 660, 0.12, 0.10);
}
