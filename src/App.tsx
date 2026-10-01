import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ChevronDown, Eye, EyeOff, Grip, Pause, PencilLine, Play, RotateCcw, Search, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { defaultGlobalTimeline, defaultHeroStrategies, defaultPositionStrategies, heroCatalog, itemCatalog, roleNames } from "./data";
import type { HeroCatalogEntry, HeroAttribute, HeroStrategyV2, PositionStrategy, Role, StrategyTimePoint, TimelineEvent, TimelineEventSource } from "./types";
import StrategyEditor from "./StrategyEditor";

const isTauri = () => "__TAURI_INTERNALS__" in window;
type DisplayMode = "normal" | "compact" | "minimal";
type MinimalWidgetKind = "controls" | "build" | "timer" | "timeline";
const minimalWidgetLabels = ["minimal-controls", "minimal-build", "minimal-timer", "minimal-timeline"] as const;
const minimalWidgetOptions: Record<(typeof minimalWidgetLabels)[number], { kind: MinimalWidgetKind; title: string; width: number; height: number }> = {
  "minimal-controls": { kind: "controls", title: "Sekai 极简控制", width: 244, height: 58 },
  "minimal-build": { kind: "build", title: "Sekai 极简出装", width: 220, height: 42 },
  "minimal-timer": { kind: "timer", title: "Sekai 极简倒计时", width: 220, height: 48 },
  "minimal-timeline": { kind: "timeline", title: "Sekai 极简时间轴", width: 220, height: 132 }
};
const sourceLabels: Record<TimelineEventSource, string> = { global: "通用", hero: "英雄", position: "位置" };

interface MinimalSnapshot {
  heroName: string;
  heroStrategyTitle: string;
  roleName: string;
  positionStrategyTitle: string;
  itemKeys: string[];
  elapsed: number;
  running: boolean;
  nextEvent: TimelineEvent | null;
  visibleEvents: TimelineEvent[];
}

const migratePositionStrategies = (): PositionStrategy[] => {
  try {
    const legacy = localStorage.getItem("position-strategies-v2");
    if (!legacy) return defaultPositionStrategies;
    const globalIds = new Set(defaultGlobalTimeline.map((point) => point.id));
    return (JSON.parse(legacy) as PositionStrategy[]).map((strategy) => ({
      ...strategy,
      timeline: strategy.timeline.filter((point) => !globalIds.has(point.id))
    }));
  } catch {
    return defaultPositionStrategies;
  }
};

const mergeTimelineEvents = (events: TimelineEvent[]): TimelineEvent[] => {
  const groups = new Map<number, TimelineEvent[]>();
  for (const event of events) groups.set(event.seconds, [...(groups.get(event.seconds) ?? []), event]);
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([seconds, entries]) => {
    const titles = [...new Set(entries.map((entry) => entry.title))];
    const sources = [...new Set(entries.flatMap((entry) => entry.sources))] as TimelineEventSource[];
    return {
      id: entries.map((entry) => entry.id).sort().join("+"),
      role: entries[0].role,
      seconds,
      title: titles.join(" · "),
      detail: sources.map((source) => sourceLabels[source]).join(" · "),
      warningSeconds: Math.max(...entries.map((entry) => entry.warningSeconds)),
      sources
    };
  });
};

const expandTimePoints = (points: StrategyTimePoint[]): StrategyTimePoint[] => points.flatMap((point) => {
  const interval = point.repeatIntervalSeconds ?? 0;
  if (interval <= 0) return [point];
  const occurrences: StrategyTimePoint[] = [];
  const repeatUntil = Math.min(point.repeatUntilSeconds ?? 24 * 60 * 60, 24 * 60 * 60);
  for (let index = 0; index < 256; index += 1) {
    const seconds = point.seconds + index * interval;
    if (seconds > repeatUntil) break;
    occurrences.push({ ...point, id: `${point.id}:repeat-${index}`, seconds });
  }
  return occurrences;
});
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
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "unlock") return <UnlockController />;
  if (params.get("mode") === "minimal-widget") {
    return <MinimalWidget kind={(params.get("widget") ?? "controls") as MinimalWidgetKind} />;
  }
  return <MainOverlay />;
}

