import { useEffect, useMemo, useState } from "react";
import { Clock3, PackagePlus, Plus, Save, Search, Trash2, X } from "lucide-react";
import { itemCatalog, roleNames } from "./data";
import type { HeroCatalogEntry, HeroStrategyV2, PositionStrategy, Role, StrategyTimePoint } from "./types";

interface Props {
  open: boolean;
  hero: HeroCatalogEntry;
  role: Role;
  heroStrategies: HeroStrategyV2[];
  positionStrategies: PositionStrategy[];
  globalTimeline: StrategyTimePoint[];
  onHeroStrategiesChange: (strategies: HeroStrategyV2[]) => void;
  onPositionStrategiesChange: (strategies: PositionStrategy[]) => void;
  onGlobalTimelineChange: (timeline: StrategyTimePoint[]) => void;
  onClose: () => void;
}

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export default function StrategyEditor(props: Props) {
  const [tab, setTab] = useState<"hero" | "position" | "global">("hero");
  const currentHeroStrategies = useMemo(() => props.heroStrategies.filter((strategy) => strategy.heroId === props.hero.id), [props.hero.id, props.heroStrategies]);
  const currentPositionStrategies = useMemo(() => props.positionStrategies.filter((strategy) => strategy.role === props.role), [props.positionStrategies, props.role]);
  const [heroDraft, setHeroDraft] = useState<HeroStrategyV2 | null>(null);
  const [positionDraft, setPositionDraft] = useState<PositionStrategy | null>(null);
  const [globalDraft, setGlobalDraft] = useState<StrategyTimePoint[]>([]);

  useEffect(() => {
    setHeroDraft(currentHeroStrategies[0] ? clone(currentHeroStrategies[0]) : null);
  }, [props.hero.id, props.open]);
  useEffect(() => {
    setPositionDraft(currentPositionStrategies[0] ? clone(currentPositionStrategies[0]) : null);
  }, [props.role, props.open]);
  useEffect(() => {
    setGlobalDraft(clone(props.globalTimeline));
  }, [props.open]);

  if (!props.open) return null;

  const newHeroStrategy = () => setHeroDraft({ id: uid(), heroId: props.hero.id, title: "新策略", summary: "", itemKeys: [], timeline: [] });
  const newPositionStrategy = () => setPositionDraft({ id: uid(), role: props.role, title: "新策略", summary: "", timeline: [] });
  const saveHero = () => {
    if (!heroDraft || !heroDraft.title.trim()) return;
    const exists = props.heroStrategies.some((strategy) => strategy.id === heroDraft.id);
    props.onHeroStrategiesChange(exists ? props.heroStrategies.map((strategy) => strategy.id === heroDraft.id ? heroDraft : strategy) : [...props.heroStrategies, heroDraft]);
  };
  const savePosition = () => {
    if (!positionDraft || !positionDraft.title.trim()) return;
    const exists = props.positionStrategies.some((strategy) => strategy.id === positionDraft.id);
    props.onPositionStrategiesChange(exists ? props.positionStrategies.map((strategy) => strategy.id === positionDraft.id ? positionDraft : strategy) : [...props.positionStrategies, positionDraft]);
  };
  const saveGlobal = () => props.onGlobalTimelineChange(globalDraft);
  const deleteHero = () => {
    if (!heroDraft) return;
    props.onHeroStrategiesChange(props.heroStrategies.filter((strategy) => strategy.id !== heroDraft.id));
    setHeroDraft(null);
  };
  const deletePosition = () => {
    if (!positionDraft) return;
    props.onPositionStrategiesChange(props.positionStrategies.filter((strategy) => strategy.id !== positionDraft.id));
    setPositionDraft(null);
  };

  return <div className="editor-backdrop" onMouseDown={props.onClose}>
    <section className="strategy-editor" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><b>策略编辑器</b><small>数据只保存在本机</small></div><button onClick={props.onClose}><X size={17} /></button></header>
      <nav>
        <button className={tab === "hero" ? "active" : ""} onClick={() => setTab("hero")}><img src={props.hero.image} alt="" />英雄策略 · {props.hero.name}</button>
        <button className={tab === "position" ? "active" : ""} onClick={() => setTab("position")}>位置策略 · {roleNames[props.role]}</button>
        <button className={tab === "global" ? "active" : ""} onClick={() => setTab("global")}><Clock3 size={14} />通用时间轴</button>
      </nav>

      {tab === "hero" ? <div className="editor-body">
        <EditorChooser
          value={heroDraft?.id ?? ""}
          entries={currentHeroStrategies.map((strategy) => ({ id: strategy.id, title: strategy.title }))}
          onChange={(id) => setHeroDraft(clone(currentHeroStrategies.find((strategy) => strategy.id === id)!))}
          onAdd={newHeroStrategy}
          empty="这个英雄还没有策略"
        />
        {heroDraft && <>
          <TextFields title={heroDraft.title} summary={heroDraft.summary} onTitle={(title) => setHeroDraft({ ...heroDraft, title })} onSummary={(summary) => setHeroDraft({ ...heroDraft, summary })} />
          <ItemEditor keys={heroDraft.itemKeys} onChange={(itemKeys) => setHeroDraft({ ...heroDraft, itemKeys })} />
          <TimelineEditor points={heroDraft.timeline} onChange={(timeline) => setHeroDraft({ ...heroDraft, timeline })} />
          <EditorActions onDelete={deleteHero} onSave={saveHero} />
        </>}
      </div> : tab === "position" ? <div className="editor-body">
        <EditorChooser
          value={positionDraft?.id ?? ""}
          entries={currentPositionStrategies.map((strategy) => ({ id: strategy.id, title: strategy.title }))}
          onChange={(id) => setPositionDraft(clone(currentPositionStrategies.find((strategy) => strategy.id === id)!))}
          onAdd={newPositionStrategy}
          empty="这个位置还没有策略"
        />
        {positionDraft && <>
          <TextFields title={positionDraft.title} summary={positionDraft.summary} onTitle={(title) => setPositionDraft({ ...positionDraft, title })} onSummary={(summary) => setPositionDraft({ ...positionDraft, summary })} />
          <TimelineEditor points={positionDraft.timeline} onChange={(timeline) => setPositionDraft({ ...positionDraft, timeline })} />
          <EditorActions onDelete={deletePosition} onSave={savePosition} />
        </>}
      </div> : <div className="editor-body global-editor">
        <p>无脑应用于所有英雄和位置，适合入夜、赏金符、魔方、莲花池等公共事件。</p>
        <TimelineEditor label="通用时间点" points={globalDraft} onChange={setGlobalDraft} />
        <div className="editor-actions"><button className="save" onClick={saveGlobal}><Save size={14} />保存通用时间轴</button></div>
      </div>}
    </section>
  </div>;
}

