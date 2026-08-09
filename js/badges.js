// 徽章定义。effect 字段供引擎消费。
export const BADGES = {
  resurrection: {
    id: 'resurrection',
    name: '转生徽章',
    desc: '爆骰后可将本回合最后一次掷骰重掷一次。每局 1 次。',
    effect: 'resurrection',
  },
  carpenter: {
    id: 'carpenter',
    name: '木匠优势徽章',
    desc: '获得新组合「切口」：3+5 = 150 分。',
    effect: 'carpenter',
  },
  warlord: {
    id: 'warlord',
    name: '沃罗得徽章',
    desc: '本回合收手时得分 ×1.5。每局 1 次。',
    effect: 'warlord',
  },
  might: {
    id: 'might',
    name: '法师徽章',
    desc: '本回合掷骰时额外多掷一颗骰子。每局 1 次。',
    effect: 'might',
  },
};

export function getBadge(id) {
  return BADGES[id] || null;
}
