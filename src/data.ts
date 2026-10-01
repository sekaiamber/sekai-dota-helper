import type { Hero, HeroCatalogEntry, HeroStrategyV2, ItemCatalogEntry, PositionStrategy, Role, StrategyTimePoint, TimelineEvent } from "./types";
import heroCatalogData from "./catalog/heroes.json";
import itemCatalogData from "./catalog/items.json";

export const cdn = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react";
export const heroImage = (key: string) => `${cdn}/heroes/${key}.png`;
export const itemImage = (key: string) => `${cdn}/items/${key}.png`;
export const heroCatalog = heroCatalogData as HeroCatalogEntry[];
export const itemCatalog = itemCatalogData as ItemCatalogEntry[];

export const roleNames: Record<Role, string> = {
  "1": "1号位 · 核心",
  "2": "2号位 · 中单",
  "3": "3号位 · 劣势路",
  "4": "4号位 · 游走",
  "5": "5号位 · 辅助"
};

export const heroes: Hero[] = [
  {
    id: 5, name: "水晶室女", key: "crystal_maiden", strategies: [
      { id: "cm-lane", name: "稳健保核", role: "5", summary: "用蓝量换线优，别用命换消耗。", notes: ["开局观察对面补给，再决定芒果是否换血", "兵线过河先拉野，不要陪大哥一起挂机", "团战站在第二屏边缘，先冰封关键突进"], items: [
        { name: "魔棒", key: "magic_wand", timing: "3–5 分钟" }, { name: "静谧之鞋", key: "tranquil_boots", timing: "8–11 分钟" }, { name: "微光披风", key: "glimmer_cape", timing: "16–20 分钟", note: "对爆发阵容优先" }, { name: "原力法杖", key: "force_staff", note: "对冲脸阵容优先" }
      ]},
      { id: "cm-greed", name: "贪发育控场", role: "4", summary: "空档期清危险线，用等级换更强控制。", notes: ["确保核心不吃的线再收", "大招不是必须完整读完，逼技能即可"], items: [
        { name: "秘法鞋", key: "arcane_boots" }, { name: "闪烁匕首", key: "blink" }, { name: "黑皇杖", key: "black_king_bar" }
      ]}
    ]
  },
  {
    id: 74, name: "祈求者", key: "invoker", strategies: [
      { id: "inv-qw", name: "冰雷节奏", role: "2", summary: "控符、抓边、压缩对方核心发育区。", notes: ["5级前不要为无意义消耗漏正反补", "每次推完中线看边路TP状态", "团战先找磁暴位置，不急着打满连招"], items: [
        { name: "魔棒", key: "magic_wand" }, { name: "相位鞋", key: "phase_boots" }, { name: "飓风长戟", key: "hurricane_pike", note: "需要拉扯时" }, { name: "阿哈利姆神杖", key: "ultimate_scepter" }
      ]},
      { id: "inv-exort", name: "火卡发育", role: "2", summary: "守住补刀基本盘，天火只打高确定性机会。", notes: ["切屏前先处理兵线", "留召唤物侦查肉山与入口"], items: [
        { name: "点金手", key: "hand_of_midas", timing: "尽量 9 分钟前" }, { name: "旅行鞋", key: "travel_boots" }, { name: "黑皇杖", key: "black_king_bar" }
      ]}
    ]
  },
  {
    id: 2, name: "斧王", key: "axe", strategies: [
      { id: "axe-3", name: "跳刀先手", role: "3", summary: "线优转塔压，线劣也要保证跳刀时间。", notes: ["5分钟前决定断线还是正面对线", "跳刀到手先开雾，不要暴露在兵线上", "吼前确认队友跟进距离"], items: [
        { name: "先锋盾", key: "vanguard", timing: "6–9 分钟" }, { name: "闪烁匕首", key: "blink", timing: "12–15 分钟" }, { name: "刃甲", key: "blade_mail" }, { name: "黑皇杖", key: "black_king_bar" }
      ]}
    ]
  },
  {
    id: 1, name: "敌法师", key: "antimage", strategies: [
      { id: "am-1", name: "标准带线", role: "1", summary: "狂战前不接低收益团，死一次比漏一波更亏。", notes: ["每分钟看一次敌方控制英雄位置", "闪烁落点要留下一次逃生路径", "二塔未掉前不要盲目带高地线"], items: [
        { name: "动力鞋", key: "power_treads" }, { name: "狂战斧", key: "bfury", timing: "13–17 分钟" }, { name: "幻影斧", key: "manta", timing: "20–24 分钟" }, { name: "深渊之刃", key: "abyssal_blade" }
      ]}
    ]
  }
];

