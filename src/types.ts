export type Role = "1" | "2" | "3" | "4" | "5";

export interface ItemStep {
  name: string;
  key: string;
  timing?: string;
  note?: string;
}

export interface Strategy {
  id: string;
  name: string;
  role: Role;
  summary: string;
  notes: string[];
  items: ItemStep[];
}

export interface Hero {
  id: number;
  name: string;
  key: string;
  strategies: Strategy[];
}

export type HeroAttribute = "str" | "agi" | "int" | "all";

export interface HeroCatalogEntry {
  id: number;
  key: string;
  name: string;
  englishName: string;
  attribute: HeroAttribute;
  aliases: string[];
  image: string;
}

export interface ItemCatalogEntry {
  id: number;
  key: string;
  name: string;
  englishName: string;
  aliases: string[];
  image: string;
}

export interface TimelineEvent {
  id: string;
  role: Role | "all";
  seconds: number;
  title: string;
  detail: string;
  warningSeconds: number;
  sources: TimelineEventSource[];
}

export type TimelineEventSource = "global" | "hero" | "position";

export interface StrategyTimePoint {
  id: string;
  seconds: number;
  title: string;
  warningSeconds?: number;
  repeatIntervalSeconds?: number;
  repeatUntilSeconds?: number;
}

export interface HeroStrategyV2 {
  id: string;
  heroId: number;
  title: string;
  summary: string;
  itemKeys: string[];
  timeline: StrategyTimePoint[];
}

export interface PositionStrategy {
  id: string;
  role: Role;
  title: string;
  summary: string;
  timeline: StrategyTimePoint[];
}
