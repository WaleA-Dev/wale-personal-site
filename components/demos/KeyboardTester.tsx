"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const KEY_CODE_MAP: Record<string, string> = {
  Escape: "Esc", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4", Digit5: "5",
  Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0", Minus: "-",
  Equal: "=", Backspace: "Bksp", Tab: "Tab", KeyQ: "Q", KeyW: "W", KeyE: "E",
  KeyR: "R", KeyT: "T", KeyY: "Y", KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P",
  BracketLeft: "[", BracketRight: "]", Backslash: "\\", CapsLock: "Caps",
  KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G", KeyH: "H", KeyJ: "J",
  KeyK: "K", KeyL: "L", Semicolon: ";", Quote: "'", Enter: "Enter",
  ShiftLeft: "LShift", ShiftRight: "RShift", KeyZ: "Z", KeyX: "X", KeyC: "C",
  KeyV: "V", KeyB: "B", KeyN: "N", KeyM: "M", Comma: ",", Period: ".",
  Slash: "/", ArrowUp: "↑", Delete: "Del", ControlLeft: "LCtrl", ControlRight: "RCtrl",
  MetaLeft: "Win", MetaRight: "Win", AltLeft: "LAlt", AltRight: "RAlt", Space: "Space",
  ArrowLeft: "←", ArrowDown: "↓", ArrowRight: "→",
};

const MICRO_RELEASE_MS = 20;

interface KeyEvent {
  key: string;
  code: string;
  type: "DOWN" | "UP";
  repeat: boolean;
  interval: string;
  hz: string;
  elapsed: string;
  extra: string;
}

interface InternalStats {
  keydownIntervals: number[];
  allIntervals: number[];
  lastKeydownTime: number | null;
  lastEventTime: number | null;
  totalEvents: number;
  totalKeydowns: number;
  totalKeyups: number;
  nkroMax: number;
  heldKeys: Set<string>;
  testedKeys: Set<string>;
  ghostEvents: number;
  microReleases: number;
  holdDurations: number[];
  keyDownTimes: Record<string, number>;
}

interface DisplayStats {
  avgRate: number;
  peakRate: number;
  minInterval: number;
  maxInterval: number;
  jitter: number;
  totalEvents: number;
  totalKeydowns: number;
  totalKeyups: number;
  nkroMax: number;
  currentHeld: number;
  testedCount: number;
  ghostEvents: number;
  microReleases: number;
  avgHold: number;
  minHold: number;
  switchScore: number;
  keydownIntervals: number[];
}

function createFreshStats(): InternalStats {
  return {
    keydownIntervals: [],
    allIntervals: [],
    lastKeydownTime: null,
    lastEventTime: null,
    totalEvents: 0,
    totalKeydowns: 0,
    totalKeyups: 0,
    nkroMax: 0,
    heldKeys: new Set(),
    testedKeys: new Set(),
    ghostEvents: 0,
    microReleases: 0,
    holdDurations: [],
    keyDownTimes: {},
  };
}