function MainOverlay() {
  const [heroId, setHeroId] = usePersisted("hero", heroCatalog[0].id);
  const hero = heroCatalog.find((entry) => entry.id === heroId) ?? heroCatalog[0];
  const [heroStrategies, setHeroStrategies] = usePersisted<HeroStrategyV2[]>("hero-strategies-v2", defaultHeroStrategies);
  const [positionStrategies, setPositionStrategies] = usePersisted<PositionStrategy[]>("position-strategies-v3", migratePositionStrategies());
  const [globalTimeline, setGlobalTimeline] = usePersisted<StrategyTimePoint[]>("global-timeline-v1", defaultGlobalTimeline);
  const heroOptions = heroStrategies.filter((entry) => entry.heroId === hero.id);
  const [heroStrategyId, setHeroStrategyId] = usePersisted("hero-strategy-selection", heroOptions[0]?.id ?? "");
  const heroStrategy = heroOptions.find((entry) => entry.id === heroStrategyId) ?? heroOptions[0] ?? null;
  const [role, setRole] = usePersisted<Role>("role", "5");
  const positionOptions = positionStrategies.filter((entry) => entry.role === role);
  const [positionStrategyId, setPositionStrategyId] = usePersisted("position-strategy-selection", positionOptions[0]?.id ?? "");
  const positionStrategy = positionOptions.find((entry) => entry.id === positionStrategyId) ?? positionOptions[0] ?? null;
  const [displayMode, setDisplayMode] = usePersisted<DisplayMode>("display-mode", "normal");
  const displayModeRef = useRef<DisplayMode>(displayMode);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clickThrough, setClickThrough] = useState(false);
  const clickThroughRef = useRef(false);
  const shortcutPressedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [fired, setFired] = useState<string[]>([]);
  const anchorRef = useRef({ at: performance.now(), elapsed: 0 });
  const minimalSnapshotRef = useRef<MinimalSnapshot | null>(null);

  useEffect(() => { displayModeRef.current = displayMode; }, [displayMode]);

  useEffect(() => {
    if (!isTauri()) return;
    if (displayMode === "minimal") return;
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

  const arrangeMinimalWidgets = useCallback(async (reset: boolean) => {
    if (!isTauri()) return;
    const { getCurrentWindow, PhysicalPosition } = await import("@tauri-apps/api/window");
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const origin = await getCurrentWindow().outerPosition();
    const defaults: Record<(typeof minimalWidgetLabels)[number], [number, number]> = {
      "minimal-controls": [origin.x, origin.y],
      "minimal-build": [origin.x, origin.y + 62],
      "minimal-timer": [origin.x, origin.y + 108],
      "minimal-timeline": [origin.x, origin.y + 160]
    };
    await Promise.all(minimalWidgetLabels.map(async (label) => {
      let widget = await WebviewWindow.getByLabel(label);
      if (!widget) {
        const options = minimalWidgetOptions[label];
        widget = new WebviewWindow(label, {
          url: `index.html?mode=minimal-widget&widget=${options.kind}`,
          title: options.title,
          width: options.width,
          height: options.height,
          resizable: false,
          visible: false,
          transparent: true,
          decorations: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          shadow: false
        });
        await new Promise<void>((resolve, reject) => {
          void widget!.once("tauri://created", () => resolve());
          void widget!.once("tauri://error", (event) => reject(event.payload));
        });
      }
      const storageKey = `minimal-position:${label}`;
      let position = defaults[label];
      if (!reset) {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) position = JSON.parse(saved) as [number, number];
        } catch { /* Fall back to the unified layout. */ }
      }
      localStorage.setItem(storageKey, JSON.stringify(position));
      await widget.setPosition(new PhysicalPosition(position[0], position[1]));
      await widget.show();
    }));
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const main = getCurrentWindow();
      if (displayMode === "minimal") {
        await arrangeMinimalWidgets(false);
        await main.hide();
      } else {
        await Promise.all(minimalWidgetLabels.map(async (label) => {
          const widget = await WebviewWindow.getByLabel(label);
          if (widget) await widget.close();
        }));
        await main.show();
      }
    })();
  }, [arrangeMinimalWidgets, displayMode]);

  useEffect(() => {
    if (heroStrategy && heroStrategy.id !== heroStrategyId) setHeroStrategyId(heroStrategy.id);
  }, [heroStrategy?.id, heroStrategyId, setHeroStrategyId]);
  useEffect(() => {
    if (positionStrategy && positionStrategy.id !== positionStrategyId) setPositionStrategyId(positionStrategy.id);
  }, [positionStrategy?.id, positionStrategyId, setPositionStrategyId]);

  const roleEvents = useMemo<TimelineEvent[]>(() => mergeTimelineEvents([
    ...expandTimePoints(globalTimeline).map((point) => ({ id: `global:${point.id}`, role: "all" as const, seconds: point.seconds, title: point.title, detail: "通用时间轴", warningSeconds: point.warningSeconds ?? 15, sources: ["global" as const] })),
    ...(heroStrategy?.timeline ?? []).map((point) => ({ id: `hero:${point.id}`, role, seconds: point.seconds, title: point.title, detail: "英雄策略", warningSeconds: point.warningSeconds ?? 15, sources: ["hero" as const] })),
    ...(positionStrategy?.timeline ?? []).map((point) => ({ id: `position:${point.id}`, role, seconds: point.seconds, title: point.title, detail: "位置策略", warningSeconds: point.warningSeconds ?? 15, sources: ["position" as const] }))
  ]), [globalTimeline, heroStrategy, positionStrategy, role]);
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
      if (enabled && unlock && displayModeRef.current !== "minimal") {
        const [position, size] = await Promise.all([main.outerPosition(), main.outerSize()]);
        await unlock.setPosition(new PhysicalPosition(position.x + size.width - 54, position.y + 8));
        await unlock.show();
        await unlock.setFocus();
      } else if (unlock) {
        await unlock.hide();
      }
      await main.setIgnoreCursorEvents(enabled);
      await Promise.all(minimalWidgetLabels.map(async (label) => {
        const widget = await WebviewWindow.getByLabel(label);
        if (widget) await widget.setIgnoreCursorEvents(enabled);
      }));
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cleanupShortcut: (() => Promise<void>) | undefined;
    let cleanupEvent: (() => void) | undefined;
    let cleanupMode: (() => void) | undefined;
    let cleanupReset: (() => void) | undefined;
    let cleanupReady: (() => void) | undefined;
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
      const { emit, listen } = await import("@tauri-apps/api/event");
      cleanupEvent = await listen<boolean>("click-through-changed", (event) => {
        clickThroughRef.current = event.payload;
        setClickThrough(event.payload);
      });
      cleanupMode = await listen<DisplayMode>("minimal-mode-change", (event) => setDisplayMode(event.payload));
      cleanupReset = await listen("minimal-reset", () => void arrangeMinimalWidgets(true));
      cleanupReady = await listen("minimal-widget-ready", () => {
        if (minimalSnapshotRef.current) void emit("minimal-state", minimalSnapshotRef.current);
      });
    })();
    return () => { void cleanupShortcut?.(); cleanupEvent?.(); cleanupMode?.(); cleanupReset?.(); cleanupReady?.(); };
  }, [arrangeMinimalWidgets, setDisplayMode, setPassThrough]);

  const visibleEvents = roleEvents
    .filter((event) => event.seconds >= elapsed - 30)
    .slice(0, displayMode === "normal" ? 4 : displayMode === "compact" ? 2 : 3);
  const elapsedSecond = Math.floor(elapsed);

  const minimalSnapshot: MinimalSnapshot = {
    heroName: hero.name,
    heroStrategyTitle: heroStrategy?.title ?? "暂无",
    roleName: roleNames[role].split(" · ")[0],
    positionStrategyTitle: positionStrategy?.title ?? "暂无",
    itemKeys: heroStrategy?.itemKeys ?? [],
    elapsed,
    running,
    nextEvent: nextEvent ?? null,
    visibleEvents: roleEvents.filter((event) => event.seconds >= elapsed).slice(0, 3)
  };
  minimalSnapshotRef.current = minimalSnapshot;

  useEffect(() => {
    if (!isTauri() || displayMode !== "minimal") return;
    void import("@tauri-apps/api/event").then(({ emit }) => {
      if (minimalSnapshotRef.current) return emit("minimal-state", minimalSnapshotRef.current);
    });
  }, [displayMode, elapsedSecond, hero.name, heroStrategy, nextEvent, positionStrategy, role, roleEvents, running]);

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
          <button className="click-through-toggle" title={clickThrough ? "已穿透，按 F8 解锁" : "鼠标穿透（F8 恢复）"} onClick={() => setPassThrough(!clickThrough)}>
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
        {visibleEvents.length ? visibleEvents.map((event) => <EventRow key={event.id} event={event} elapsed={elapsed} />) : <div className="empty-timeline">当前三份时间轴都没有时间点</div>}
      </section>
      <footer>F8 切换鼠标穿透 · 建议 Dota 2 使用无边框窗口模式</footer>
      {createPortal(<StrategyEditor
        open={editorOpen}
        hero={hero}
        role={role}
        heroStrategies={heroStrategies}
        positionStrategies={positionStrategies}
        globalTimeline={globalTimeline}
        onHeroStrategiesChange={setHeroStrategies}
        onPositionStrategiesChange={setPositionStrategies}
        onGlobalTimelineChange={setGlobalTimeline}
        onClose={() => setEditorOpen(false)}
      />, document.body)}
    </main>
  );
}