export const getHero = (id: number): Hero => {
  const authored = heroes.find((hero) => hero.id === id);
  if (authored) return authored;
  const entry = heroCatalog.find((hero) => hero.id === id) ?? heroCatalog[0];
  return {
    id: entry.id,
    name: entry.name,
    key: entry.key,
    strategies: [{
      id: `${entry.key}-default`,
      name: "默认笔记",
      role: "5",
      summary: "这个英雄的专属策略尚未录入。",
      notes: ["暂无专属决策笔记，可在后续策略编辑器中补充。"],
      items: []
    }]
  };
};

export const defaultHeroStrategies: HeroStrategyV2[] = heroes.flatMap((hero) =>
  hero.strategies.map((strategy) => ({
    id: strategy.id,
    heroId: hero.id,
    title: strategy.name,
    summary: strategy.summary,
    itemKeys: strategy.items.map((item) => item.key),
    timeline: []
  }))
);

const positionSummaries: Record<Role, string> = {
  "1": "优先保证核心发育节奏，关键资源前提前处理兵线。",
  "2": "围绕兵线与神符制造人数差，不做低收益游走。",
  "3": "用强势期压缩对方安全区，并为团队提供先手。",
  "4": "根据关键资源时间规划游走，避免无目标逛街。",
  "5": "提前处理视野与资源路线，让核心保持安全发育。"
};

export const timeline: TimelineEvent[] = [
  { id: "bounty-0", role: "all", seconds: 0, title: "赏金符", detail: "确认分路与抢符风险", warningSeconds: 15, sources: ["global"] },
  { id: "lotus-3", role: "5", seconds: 180, title: "莲花池", detail: "提前推线，3:00 刷新第一朵莲花", warningSeconds: 20, sources: ["global"] },
  { id: "wisdom-7", role: "5", seconds: 420, title: "智慧符", detail: "6:30 开始规划路线，必要时叫4号位协防", warningSeconds: 30, sources: ["position"] },
  { id: "wisdom-7-4", role: "4", seconds: 420, title: "智慧符", detail: "优先偷对面或保自家经验符", warningSeconds: 30, sources: ["position"] },
  { id: "lotus-6", role: "5", seconds: 360, title: "莲花池", detail: "第二次莲花刷新", warningSeconds: 20, sources: ["global"] },
  { id: "power-6", role: "2", seconds: 360, title: "强化神符", detail: "5:40 推线，控 6 分钟强化符", warningSeconds: 25, sources: ["position"] },
  { id: "catapult-5", role: "3", seconds: 300, title: "攻城车波", detail: "用车线压塔或逼辅助回防", warningSeconds: 25, sources: ["position"] },
  { id: "night-5", role: "all", seconds: 300, title: "入夜", detail: "视野缩小，注意第一轮夜间游走", warningSeconds: 20, sources: ["global"] },
  { id: "tormentor-20", role: "all", seconds: 1200, title: "魔方刷新", detail: "评估阵容与状态，决定是否集合", warningSeconds: 45, sources: ["global"] }
];

const defaultGlobalEventIds = new Set(["bounty-0", "lotus-3", "lotus-6", "night-5", "tormentor-20"]);

export const defaultGlobalTimeline: StrategyTimePoint[] = timeline
  .filter((event) => defaultGlobalEventIds.has(event.id))
  .map((event) => ({ id: event.id, seconds: event.seconds, title: event.title, warningSeconds: event.warningSeconds }));

export const defaultPositionStrategies: PositionStrategy[] = (Object.keys(roleNames) as Role[]).map((role) => ({
  id: `role-${role}-standard`,
  role,
  title: "标准节奏",
  summary: positionSummaries[role],
  timeline: timeline
    .filter((event) => event.role === role && !defaultGlobalEventIds.has(event.id))
    .map((event) => ({ id: event.id, seconds: event.seconds, title: event.title, warningSeconds: 15 }))
}));