export default function KeyboardTester() {
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const [tab, setTab] = useState("diagnostics");
  const [isRecording, setIsRecording] = useState(true);

  const eventsRef = useRef<KeyEvent[]>([]);
  const startRef = useRef(performance.now());
  const statsRef = useRef<InternalStats>(createFreshStats());

  const getStats = useCallback((): DisplayStats => {
    const s = statsRef.current;

    // Use keydown-only intervals for rate metrics (excludes auto-repeat and keyup events)
    const kdIntervals = s.keydownIntervals;
    const rates = kdIntervals.filter(i => i > 0).map(i => 1000 / i);
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const peakRate = rates.length > 0 ? Math.max(...rates) : 0;
    const minInterval = kdIntervals.length > 0 ? Math.min(...kdIntervals) : Infinity;
    const maxInterval = kdIntervals.length > 0 ? Math.max(...kdIntervals) : 0;
    const mean = kdIntervals.length > 0 ? kdIntervals.reduce((a, b) => a + b, 0) / kdIntervals.length : 0;
    const variance = kdIntervals.length > 0 ? kdIntervals.reduce((a, b) => a + (b - mean) ** 2, 0) / kdIntervals.length : 0;
    const jitter = Math.sqrt(variance);

    const holds = s.holdDurations;
    const avgHold = holds.length > 0 ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;
    const minHold = holds.length > 0 ? Math.min(...holds) : Infinity;

    // --- Principled switch-type scoring ---
    // Scores how likely the keyboard uses magnetic/Hall effect switches vs mechanical.
    // Based on physical constraints: mechanical switches require ~2mm travel + debounce,
    // magnetic switches can actuate at 0.1mm with no debounce.
    let score = 0;

    // Factor 1 (0-30): Minimum hold time
    // Mechanical min hold is typically >30ms; magnetic rapid trigger can produce <10ms
    if (minHold < 5) score += 30;
    else if (minHold < 10) score += 22;
    else if (minHold < 20) score += 12;
    else if (minHold < 30) score += 5;

    // Factor 2 (0-25): Proportion of micro-releases (<20ms holds)
    const microRatio = s.totalKeyups > 0 ? s.microReleases / s.totalKeyups : 0;
    if (microRatio > 0.4) score += 25;
    else if (microRatio > 0.25) score += 18;
    else if (microRatio > 0.1) score += 10;
    else if (microRatio > 0.03) score += 4;

    // Factor 3 (0-25): Minimum keydown-to-keydown interval
    // Rapid trigger allows re-actuation without full key release
    if (minInterval < 3) score += 25;
    else if (minInterval < 8) score += 18;
    else if (minInterval < 15) score += 10;
    else if (minInterval < 25) score += 4;

    // Factor 4 (0-20): Consistency of short hold durations
    // Analog sensing produces uniform short holds; mechanical bounce is noisier
    const shortHolds = holds.filter(h => h < 50);
    if (shortHolds.length >= 5) {
      const holdMean = shortHolds.reduce((a, b) => a + b, 0) / shortHolds.length;
      const holdVar = shortHolds.reduce((a, b) => a + (b - holdMean) ** 2, 0) / shortHolds.length;
      const holdStdDev = Math.sqrt(holdVar);
      if (holdStdDev < 3 && holdMean < 20) score += 20;
      else if (holdStdDev < 8 && holdMean < 30) score += 12;
      else if (holdStdDev < 15 && holdMean < 50) score += 5;
    }

    // Data sufficiency cap — prevent confident verdicts with insufficient data
    if (s.totalEvents < 15) score = Math.min(score, 10);
    else if (s.totalEvents < 30) score = Math.min(score, 30);
    else if (s.totalEvents < 60) score = Math.min(score, 60);

    score = Math.min(100, Math.max(0, score));

    return {
      avgRate, peakRate, minInterval, maxInterval, jitter,
      totalEvents: s.totalEvents, totalKeydowns: s.totalKeydowns,
      totalKeyups: s.totalKeyups, nkroMax: s.nkroMax,
      currentHeld: s.heldKeys.size, testedCount: s.testedKeys.size,
      ghostEvents: s.ghostEvents, microReleases: s.microReleases,
      avgHold, minHold, switchScore: score,
      keydownIntervals: [...s.keydownIntervals.slice(-100)],
    };
  }, []);

  const [displayStats, setDisplayStats] = useState<DisplayStats>(getStats);

  const addEvent = useCallback((evt: KeyEvent) => {
    eventsRef.current = [...eventsRef.current.slice(-500), evt];
    setEvents([...eventsRef.current]);
    setDisplayStats(getStats());
  }, [getStats]);

  useEffect(() => {
    if (!isRecording) return;
    const s = statsRef.current;

    const handleDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const now = performance.now();
      const key = KEY_CODE_MAP[e.code] || e.key;

      const allInterval = s.lastEventTime !== null ? (now - s.lastEventTime) : null;
      s.lastEventTime = now;
      s.totalEvents++;

      if (allInterval !== null && allInterval > 0) {
        s.allIntervals = [...s.allIntervals.slice(-499), allInterval];
      }

      // Only track physical keypresses for interval/rate metrics (skip auto-repeat)
      let kdInterval: number | null = null;
      if (!e.repeat) {
        kdInterval = s.lastKeydownTime !== null ? (now - s.lastKeydownTime) : null;
        s.lastKeydownTime = now;
        s.totalKeydowns++;

        if (kdInterval !== null && kdInterval > 0) {
          s.keydownIntervals = [...s.keydownIntervals.slice(-499), kdInterval];
        }

        // Ghost: keydown fires for a key already in heldKeys without a keyup in between
        if (s.heldKeys.has(key)) s.ghostEvents++;

        // Record press timestamp (only on physical press, not repeat) for hold duration
        s.keyDownTimes[key] = now;
      }

      s.heldKeys.add(key);
      s.nkroMax = Math.max(s.nkroMax, s.heldKeys.size);
      s.testedKeys.add(key);

      addEvent({
        key,
        code: e.code,
        type: "DOWN",
        repeat: e.repeat,
        interval: allInterval !== null ? allInterval.toFixed(3) : "—",
        hz: allInterval !== null && allInterval > 0 ? (1000 / allInterval).toFixed(1) : "—",
        elapsed: ((now - startRef.current) / 1000).toFixed(3),
        extra: e.repeat ? "REPEAT" : "",
      });
    };

    const handleUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const now = performance.now();
      const key = KEY_CODE_MAP[e.code] || e.key;

      const allInterval = s.lastEventTime !== null ? (now - s.lastEventTime) : null;
      s.lastEventTime = now;
      s.totalEvents++;
      s.totalKeyups++;

      if (allInterval !== null && allInterval > 0) {
        s.allIntervals = [...s.allIntervals.slice(-499), allInterval];
      }

      const downTime = s.keyDownTimes[key];
      let holdDuration: number | null = null;
      if (downTime !== undefined) {
        holdDuration = now - downTime;
        s.holdDurations = [...s.holdDurations.slice(-199), holdDuration];
        if (holdDuration < MICRO_RELEASE_MS) s.microReleases++;
        delete s.keyDownTimes[key];
      }

      s.heldKeys.delete(key);

      addEvent({
        key,
        code: e.code,
        type: "UP",
        repeat: false,
        interval: allInterval !== null ? allInterval.toFixed(3) : "—",
        hz: allInterval !== null && allInterval > 0 ? (1000 / allInterval).toFixed(1) : "—",
        elapsed: ((now - startRef.current) / 1000).toFixed(3),
        extra: holdDuration !== null ? `hold: ${holdDuration.toFixed(1)}ms` : "",
      });
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [isRecording, addEvent]);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const reset = () => {
    eventsRef.current = [];
    setEvents([]);
    startRef.current = performance.now();
    statsRef.current = createFreshStats();
    setDisplayStats(getStats());
    setIsRecording(true);
  };

  const ds = displayStats;
  const rateColor = ds.avgRate > 30 ? "#00ff88" : ds.avgRate > 15 ? "#88ff00" : ds.avgRate > 5 ? "#c0c8d0" : "#5a6068";
  const scoreColor = ds.switchScore > 55 ? "#00ff88" : ds.switchScore > 35 ? "#ffaa00" : "#ff5555";
  const scoreVerdict = ds.totalEvents < 30
    ? "NEED MORE DATA"
    : ds.switchScore > 75 ? "LIKELY MAGNETIC / HALL EFFECT"
    : ds.switchScore > 55 ? "POSSIBLY MAGNETIC"
    : ds.switchScore > 35 ? "INCONCLUSIVE"
    : "LIKELY MECHANICAL";

  const mono = "var(--font-mono, 'JetBrains Mono'), 'SF Mono', 'Fira Code', monospace";

  const Stat = ({ label, value, sub, color, warn }: {
    label: string; value: string | number; sub?: string;
    color?: string; warn?: boolean;
  }) => (
    <div style={{
      background: warn ? "#1a1215" : "#0c0e10",
      border: `1px solid ${warn ? "#ff334433" : "#151a1e"}`,
      borderRadius: 6, padding: "8px 6px", textAlign: "center",
    }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: warn ? "#ff5555" : "#3a4048", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#00ff88", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: warn ? "#ff555588" : "#2a3038", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{
      color: "#c0c8d0",
      fontFamily: mono,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 8, color: "#2a3038" }}>ADVANCED</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#00ff88", letterSpacing: -0.5, margin: "2px 0" }}>KEY DIAGNOSTICS</h1>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", fontSize: 9, color: "#2a3038", flexWrap: "wrap" }}>
          <span>EVENTS: {ds.totalEvents}</span>
          <span>PHYSICAL: {ds.totalKeydowns}</span>
          <span style={{ color: isRecording ? "#00ff88" : "#ff5555", animation: isRecording ? "blink 1.5s infinite" : "none" }}>
            {isRecording ? "● RECORDING" : "○ PAUSED"}
          </span>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "100%", maxWidth: 820, marginBottom: 10 }}>
        <Stat label="Event Rate" value={ds.avgRate > 0 ? `${ds.avgRate.toFixed(0)}Hz` : "—"} sub={`peak ${ds.peakRate > 0 ? ds.peakRate.toFixed(0) + "Hz" : "—"}`} color={rateColor} />
        <Stat label="Min Interval" value={ds.minInterval < Infinity ? `${ds.minInterval.toFixed(2)}ms` : "—"} sub={`max ${ds.maxInterval > 0 ? ds.maxInterval.toFixed(1) + "ms" : "—"}`} color="#c0c8d0" />
        <Stat label="Jitter" value={ds.jitter > 0 ? `±${ds.jitter.toFixed(2)}ms` : "—"} sub="std deviation" color={ds.jitter < 15 ? "#00ff88" : ds.jitter < 50 ? "#ffaa00" : "#ff5555"} />
        <Stat label="NKRO Max" value={ds.nkroMax || "—"} sub={`${ds.currentHeld} held now`} color="#c0c8d0" />
      </div>

      {/* Switch analysis */}
      <div style={{
        width: "100%", maxWidth: 820, marginBottom: 10, background: "#0c0e10",
        border: "1px solid #151a1e", borderRadius: 8, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a4048" }}>SWITCH TYPE ANALYSIS</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor, letterSpacing: 1 }}>{scoreVerdict}</div>
        </div>
        <div style={{ height: 6, background: "#111418", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
          <div style={{
            width: `${ds.switchScore}%`, height: "100%", borderRadius: 3, transition: "width 0.4s ease",
            background: "linear-gradient(90deg, #ff5555, #ffaa00, #00ff88)",
          }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {[
            { label: "CONFIDENCE", value: `${ds.switchScore}%`, color: scoreColor },
            { label: "MICRO RELS", value: ds.microReleases, sub: `<${MICRO_RELEASE_MS}ms holds`, color: ds.microReleases > 3 ? "#ffaa00" : "#556" },
            { label: "AVG HOLD", value: ds.avgHold > 0 ? ds.avgHold.toFixed(1) : "—", sub: "ms", color: "#c0c8d0" },
            { label: "MIN HOLD", value: ds.minHold < Infinity ? ds.minHold.toFixed(2) : "—", sub: "ms", color: ds.minHold < 15 ? "#ffaa00" : "#c0c8d0" },
            { label: "GHOSTS", value: ds.ghostEvents, sub: "phantom evts", color: ds.ghostEvents > 0 ? "#ff5555" : "#556" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#3a4048", letterSpacing: 1 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
              {item.sub && <div style={{ fontSize: 7, color: "#2a3038" }}>{item.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 8, color: "#2a3038", lineHeight: 1.5 }}>
          TIP: Rapidly tap a single key as fast as possible for 10 seconds. Magnetic/Hall effect keyboards produce ultra-short hold times (&lt;10ms) and allow rapid re-actuation. The score requires 30+ events for a meaningful verdict.
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8, background: "#0c0e10", borderRadius: 5, padding: 2, flexWrap: "wrap" }}>
        {["diagnostics", "event log", "intervals"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "5px 14px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "inherit",
            background: tab === t ? "#0f1a15" : "transparent", color: tab === t ? "#00ff88" : "#3a4048",
            border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
          }}>{t}</button>
        ))}
        <button onClick={() => setIsRecording(!isRecording)} style={{
          padding: "5px 12px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "inherit",
          background: isRecording ? "#1a1518" : "#0f1a15", color: isRecording ? "#ff8855" : "#00ff88",
          border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
        }}>{isRecording ? "PAUSE" : "RESUME"}</button>
        <button onClick={reset} style={{
          padding: "5px 12px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "inherit",
          background: "#1a1215", color: "#ff5555", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
        }}>RESET</button>
      </div>

      {/* Content area */}
      <div ref={logRef} style={{
        background: "#0c0e10", border: "1px solid #151a1e", borderRadius: 8, padding: 10,
        width: "100%", maxWidth: 820, height: 320, overflowY: "auto", overflowX: "auto",
      }}>
        {tab === "event log" && (
          <div style={{ minWidth: 600 }}>
            <div style={{ display: "grid", gridTemplateColumns: "70px 38px 50px 70px 80px 70px 1fr", gap: 0, fontSize: 9 }}>
              {["ELAPSED", "TYPE", "KEY", "CODE", "INTERVAL", "Hz", "DETAIL"].map(h => (
                <div key={h} style={{ color: "#2a3038", padding: "3px 0", borderBottom: "1px solid #151a1e", letterSpacing: 1, fontSize: 8 }}>{h}</div>
              ))}
              {events.map((e, i) => {
                const isDown = e.type === "DOWN";
                return (
                  <React.Fragment key={i}>
                    <div style={{ color: "#3a4048", padding: "2px 0" }}>{e.elapsed}s</div>
                    <div style={{ color: isDown ? "#00ff88" : "#556", padding: "2px 0", fontWeight: 700 }}>
                      {e.type}{e.repeat ? "®" : ""}
                    </div>
                    <div style={{ color: "#c0c8d0", padding: "2px 0", fontWeight: 600 }}>{e.key}</div>
                    <div style={{ color: "#2a3038", padding: "2px 0", fontSize: 8 }}>{e.code}</div>
                    <div style={{ color: "#5a6068", padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>
                      {e.interval !== "—" ? `${e.interval}ms` : "—"}
                    </div>
                    <div style={{ color: parseFloat(e.hz) > 200 ? "#00ff88" : "#5a6068", padding: "2px 0" }}>
                      {e.hz !== "—" ? `${e.hz}` : "—"}
                    </div>
                    <div style={{ color: "#3a4048", padding: "2px 0", fontSize: 8 }}>{e.extra}</div>
                  </React.Fragment>
                );
              })}
            </div>
            {events.length === 0 && <div style={{ textAlign: "center", color: "#1a1e22", marginTop: 80, fontSize: 10 }}>Press keys to see events...</div>}
          </div>
        )}

        {tab === "diagnostics" && (
          <div style={{ fontSize: 10, lineHeight: 1.8, color: "#5a6068" }}>
            <div style={{ color: "#00ff88", fontSize: 9, letterSpacing: 3, marginBottom: 8 }}>SYSTEM DIAGNOSTICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>EVENT TIMING</div>
                <div>Avg event rate: <span style={{ color: rateColor, fontWeight: 700 }}>{ds.avgRate > 0 ? `${ds.avgRate.toFixed(2)} Hz` : "—"}</span></div>
                <div>Peak event rate: <span style={{ color: "#c0c8d0", fontWeight: 600 }}>{ds.peakRate > 0 ? `${ds.peakRate.toFixed(2)} Hz` : "—"}</span></div>
                <div>Min interval: <span style={{ color: "#c0c8d0" }}>{ds.minInterval < Infinity ? `${ds.minInterval.toFixed(3)} ms` : "—"}</span></div>
                <div>Max interval: <span style={{ color: "#c0c8d0" }}>{ds.maxInterval > 0 ? `${ds.maxInterval.toFixed(3)} ms` : "—"}</span></div>
                <div>Jitter (σ): <span style={{ color: ds.jitter < 15 ? "#00ff88" : "#ffaa00" }}>{ds.jitter > 0 ? `±${ds.jitter.toFixed(3)} ms` : "—"}</span></div>
                <div>Total events: <span style={{ color: "#c0c8d0" }}>{ds.totalEvents}</span> <span style={{ color: "#3a4048", fontSize: 8 }}>({ds.totalKeydowns} presses, {ds.totalKeyups} releases)</span></div>
                <div style={{ marginTop: 6, fontSize: 8, color: "#2a3038", lineHeight: 1.5 }}>
                  Event rate measures keydown-to-keydown arrival speed in the browser — not the keyboard{"'"}s USB poll rate. Rapid single-key tapping produces the most meaningful data.
                </div>
              </div>
              <div>
                <div style={{ color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>SWITCH CHARACTERISTICS</div>
                <div>Avg hold: <span style={{ color: "#c0c8d0" }}>{ds.avgHold > 0 ? `${ds.avgHold.toFixed(2)} ms` : "—"}</span></div>
                <div>Min hold: <span style={{ color: ds.minHold < 15 ? "#ffaa00" : "#c0c8d0" }}>{ds.minHold < Infinity ? `${ds.minHold.toFixed(3)} ms` : "—"}</span></div>
                <div>Micro-releases: <span style={{ color: ds.microReleases > 3 ? "#ffaa00" : "#c0c8d0" }}>{ds.microReleases}</span> <span style={{ color: "#3a4048", fontSize: 8 }}>{`(<${MICRO_RELEASE_MS}ms holds)`}</span></div>
                <div>Ghost events: <span style={{ color: ds.ghostEvents > 0 ? "#ff5555" : "#c0c8d0" }}>{ds.ghostEvents}</span></div>
                <div>Keys tested: <span style={{ color: "#c0c8d0" }}>{ds.testedCount}</span></div>
                <div>NKRO max: <span style={{ color: "#c0c8d0" }}>{ds.nkroMax}</span></div>
                <div style={{ marginTop: 6, fontSize: 8, color: "#2a3038", lineHeight: 1.5 }}>
                  Mechanical switches: min hold typically {">"} 30ms (physical travel + debounce). Magnetic/Hall effect: can produce {"<"} 10ms holds with rapid trigger enabled.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>HOW TO TEST</div>
            <div style={{ fontSize: 9, color: "#3a4048", lineHeight: 1.7 }}>
              1. Tap a single key as fast as possible for 10 sec — measures event rate + minimum hold time<br />
              2. Press and hold 6+ keys simultaneously — tests N-key rollover (NKRO)<br />
              3. Tap rapidly with minimal finger travel — magnetic switches produce sub-10ms holds<br />
              4. Watch ghost events during rapid use — indicates switch double-firing or contact bounce
            </div>
          </div>
        )}

        {tab === "intervals" && (
          <div>
            <div style={{ color: "#00ff88", fontSize: 9, letterSpacing: 3, marginBottom: 8 }}>KEYDOWN INTERVAL DISTRIBUTION</div>
            {ds.keydownIntervals.length > 0 ? (
              <React.Fragment>
                <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 1, padding: "0 4px" }}>
                  {(() => {
                    const maxVal = Math.max(...ds.keydownIntervals);
                    return ds.keydownIntervals.map((v, i) => {
                      const h = maxVal > 0 ? (v / maxVal) * 160 : 0;
                      const rate = 1000 / v;
                      const color = rate > 30 ? "#00ff88" : rate > 15 ? "#88ff00" : rate > 5 ? "#ffaa00" : "#ff5555";
                      return (
                        <div key={i} style={{
                          flex: 1, minWidth: 2, maxWidth: 8, height: h, background: color,
                          borderRadius: "2px 2px 0 0", opacity: 0.8,
                        }} title={`${v.toFixed(3)}ms (${rate.toFixed(0)}Hz)`} />
                      );
                    });
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#2a3038", marginTop: 4, padding: "0 4px" }}>
                  <span>← older</span>
                  <span>Last 100 keydown intervals — shorter bars = faster tapping</span>
                  <span>newer →</span>
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, fontSize: 8 }}>
                  {[
                    { color: "#00ff88", label: ">30Hz" },
                    { color: "#88ff00", label: ">15Hz" },
                    { color: "#ffaa00", label: ">5Hz" },
                    { color: "#ff5555", label: "<5Hz" },
                  ].map((l, i) => (
                    <span key={i}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: l.color, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </React.Fragment>
            ) : (
              <div style={{ textAlign: "center", color: "#1a1e22", marginTop: 60, fontSize: 10 }}>Press keys to see interval histogram...</div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 8, fontSize: 8, color: "#1a1e22", textAlign: "center", maxWidth: 820, lineHeight: 1.5 }}>
        Browser event timing is limited to ~1-4ms resolution. Switch type detection uses behavioral heuristics from key event patterns, not direct hardware access. For definitive results, use native USB protocol analysis tools.
      </div>
    </div>
  );
}
