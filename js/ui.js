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
    if (btnContinue) btnContinue.disabled = state.phase === 'gameover' || !state.roll.some((_, i) => state.held[i]);
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
