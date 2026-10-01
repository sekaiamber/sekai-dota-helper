import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ChevronDown, Eye, EyeOff, Grip, Pause, PencilLine, Play, RotateCcw, Search, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { defaultHeroStrategies, defaultPositionStrategies, heroCatalog, itemCatalog, roleNames } from "./data";
import type { HeroCatalogEntry, HeroAttribute, HeroStrategyV2, PositionStrategy, Role, TimelineEvent } from "./types";
import StrategyEditor from "./StrategyEditor";

const isTauri = () => "__TAURI_INTERNALS__" in window;
type DisplayMode = "normal" | "compact" | "minimal";
const formatTime = (seconds: number) => {
  const sign = seconds < 0 ? "−" : "";
  const absolute = Math.abs(Math.floor(seconds));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
};

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

export default function App() {
  return new URLSearchParams(window.location.search).get("mode") === "unlock"
    ? <UnlockController />
    : <MainOverlay />;
}

function MainOverlay() {
  const [heroId, setHeroId] = usePersisted("hero", heroCatalog[0].id);
  const hero = heroCatalog.find((entry) => entry.id === heroId) ?? heroCatalog[0];
  const [heroStrategies, setHeroStrategies] = usePersisted<HeroStrategyV2[]>("hero-strategies-v2", defaultHeroStrategies);
  const [positionStrategies, setPositionStrategies] = usePersisted<PositionStrategy[]>("position-strategies-v2", defaultPositionStrategies);
  const heroOptions = heroStrategies.filter((entry) => entry.heroId === hero.id);
  const [heroStrategyId, setHeroStrategyId] = usePersisted("hero-strategy-selection", heroOptions[0]?.id ?? "");
  const heroStrategy = heroOptions.find((entry) => entry.id === heroStrategyId) ?? heroOptions[0] ?? null;
  const [role, setRole] = usePersisted<Role>("role", "5");
  const positionOptions = positionStrategies.filter((entry) => entry.role === role);
  const [positionStrategyId, setPositionStrategyId] = usePersisted("position-strategy-selection", positionOptions[0]?.id ?? "");
  const positionStrategy = positionOptions.find((entry) => entry.id === positionStrategyId) ?? positionOptions[0] ?? null;
  const [displayMode, setDisplayMode] = usePersisted<DisplayMode>("display-mode", "normal");
  const [editorOpen, setEditorOpen] = useState(false);
  const [clickThrough, setClickThrough] = useState(false);
  const clickThroughRef = useRef(false);
  const shortcutPressedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [fired, setFired] = useState<string[]>([]);
  const anchorRef = useRef({ at: performance.now(), elapsed: 0 });

  useEffect(() => {
    if (!isTauri()) return;
    const sizes: Record<DisplayMode, [number, number]> = {
      normal: [600, 800],
      compact: [460, 560],
      minimal: [244, 360]
    };
    void import("@tauri-apps/api/window").then(({ getCurrentWindow, LogicalSize }) => {
      const [width, height] = editorOpen ? [720, 820] : sizes[displayMode];
      return getCurrentWindow().setSize(new LogicalSize(width, height));
    });
  }, [displayMode, editorOpen]);

  useEffect(() => {
    if (heroStrategy && heroStrategy.id !== heroStrategyId) setHeroStrategyId(heroStrategy.id);
  }, [heroStrategy?.id, heroStrategyId, setHeroStrategyId]);
  useEffect(() => {
    if (positionStrategy && positionStrategy.id !== positionStrategyId) setPositionStrategyId(positionStrategy.id);
  }, [positionStrategy?.id, positionStrategyId, setPositionStrategyId]);

  const roleEvents = useMemo<TimelineEvent[]>(() => [
    ...(heroStrategy?.timeline ?? []).map((point) => ({ id: `hero:${point.id}`, role, seconds: point.seconds, title: point.title, detail: "英雄策略", warningSeconds: point.warningSeconds ?? 15 })),
    ...(positionStrategy?.timeline ?? []).map((point) => ({ id: `position:${point.id}`, role, seconds: point.seconds, title: point.title, detail: "位置策略", warningSeconds: point.warningSeconds ?? 15 }))
  ].sort((a, b) => a.seconds - b.seconds), [heroStrategy, positionStrategy, role]);
  const nextEvent = roleEvents.find((event) => event.seconds >= elapsed - 2);

  const applyHero = (entry: HeroCatalogEntry) => {
    setHeroId(entry.id);
    setHeroStrategyId(heroStrategies.find((strategy) => strategy.heroId === entry.id)?.id ?? "");
  };
  const applyRole = (next: Role) => {
    setRole(next);
    setPositionStrategyId(positionStrategies.find((strategy) => strategy.role === next)?.id ?? "");
  };

  const calibrate = (seconds: number) => {
    anchorRef.current = { at: performance.now(), elapsed: seconds };
    setElapsed(seconds);
    setRunning(true);
    setFired([]);
    setShowSetup(false);
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setElapsed(anchorRef.current.elapsed + (performance.now() - anchorRef.current.at) / 1000);
    }, 250);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    const due = roleEvents.find((event) => {
      const remaining = event.seconds - elapsed;
      return remaining <= event.warningSeconds && remaining > event.warningSeconds - 1 && !fired.includes(event.id);
    });
    if (!due) return;
    setFired((old) => [...old, due.id]);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`还有 ${due.warningSeconds} 秒：${due.title}`, { body: due.detail });
    }
  }, [elapsed, fired, roleEvents]);

  const togglePause = () => {
    if (running) {
      setRunning(false);
    } else {
      anchorRef.current = { at: performance.now(), elapsed };
      setRunning(true);
    }
  };

  const setPassThrough = useCallback(async (enabled: boolean) => {
    clickThroughRef.current = enabled;
    setClickThrough(enabled);
    if (isTauri()) {
      const { getCurrentWindow, PhysicalPosition } = await import("@tauri-apps/api/window");
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const main = getCurrentWindow();
      const unlock = await WebviewWindow.getByLabel("unlock");
      if (enabled && unlock) {
        const [position, size] = await Promise.all([main.outerPosition(), main.outerSize()]);
        await unlock.setPosition(new PhysicalPosition(position.x + size.width - 54, position.y + 8));
        await unlock.show();
        await unlock.setFocus();
      }
      await main.setIgnoreCursorEvents(enabled);
      if (!enabled && unlock) await unlock.hide();
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cleanupShortcut: (() => Promise<void>) | undefined;
    let cleanupEvent: (() => void) | undefined;
    (async () => {
      const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
      await register("F8", (event) => {
        if (event.state === "Pressed" && !shortcutPressedRef.current) {
          shortcutPressedRef.current = true;
          void setPassThrough(!clickThroughRef.current);
        } else if (event.state === "Released") {
          shortcutPressedRef.current = false;
        }
      });
      cleanupShortcut = () => unregister("F8");
      const { listen } = await import("@tauri-apps/api/event");
      cleanupEvent = await listen<boolean>("click-through-changed", (event) => {
        clickThroughRef.current = event.payload;
        setClickThrough(event.payload);
      });
    })();
    return () => { void cleanupShortcut?.(); cleanupEvent?.(); };
  }, [setPassThrough]);

  const visibleEvents = roleEvents
    .filter((event) => event.seconds >= elapsed - 30)
    .slice(0, displayMode === "normal" ? 4 : displayMode === "compact" ? 2 : 3);

  const startWindowDrag = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, select, input, label")) return;
    if (isTauri()) {
      // Windows requires the native drag request to be dispatched while the
      // mouse-down gesture is still active. A dynamic import here can finish
      // after the user has already moved or released the pointer.
      void getCurrentWindow().startDragging();
    }
  };

  return (
    <main className={`shell ${displayMode}`}>
      <header className="titlebar">
        <div className="minimal-drag-handle" title="拖动面板" onMouseDown={startWindowDrag}><Grip size={14} /></div>
        <div className="brand" onMouseDown={startWindowDrag}><span className="brand-mark">界</span><b>SEKAI</b><em>DOTA HELPER</em></div>
        <div className="drag-hint" onMouseDown={startWindowDrag}><Grip size={14} /> 拖动面板</div>
        <div className="window-actions">
          <label className="mode-select" title="显示模式">
            <select value={displayMode} onChange={(event) => setDisplayMode(event.target.value as DisplayMode)}>
              <option value="normal">普通</option>
              <option value="compact">紧凑</option>
              <option value="minimal">极简</option>
            </select>
            <ChevronDown size={11} />
          </label>
          <button className="edit-strategies" title="编辑英雄与位置策略" onClick={() => setEditorOpen(true)}><PencilLine size={15} /></button>
          <button title={clickThrough ? "已穿透，按 F8 解锁" : "鼠标穿透（F8 恢复）"} onClick={() => setPassThrough(!clickThrough)}>
            {clickThrough ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button title="关闭" onClick={async () => { if (isTauri()) { const { getCurrentWindow } = await import("@tauri-apps/api/window"); await getCurrentWindow().close(); } }}><X size={16} /></button>
        </div>
      </header>

      {displayMode === "minimal" ? <section className="minimal-selection-summary" aria-label="当前英雄与策略">
        <span title={hero.name}>{hero.name}</span>
        <span title={heroStrategy?.title ?? "暂无英雄策略"}>{heroStrategy?.title ?? "暂无"}</span>
        <span title={roleNames[role]}>{roleNames[role].split(" · ")[0]}</span>
        <span title={positionStrategy?.title ?? "暂无位置策略"}>{positionStrategy?.title ?? "暂无"}</span>
      </section> : <section className="matchbar">
        <label className="hero-field"><span>英雄</span><HeroPicker selectedId={hero.id} onSelect={applyHero} /></label>
        <label><span>英雄策略</span><select value={heroStrategy?.id ?? ""} disabled={!heroOptions.length} onChange={(event) => setHeroStrategyId(event.target.value)}>{heroOptions.length ? heroOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>) : <option value="">暂无策略</option>}</select><ChevronDown size={14} /></label>
        <label><span>位置</span><select value={role} onChange={(event) => applyRole(event.target.value as Role)}>{Object.entries(roleNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><ChevronDown size={14} /></label>
        <label><span>位置策略</span><select value={positionStrategy?.id ?? ""} disabled={!positionOptions.length} onChange={(event) => setPositionStrategyId(event.target.value)}>{positionOptions.length ? positionOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>) : <option value="">暂无策略</option>}</select><ChevronDown size={14} /></label>
      </section>}

      <section className="hero-card">
        <img src={hero.image} alt={hero.name} />
        <div><span className="eyebrow">组合策略</span><h1>{hero.name} · {roleNames[role]}</h1>
          {heroStrategy ? <p><b>{heroStrategy.title}</b> — {heroStrategy.summary || "未填写概括"}</p> : <p className="missing">该英雄暂无策略，请打开编辑器新增。</p>}
          {positionStrategy ? <p><b>{positionStrategy.title}</b> — {positionStrategy.summary || "未填写概括"}</p> : <p className="missing">该位置暂无策略，请打开编辑器新增。</p>}
        </div>
      </section>

      {displayMode !== "compact" && heroStrategy && <section className="content-grid single">
        <article className="panel build"><div className="panel-title">英雄出装思路</div>
          {heroStrategy.itemKeys.length ? <div className="item-path">{heroStrategy.itemKeys.map((key, index) => { const item = itemCatalog.find((entry) => entry.key === key); return item && <div className="item-step" key={`${key}-${index}`}>
            <div className="item-icon"><img src={item.image} alt={item.name} /><span>{index + 1}</span></div><div><b>{item.name}</b></div>
          </div>; })}</div> : <div className="empty-inline">该英雄策略没有出装内容</div>}
        </article>
      </section>}

      <section className="timer-panel">
        <div className="clock"><span>游戏时间</span><strong>{formatTime(elapsed)}</strong><div className={running ? "live" : "paused"}>{running ? "● 已同步" : "Ⅱ 已暂停"}</div></div>
        <div className="timer-actions">
          <button className="primary" onClick={() => setShowSetup(!showSetup)}><RotateCcw size={15} /> 校准</button>
          <button onClick={togglePause}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? "暂停" : "继续"}</button>
        </div>
        {showSetup && <Calibration onCalibrate={calibrate} />}
        {(!showSetup || displayMode === "minimal") && nextEvent && <div className={`next-up ${nextEvent.seconds - elapsed <= nextEvent.warningSeconds ? "alert" : ""}`}><Bell size={16} /><span>下一项</span><b>{nextEvent.title}</b><strong>{formatTime(nextEvent.seconds - elapsed)}</strong></div>}
      </section>

      <section className="timeline">
        {visibleEvents.length ? visibleEvents.map((event) => <EventRow key={event.id} event={event} elapsed={elapsed} />) : <div className="empty-timeline">当前两份策略都没有时间点</div>}
      </section>
      <footer>F8 切换鼠标穿透 · 建议 Dota 2 使用无边框窗口模式</footer>
      {createPortal(<StrategyEditor
        open={editorOpen}
        hero={hero}
        role={role}
        heroStrategies={heroStrategies}
        positionStrategies={positionStrategies}
        onHeroStrategiesChange={setHeroStrategies}
        onPositionStrategiesChange={setPositionStrategies}
        onClose={() => setEditorOpen(false)}
      />, document.body)}
    </main>
  );
}

