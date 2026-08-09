import { newGame, act } from './engine.js';
import { createUI, drawTableTexture } from './ui.js';
import { scoringDiceIndices } from './rules.js';
import { BADGES } from './badges.js';
import { DICE_TYPES } from './dice.js';
import { aiDecision } from './ai.js';
import { TUTORIAL_STEPS, shouldShowTutorial, markTutorialDone } from './tutorial.js';

const DICE_CHOICES = ['normal', 'lucky', 'devil', 'antiochus', 'trinity', 'even', 'odd', 'misfortune', 'unbalanced'];

// —— 设置面板状态 ——
let settings = {
  mode: 'ai', target: 2000, aiLevel: 'conservative',
  myDice: [...DICE_CHOICES.slice(0, 6)], myBadge: null,
};

function renderRulesContent() {
  const el = document.getElementById('rules-content');
  el.innerHTML = `
    <h3>得分组合</h3>
    <table>
      <tr><th>组合</th><th>得分</th></tr>
      <tr><td>每个 1</td><td>100</td></tr>
      <tr><td>每个 5</td><td>50</td></tr>
      <tr><td>三个 1 / 2 / 3 / 4 / 5 / 6</td><td>1000 / 200 / 300 / 400 / 500 / 600</td></tr>
      <tr><td>四个 / 五个 / 六个同点</td><td>三同点 ×2 / ×4 / ×8</td></tr>
      <tr><td>顺子 1-5 / 2-6 / 1-6</td><td>500 / 750 / 1500</td></tr>
      <tr><td>恶魔之头（通配）</td><td>可补任意组合</td></tr>
    </table>
    <h3>回合</h3>
    <p>掷 6 颗骰子 → 保留至少一组得分骰 → 收手记分或继续掷剩余骰子。全部骰子得分后（热骰）可重掷全部 6 颗。爆骰（无任何得分）则本回合得分全部清零。先达到目标分者获胜。</p>
    <h3>特殊骰子</h3>
    <ul>${DICE_CHOICES.map(k => `<li><b>${DICE_TYPES[k].name}</b> — ${DICE_TYPES[k].desc}</li>`).join('')}</ul>
    <h3>徽章</h3>
    <ul>${Object.values(BADGES).map(b => `<li><b>${b.name}</b> — ${b.desc}</li>`).join('')}</ul>
  `;
}