function MinimalWidget({ kind }: { kind: MinimalWidgetKind }) {
  const [snapshot, setSnapshot] = useState<MinimalSnapshot | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cleanupState: (() => void) | undefined;
    let cleanupMoved: (() => void) | undefined;
    let readyRetry: number | undefined;
    void (async () => {
      const { emit, listen } = await import("@tauri-apps/api/event");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const current = getCurrentWindow();
      cleanupState = await listen<MinimalSnapshot>("minimal-state", (event) => setSnapshot((current) => {
        if (current && (kind === "controls" || kind === "build")) return current;
        return event.payload;
      }));
      cleanupMoved = await current.onMoved(({ payload }) => {
        localStorage.setItem(`minimal-position:${current.label}`, JSON.stringify([payload.x, payload.y]));
      });
      await emit("minimal-widget-ready");
      readyRetry = window.setTimeout(() => void emit("minimal-widget-ready"), 300);
    })();
    return () => { cleanupState?.(); cleanupMoved?.(); if (readyRetry) window.clearTimeout(readyRetry); };
  }, []);

  const drag = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, select")) return;
    void getCurrentWindow().startDragging();
  };
  const changeMode = async (mode: DisplayMode) => {
    const { emit } = await import("@tauri-apps/api/event");
    await emit("minimal-mode-change", mode);
  };
  const closeApp = async () => {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const main = await WebviewWindow.getByLabel("main");
    if (main) await main.close();
  };

  if (kind === "controls") return <main className="minimal minimal-widget-root widget-controls">
    <div className="widget-control-row">
      <span className="widget-drag" title="拖动控制条" onMouseDown={drag}><Grip size={13} /></span>
      <select aria-label="退出极简模式" value="minimal" onChange={(event) => void changeMode(event.target.value as DisplayMode)}>
        <option value="normal">普通</option><option value="compact">紧凑</option><option value="minimal">极简</option>
      </select>
      <button title="恢复统一布局" onClick={async () => { const { emit } = await import("@tauri-apps/api/event"); await emit("minimal-reset"); }}><RotateCcw size={12} /></button>
      <button title="关闭" onClick={closeApp}><X size={12} /></button>
    </div>
    <section className="minimal-selection-summary" aria-label="当前英雄与策略" onMouseDown={drag}>
      <span title={snapshot?.heroName}>{snapshot?.heroName ?? "英雄"}</span>
      <span title={snapshot?.heroStrategyTitle}>{snapshot?.heroStrategyTitle ?? "策略"}</span>
      <span title={snapshot?.roleName}>{snapshot?.roleName ?? "位置"}</span>
      <span title={snapshot?.positionStrategyTitle}>{snapshot?.positionStrategyTitle ?? "策略"}</span>
    </section>
  </main>;

  if (kind === "build") return <main className="minimal minimal-widget-root widget-build" onMouseDown={drag}>
    <section className="content-grid single"><article className="panel build">
      {snapshot?.itemKeys.length ? <div className="item-path">{snapshot.itemKeys.map((key, index) => { const item = itemCatalog.find((entry) => entry.key === key); return item && <div className="item-step" key={`${key}-${index}`}><div className="item-icon"><img src={item.image} alt={item.name} /><span>{index + 1}</span></div></div>; })}</div> : <div className="widget-empty">暂无出装</div>}
    </article></section>
  </main>;

  if (kind === "timer") {
    const next = snapshot?.nextEvent;
    const alert = next && next.seconds - (snapshot?.elapsed ?? 0) <= next.warningSeconds;
    return <main className="minimal minimal-widget-root widget-timer" onMouseDown={drag}><section className="timer-panel">
      <div className="clock"><strong>{formatTime(snapshot?.elapsed ?? 0)}</strong></div>
      {next && <div className={`next-up ${alert ? "alert" : ""}`}><Bell size={16} /><b>{next.title}</b><strong>{formatTime(next.seconds - (snapshot?.elapsed ?? 0))}</strong></div>}
    </section></main>;
  }

  return <main className="minimal minimal-widget-root widget-timeline" onMouseDown={drag}><section className="timeline">
    {snapshot?.visibleEvents.length ? snapshot.visibleEvents.map((event) => <EventRow key={event.id} event={event} elapsed={snapshot.elapsed} />) : <div className="widget-empty">暂无未来时间点</div>}
  </section></main>;
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
  return <div className={`event ${state}`}><time>{formatTime(event.seconds)}</time><span className="event-dot" /><div><b>{event.title}</b><small className="event-sources">{event.sources.map((source) => <i className={`source-${source}`} key={source}>{sourceLabels[source]}</i>)}</small></div><strong>{state === "done" ? "已过" : formatTime(remaining)}</strong></div>;
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