function UnlockController() {
  const unlock = async () => {
    const [{ getCurrentWindow }, { WebviewWindow }, { emit }] = await Promise.all([
      import("@tauri-apps/api/window"),
      import("@tauri-apps/api/webviewWindow"),
      import("@tauri-apps/api/event")
    ]);
    const main = await WebviewWindow.getByLabel("main");
    if (main) await main.setIgnoreCursorEvents(false);
    await emit("click-through-changed", false);
    await getCurrentWindow().hide();
  };
  return <button className="unlock-controller" title="恢复面板点击（F8）" onClick={unlock}><EyeOff size={20} /></button>;
}

function Calibration({ onCalibrate }: { onCalibrate: (seconds: number) => void }) {
  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");
  return <div className="calibration"><span>看到游戏计时器后输入当前时间</span><div>
    <input aria-label="分钟" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} /><i>:</i>
    <input aria-label="秒" value={seconds} onChange={(e) => setSeconds(e.target.value.replace(/\D/g, "").slice(0, 2))} />
    <button className="confirm" onClick={() => onCalibrate(Number(minutes) * 60 + Number(seconds))}>开始同步</button>
  </div><small>也可以在号角响起时直接点“从 0:00 开始”</small><button className="zero" onClick={() => onCalibrate(0)}>从 0:00 开始</button></div>;
}

