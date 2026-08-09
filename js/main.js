import { newGame, act } from './engine.js';
import { createUI, drawTableTexture } from './ui.js';
import { scoringDiceIndices } from './rules.js';
import { BADGES } from './badges.js';
import { DICE_TYPES } from './dice.js';
import { aiDecision } from './ai.js';
import { TUTORIAL_STEPS, shouldShowTutorial, markTutorialDone } from './tutorial.js';
import { playHold, playBank } from './sound.js';

const DICE_CHOICES = ['normal', 'lucky', 'devil', 'antiochus', 'trinity', 'even', 'odd', 'misfortune', 'unbalanced'];

// —— 设置面板状态 ——
let settings = {
  mode: 'ai', target: 2000, aiLevel: 'conservative',
  myDice: [...DICE_CHOICES.slice(0, 6)], myBadge: null, myBadge2: null,
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
      <tr><td>恶魔之头（通配）</td><td>可补任意组合，可单独充当 1（100 分）或 5（50 分）</td></tr>
    </table>
    <h3>回合</h3>
    <p>掷 6 颗骰子 → 保留至少一组得分骰 → 收手记分或继续掷剩余骰子。全部骰子得分后（热骰）可重掷全部 6 颗。爆骰（无任何得分）则本回合得分全部清零。先达到目标分者获胜。</p>
    <h3>特殊骰子</h3>
    <ul>${DICE_CHOICES.map(k => `<li><b>${DICE_TYPES[k].name}</b> — ${DICE_TYPES[k].desc}</li>`).join('')}</ul>
    <h3>徽章</h3>
    <ul>${Object.values(BADGES).map(b => `<li><b>${b.name}</b> — ${b.desc}</li>`).join('')}</ul>
  `;
}

function renderDicePicker() {
  const picker = document.getElementById('dice-picker');
  picker.innerHTML = '';
  const total = settings.myDice.length;
  DICE_CHOICES.forEach(id => {
    const count = settings.myDice.filter(x => x === id).length;
    const row = document.createElement('div');
    row.className = 'pick-row';
    const name = document.createElement('span');
    name.className = 'pick-name';
    name.textContent = DICE_TYPES[id].name;
    name.title = DICE_TYPES[id].desc;
    const minus = document.createElement('button');
    minus.className = 'stepper';
    minus.textContent = '−';
    minus.disabled = count === 0;
    minus.addEventListener('click', () => {
      const i = settings.myDice.indexOf(id);
      if (i >= 0) settings.myDice.splice(i, 1);
      renderDicePicker();
    });
    const cnt = document.createElement('span');
    cnt.className = 'pick-count';
    cnt.textContent = count;
    const plus = document.createElement('button');
    plus.className = 'stepper';
    plus.textContent = '+';
    plus.disabled = total >= 6;
    plus.addEventListener('click', () => {
      settings.myDice.push(id);
      renderDicePicker();
    });
    row.append(name, minus, cnt, plus);
    picker.appendChild(row);
  });
  const totalEl = document.getElementById('dice-total');
  if (totalEl) {
    totalEl.textContent = `已选 ${total}/6`;
    totalEl.classList.toggle('incomplete', total !== 6);
  }
  document.getElementById('btn-start').disabled = total !== 6;
}

function initSetupPanel() {
  // 模式
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.mode = b.dataset.mode;
      document.getElementById('p2-badge-field').classList.toggle('hidden', settings.mode !== 'pvp');
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
  // 骰子选择（6 颗，数量步进器）
  renderDicePicker();
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

  // 玩家二徽章选择（仅 PvP）
  const bpicker2 = document.getElementById('badge-picker2');
  const none2 = document.createElement('button');
  none2.className = 'pick-item selected';
  none2.textContent = '无徽章';
  none2.addEventListener('click', () => {
    settings.myBadge2 = null;
    bpicker2.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
    none2.classList.add('selected');
  });
  bpicker2.appendChild(none2);
  Object.values(BADGES).forEach(b => {
    const el = document.createElement('button');
    el.className = 'pick-item';
    el.textContent = b.name;
    el.title = b.desc;
    el.addEventListener('click', () => {
      settings.myBadge2 = b.id;
      bpicker2.querySelectorAll('.pick-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
    bpicker2.appendChild(el);
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
let bustPending = false;
let aiGeneration = 0;

// —— 动画节奏（配合 ui.js 骰盅揭盅 900ms / settle 380ms） ——
const BUST_DELAY = 3000;      // 爆骰结算延迟：骰盅揭盅后让玩家看清骰面再结算
const AI_ROLL_DELAY = 1500;   // AI 掷骰前停顿（示意轮到 AI）
const AI_REVEAL_DELAY = 1800; // AI 掷骰后停顿：等骰盅揭盅并停留看清骰面
const AI_SELECT_DELAY = 420;  // AI 逐个选骰的间隔（展示它选了哪些骰子）
const AI_DECIDE_DELAY = 1200; // AI 做出继续/收手决策前的停顿

function startGame() {
  aiRunning = false;
  aiGeneration++;
  const isPvp = settings.mode === 'pvp';
  const players = [
    { name: isPvp ? '玩家一' : '亨利', dieIds: [...settings.myDice], badge: settings.myBadge },
    { name: isPvp ? '玩家二' : '酒馆老手', dieIds: Array(6).fill('normal'), badge: isPvp ? settings.myBadge2 : null },
  ];
  state = newGame({ mode: settings.mode, target: settings.target, players });
  // 只创建一次 UI：重复 createUI 会累加按钮监听器（重开一局后一次点击触发多次动作）
  if (!ui) ui = createUI({ onAction: handleAction });
  render();
  startTutorialIfNeeded();
}

function render() {
  ui.render(state);
  const cur = state.players[state.turn];
  document.getElementById('btn-badge').disabled = state.phase === 'gameover' || state.phase === 'bust' || !cur.badge || cur.badgeUsed || cur.badge === 'resurrection';
  document.getElementById('btn-giveup').disabled = state.phase === 'gameover' || state.phase === 'bust' || aiRunning;
}

function handleAction(action) {
  if (aiRunning || bustPending) return;
  if (action.type === 'select') playHold();
  else if (action.type === 'pass') playBank();
  state = act(state, action);
  render();
  afterAction();
}

function afterAction() {
  if (settings.mode === 'ai' && state.turn === 1 && (state.phase === 'idle' || state.phase === 'rolling')) {
    aiRunning = true;
    runAITurn();
    return;
  }
  if (state.phase === 'bust') {
    const pl = state.players[state.turn];
    const canResurrect = pl.badge === 'resurrection' && !pl.resurrectUsed;
    const isHuman = settings.mode === 'pvp' || state.turn === 0;
    bustPending = true; // 爆骰动画窗口内屏蔽输入
    // 骰盅揭盅（900ms）+ 骰子 settle 后停留，给玩家看清爆骰骰面的时间
    const resolveBust = () => {
      bustPending = false;
      if (canResurrect && isHuman) {
        if (confirm('爆骰！是否使用转生徽章重掷？')) {
          state = act(state, { type: 'resurrect' });
        } else {
          state = act(state, { type: 'bustAccept' });
        }
      } else if (canResurrect) {
        state = act(state, { type: 'resurrect' });
      } else {
        state = act(state, { type: 'bustAccept' });
      }
      render();
      afterAction();
    };
    setTimeout(resolveBust, BUST_DELAY);
    return;
  }
  if (state.phase === 'gameover') {
    setTimeout(() => alert(`${state.players[state.winner].name} 获胜！目标分 ${state.config.target}`), 80);
  }
}

async function runAITurn() {
  const gen = aiGeneration;
  while (state.turn === 1 && (state.phase === 'idle' || state.phase === 'rolling')) {
    if (state.phase === 'idle') {
      await delay(AI_ROLL_DELAY); // 轮到 AI，先停顿示意
      if (gen !== aiGeneration) return; // 重开一局：取消本循环
      state = act(state, { type: 'roll' });
    } else if (state.phase === 'rolling') {
      await delay(AI_REVEAL_DELAY); // 骰盅揭盅 + 停留，让玩家看清 AI 掷出的骰面
      if (gen !== aiGeneration) return;
      const hold = scoringDiceIndices(state.roll);
      // 逐个选中，展示 AI 保留哪些骰子（与玩家点击一致：上移 + 音效）
      for (const i of hold) {
        state = act(state, { type: 'select', i });
        playHold();
        render();
        await delay(AI_SELECT_DELAY);
        if (gen !== aiGeneration) return;
      }
      const heldCount = state.held.filter(Boolean).length;
      const remaining = state.roll.length - heldCount;
      const decision = aiDecision({
        level: settings.aiLevel,
        turnScore: state.turnScore,
        remaining: state.hot ? 0 : remaining,
        hot: state.hot,
      });
      await delay(AI_DECIDE_DELAY); // AI 思考：继续掷还是收手
      if (gen !== aiGeneration) return;
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
  render();
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