function EditorChooser({ value, entries, onChange, onAdd, empty }: { value: string; entries: {id:string;title:string}[]; onChange:(id:string)=>void; onAdd:()=>void; empty:string }) {
  return <div className="editor-chooser">
    {entries.length ? <select value={value} onChange={(event) => onChange(event.target.value)}>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select> : <span>{empty}</span>}
    <button onClick={onAdd}><Plus size={14} />新增策略</button>
  </div>;
}

function TextFields({ title, summary, onTitle, onSummary }: { title:string;summary:string;onTitle:(v:string)=>void;onSummary:(v:string)=>void }) {
  return <div className="editor-fields">
    <label><span>策略标题</span><input value={title} maxLength={30} onChange={(event) => onTitle(event.target.value)} /></label>
    <label><span>一句话概括</span><input value={summary} maxLength={100} onChange={(event) => onSummary(event.target.value)} placeholder="只写最重要的决策原则" /></label>
  </div>;
}

function ItemEditor({ keys, onChange }: { keys:string[];onChange:(keys:string[])=>void }) {
  const [query, setQuery] = useState("");
  const needle = query.toLowerCase().replace(/[\s_-]/g, "");
  const results = needle ? itemCatalog.filter((item) => [item.name,item.englishName,item.key,...item.aliases].some((value) => value.toLowerCase().replace(/[\s_-]/g, "").includes(needle))).slice(0, 24) : [];
  return <div className="item-editor"><h3><PackagePlus size={14} />出装思路 <small>按顺序选择物品</small></h3>
    <div className="selected-items">{keys.map((key, index) => { const item = itemCatalog.find((entry) => entry.key === key); return item && <button key={`${key}-${index}`} title="点击移除" onClick={() => onChange(keys.filter((_, i) => i !== index))}><i>{index + 1}</i><img src={item.image} alt="" /><span>{item.name}</span><X size={10} /></button>; })}{!keys.length && <span>尚未选择物品</span>}</div>
    <div className="item-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索物品或别称，例如：跳刀、BKB" /></div>
    {!!results.length && <div className="item-results">{results.map((item) => <button key={item.id} onClick={() => { onChange([...keys, item.key]); setQuery(""); }}><img src={item.image} alt="" /><span>{item.name}<small>{item.aliases.slice(0,2).join(" · ") || item.englishName}</small></span><Plus size={12} /></button>)}</div>}
  </div>;
}

function TimelineEditor({ points, onChange, label = "策略时间点" }: { points:StrategyTimePoint[];onChange:(points:StrategyTimePoint[])=>void;label?:string }) {
  return <div className="timeline-editor"><h3><Clock3 size={14} />{label} <small>可以留空 · 默认提前 15 秒提醒</small><button onClick={() => onChange([...points, { id: uid(), seconds: 0, title: "新时间点", warningSeconds: 15 }])}><Plus size={12} />添加</button></h3>
    {[...points].sort((a,b) => a.seconds-b.seconds).map((point) => <div className="timeline-edit-row" key={point.id}>
      <div className="time-parts"><input type="number" min="0" value={Math.floor(point.seconds / 60)} onChange={(event) => onChange(points.map((entry) => entry.id === point.id ? { ...entry, seconds: Math.max(0, Number(event.target.value)) * 60 + entry.seconds % 60 } : entry))} /><i>:</i><input type="number" min="0" max="59" value={point.seconds % 60} onChange={(event) => onChange(points.map((entry) => entry.id === point.id ? { ...entry, seconds: Math.floor(entry.seconds / 60) * 60 + Math.min(59, Math.max(0, Number(event.target.value))) } : entry))} /></div>
      <input value={point.title} onChange={(event) => onChange(points.map((entry) => entry.id === point.id ? { ...entry, title: event.target.value } : entry))} />
      <label className="warning-input"><input type="number" min="0" max="300" value={point.warningSeconds ?? 15} onChange={(event) => onChange(points.map((entry) => entry.id === point.id ? { ...entry, warningSeconds: Math.min(300, Math.max(0, Number(event.target.value))) } : entry))} /><span>秒前</span></label>
      <button onClick={() => onChange(points.filter((entry) => entry.id !== point.id))}><Trash2 size={12} /></button>
    </div>)}
    {!points.length && <div className="editor-empty">暂无时间点</div>}
  </div>;
}

function EditorActions({ onDelete, onSave }: { onDelete:()=>void;onSave:()=>void }) {
  return <div className="editor-actions"><button className="danger" onClick={onDelete}><Trash2 size={13} />删除策略</button><button className="save" onClick={onSave}><Save size={14} />保存策略</button></div>;
}