function EventRow({ event, elapsed }: { event: TimelineEvent; elapsed: number }) {
  const remaining = event.seconds - elapsed;
  const state = remaining < -2 ? "done" : remaining <= event.warningSeconds ? "soon" : "later";
  return <div className={`event ${state}`}><time>{formatTime(event.seconds)}</time><span className="event-dot" /><div><b>{event.title}</b><small>{event.detail}</small></div><strong>{state === "done" ? "已过" : formatTime(remaining)}</strong></div>;
}

const attributeNames: Record<HeroAttribute, string> = { str: "力量", agi: "敏捷", int: "智力", all: "全才" };
const attributeOrder: HeroAttribute[] = ["str", "agi", "int", "all"];

function HeroPicker({ selectedId, onSelect }: { selectedId: number; onSelect: (hero: HeroCatalogEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = heroCatalog.find((hero) => hero.id === selectedId) ?? heroCatalog[0];
  const needle = query.trim().toLocaleLowerCase().replace(/[\s·_-]/g, "");
  const filtered = heroCatalog.filter((hero) => {
    if (!needle) return true;
    return [hero.name, hero.englishName, hero.key, ...hero.aliases]
      .some((value) => value.toLocaleLowerCase().replace(/[\s·_-]/g, "").includes(needle));
  });

  return <>
    <button type="button" className="hero-picker-trigger" onClick={() => setOpen(true)}>
      <img src={selected.image} alt="" /><b>{selected.name}</b><ChevronDown size={12} />
    </button>
    {open && <div className="picker-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="hero-picker-popover" onMouseDown={(event) => event.stopPropagation()}>
        <div className="picker-head">
          <div className="hero-search"><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英雄、英文名或别称（如：兔子、炸弹人）" /></div>
          <span>{filtered.length} / {heroCatalog.length}</span>
          <button onClick={() => setOpen(false)}><X size={15} /></button>
        </div>
        <div className="hero-groups">
          {attributeOrder.map((attribute) => {
            const entries = filtered.filter((hero) => hero.attribute === attribute);
            if (!entries.length) return null;
            return <section className={`hero-group ${attribute}`} key={attribute}>
              <h3><i />{attributeNames[attribute]}<small>{entries.length}</small></h3>
              <div className="hero-grid">{entries.map((entry) => <button className={entry.id === selectedId ? "selected" : ""} key={entry.id} onClick={() => { onSelect(entry); setOpen(false); setQuery(""); }}>
                <img loading="lazy" src={entry.image} alt="" /><span><b>{entry.name}</b><small>{entry.aliases.slice(0, 2).join(" · ") || entry.englishName}</small></span>
              </button>)}</div>
            </section>;
          })}
          {!filtered.length && <div className="no-results">没有匹配英雄，可在别名表中继续补充。</div>}
        </div>
      </div>
    </div>}
  </>;
}
