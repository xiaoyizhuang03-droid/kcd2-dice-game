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

// 摇骰声：骰盅内连续碰撞 + 落定闷响
export function playShake() {
  const c = audio();
  if (!c) return;
  for (let i = 0; i < 7; i++) {
    setTimeout(() => blip(320 + Math.random() * 260, 180, 0.035, 0.07), i * 85);
  }
  setTimeout(() => blip(130, 55, 0.16, 0.13), 640); // 揭盅落定闷响
}
