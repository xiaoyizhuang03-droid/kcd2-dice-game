// AI 决策：返回 'pass' 或 'roll'。remaining=保留得分骰后剩余可掷骰数；hot=全骰得分。
export function aiDecision({ level, turnScore, remaining, hot }) {
  if (hot) return 'roll'; // 热骰必继续
  const thresholds = {
    conservative: { passTurn: 400, passRemaining: 2 },
    aggressive: { passTurn: 800, passRemaining: 2 },
  };
  const t = thresholds[level] || thresholds.conservative;
  if (turnScore >= t.passTurn) return 'pass';
  if (remaining <= t.passRemaining && turnScore >= 250) return 'pass';
  return 'roll';
}