function initSetupPanel() {
  // 模式
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.mode = b.dataset.mode;
    });
  });
  // 目标分
  document.querySelectorAll('[data-target]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-target]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.target = Number(b.dataset.target);
      document.getElementById('custom-target').value = '';
    });
  });
  document.getElementById('custom-target').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= 100 && v <= 10000) {
      settings.target = v;
      document.querySelectorAll('[data-target]').forEach(x => x.classList.remove('active'));
    }
  });
  // AI 难度
  document.querySelectorAll('[data-ai]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-ai]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.aiLevel = b.dataset.ai;
    });
  });
  // 骰子选择（6 颗）
  const picker = document.getElementById('dice-picker');
  DICE_CHOICES.forEach(id => {
    const b = document.createElement('button');
    b.className = 'pick-item' + (settings.myDice.includes(id) ? ' selected' : '');
    b.textContent = DICE_TYPES[id].name;
    b.addEventListener('click', () => {
      const has = settings.myDice.includes(id);
      if (has) {
        if (settings.myDice.length <= 1) return;
        settings.myDice = settings.myDice.filter(x => x !== id);
      } else {
        if (settings.myDice.length >= 6) return;
        settings.myDice.push(id);
      }
      b.classList.toggle('selected', !has);
    });
    picker.appendChild(b);
  });
  // 徽章选择
  const bpicker = document.getElementById('badge-picker');
  const none = document.createElement('button');
  none.className = 'pick-item selected';
  none.textContent = '无徽章';
  none.addEventListener('click', () => {
    settings.myBadge = null;
    bpicker.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
    none.classList.add('selected');
  });
  bpicker.appendChild(none);
  Object.values(BADGES).forEach(b => {
    const el = document.createElement('button');
    el.className = 'pick-item';
    el.textContent = b.name;
    el.title = b.desc;
    el.addEventListener('click', () => {
      settings.myBadge = b.id;
      bpicker.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
    bpicker.appendChild(el);
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('setup-modal').classList.add('hidden');
    startGame();
  });
  document.getElementById('btn-rules').addEventListener('click', () => {
    renderRulesContent();
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('setup-modal').classList.remove('hidden');
  });
  document.getElementById('btn-badge').addEventListener('click', () => handleAction({ type: 'useBadge' }));
  renderRulesContent();
}

let state = null;
let ui = null;
let aiRunning = false;

function startGame() {
  const isPvp = settings.mode === 'pvp';
  const players = [
    { name: isPvp ? '玩家一' : '亨利', dieIds: [...settings.myDice], badge: settings.myBadge },
    { name: isPvp ? '玩家二' : '酒馆老手', dieIds: Array(6).fill('normal'), badge: null },
  ];
  if (!isPvp && settings.myDice.length < 6) players[0].dieIds = players[0].dieIds.concat(Array(6 - players[0].dieIds.length).fill('normal'));
  state = newGame({ mode: settings.mode, target: settings.target, players });
  // 只创建一次 UI：重复 createUI 会累加按钮监听器（重开一局后一次点击触发多次动作）
  if (!ui) ui = createUI({ onAction: handleAction });
  render();
  startTutorialIfNeeded();
}

function render() {
  ui.render(state);
  const logEl = document.getElementById('log');
  logEl.textContent = state.log.slice(-3).join(' · ');
  document.getElementById('btn-badge').disabled = state.phase === 'gameover' || !state.players[state.turn].badge || state.players[state.turn].badgeUsed;
}

function handleAction(action) {
  if (aiRunning) return;
  state = act(state, action);
  render();
  afterAction();
}

function afterAction() {
  if (settings.mode === 'ai' && state.turn === 1 && state.phase !== 'gameover') {
    aiRunning = true;
    runAITurn();
    return;
  }
  if (state.phase === 'bust') {
    const pl = state.players[state.turn];
    const canResurrect = pl.badge === 'resurrection' && !pl.resurrectUsed;
    const isHuman = settings.mode === 'pvp' || state.turn === 0;
    if (canResurrect && isHuman) {
      if (confirm('爆骰！是否使用转生徽章重掷？')) {
        state = act(state, { type: 'resurrect' });
        render();
        afterAction();
        return;
      }
    } else if (canResurrect) {
      state = act(state, { type: 'resurrect' });
      render();
      afterAction();
      return;
    }
    state = act(state, { type: 'bustAccept' });
    render();
    afterAction();
    return;
  }
  if (state.phase === 'gameover') {
    setTimeout(() => alert(`${state.players[state.winner].name} 获胜！目标分 ${state.config.target}`), 80);
  }
}

async function runAITurn() {
  while (state.turn === 1 && state.phase !== 'gameover') {
    await delay(650);
    if (state.phase === 'idle') {
      state = act(state, { type: 'roll' });
    } else if (state.phase === 'rolling') {
      const hold = scoringDiceIndices(state.roll);
      hold.forEach(i => { state = act(state, { type: 'select', i }); });
      const heldCount = state.held.filter(Boolean).length;
      const remaining = state.roll.length - heldCount;
      const decision = aiDecision({
        level: settings.aiLevel,
        turnScore: state.turnScore,
        remaining: state.hot ? 0 : remaining,
        hot: state.hot,
      });
      if (state.hot || remaining === 0 || decision === 'roll') {
        if (heldCount > 0) state = act(state, { type: 'continueRoll' });
        else state = act(state, { type: 'roll' });
      } else if (heldCount > 0) {
        state = act(state, { type: 'pass' });
      }
    } else {
      break; // bust 等其他阶段交由 afterAction 处理
    }
    render();
  }
  aiRunning = false;
  afterAction();
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// —— 教程 ——
function startTutorialIfNeeded() {
  if (!shouldShowTutorial()) return;
  const tut = document.getElementById('tutorial');
  const title = document.getElementById('tut-title');
  const text = document.getElementById('tut-text');
  let idx = 0;
  const show = () => {
    const step = TUTORIAL_STEPS[idx];
    title.textContent = step.title;
    text.textContent = step.text;
    tut.classList.remove('hidden');
    document.querySelectorAll('.tutorial-highlight').forEach(e => e.classList.remove('tutorial-highlight'));
    const target = document.querySelector(step.selector);
    if (target) target.classList.add('tutorial-highlight');
  };
  document.getElementById('tut-next').onclick = () => {
    idx++;
    if (idx >= TUTORIAL_STEPS.length) {
      tut.classList.add('hidden');
      markTutorialDone();
    } else show();
  };
  document.getElementById('tut-skip').onclick = () => {
    tut.classList.add('hidden');
    markTutorialDone();
  };
  show();
}

// 木桌纹理背景（一次性生成）
const bgCanvas = document.getElementById('table-bg');
if (bgCanvas) {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  drawTableTexture(bgCanvas);
}

// 启动
initSetupPanel();
