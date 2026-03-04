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

// --- Types ---

interface KeyEvent {
  key: string;
  code: string;
  type: "DOWN" | "UP";
  repeat: boolean;
  interval: string;
  hz: string;
  elapsed: string;
  extra: string;
  timestampMs: number;
  elapsedMs: number;
  intervalMs: number | null;
  holdMs: number | null;
  reactivationMs: number | null;
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
  keyUpTimes: Record<string, number>;
  reactivationGaps: number[];
  sameKeyTapIntervals: number[];
  lastKeydownPerKey: Record<string, number>;
}

interface ClassSignal {
  name: string;
  finding: string;
  supports: "rapid_trigger" | "magnetic" | "mechanical" | "neutral";
}

interface Classification {
  verdict: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  signals: ClassSignal[];
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
  holdP5: number;
  holdP25: number;
  holdP50: number;
  holdP75: number;
  holdP95: number;
  holdStdDev: number;
  reactP5: number;
  reactMedian: number;
  reactMin: number;
  maxTapRate: number;
  microRatio: number;
  classification: Classification;
  keydownIntervals: number[];
}

// --- Helpers ---

function createFreshStats(): InternalStats {
  return {
    keydownIntervals: [], allIntervals: [],
    lastKeydownTime: null, lastEventTime: null,
    totalEvents: 0, totalKeydowns: 0, totalKeyups: 0,
    nkroMax: 0, heldKeys: new Set(), testedKeys: new Set(),
    ghostEvents: 0, microReleases: 0,
    holdDurations: [], keyDownTimes: {},
    keyUpTimes: {}, reactivationGaps: [],
    sameKeyTapIntervals: [], lastKeydownPerKey: {},
  };
}

function pctSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function classifySwitch(m: {
  holdP5: number; holdMean: number; holdStdDev: number;
  reactP5: number; reactMin: number;
  microRatio: number; maxTapRate: number;
  ghostEvents: number; totalEvents: number; totalKeyups: number;
  holdCount: number; reactCount: number;
}): Classification {
  if (m.totalEvents < 50) {
    return {
      verdict: "NEED MORE DATA",
      confidence: "LOW",
      description: "Generate at least 50 key events by rapidly tapping a single key for 10 seconds.",
      signals: [],
    };
  }

  const signals: ClassSignal[] = [];

  // Signal 1: Hold duration floor (5th percentile)
  // Mechanical switches need ~2mm travel + debounce → floor typically >30ms
  // Magnetic rapid trigger at 0.1mm actuation → sub-8ms holds achievable
  if (m.holdCount >= 10) {
    const p5 = m.holdP5;
    if (!isNaN(p5)) {
      if (p5 < 8) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — sub-8ms holds are physically impossible on mechanical switches (require ~2mm travel + debounce)`, supports: "rapid_trigger" });
      } else if (p5 < 15) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — very short holds, below typical mechanical floor (~30ms), consistent with magnetic switches`, supports: "magnetic" });
      } else if (p5 < 25) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — borderline short holds, could be fast typing on mechanical or magnetic switches`, supports: "neutral" });
      } else if (p5 < 40) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — consistent with mechanical switch travel distance and firmware debounce`, supports: "mechanical" });
      } else {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — long hold floor, typical of mechanical or membrane switches`, supports: "mechanical" });
      }
    }
  }

  // Signal 2: Same-key re-activation speed (keyup → next keydown of same key)
  // Mechanical: key must travel ~0.4mm up past reset point then ~2mm down → >25ms
  // Rapid trigger: reset at 0.1mm, actuation at 0.1mm → near-instant
  if (m.reactCount >= 5) {
    const rp5 = m.reactP5;
    if (!isNaN(rp5)) {
      if (rp5 < 8) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — near-instant same-key re-activation, hallmark of rapid trigger (0.1mm reset distance)`, supports: "rapid_trigger" });
      } else if (rp5 < 20) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — fast re-activation, below mechanical reset travel time`, supports: "magnetic" });
      } else if (rp5 < 35) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — moderate re-activation speed`, supports: "neutral" });
      } else {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — consistent with full mechanical key reset travel (~0.4mm hysteresis)`, supports: "mechanical" });
      }
    }
  }

  // Signal 3: Micro-release ratio (% of holds under 20ms)
  if (m.totalKeyups >= 20) {
    if (m.microRatio > 0.2) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% of holds were <20ms — high rate of ultra-short holds, strong rapid trigger indicator`, supports: "rapid_trigger" });
    } else if (m.microRatio > 0.05) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% micro-releases — some very short holds detected`, supports: "magnetic" });
    } else if (m.microRatio < 0.01 && m.totalKeyups >= 50) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% — virtually no sub-20ms holds, consistent with mechanical travel constraints`, supports: "mechanical" });
    }
  }

  // Signal 4: Maximum single-key tap rate
  // Human physical limit on mechanical: ~15-20 taps/sec (need full travel cycle)
  // Rapid trigger: 25-50+ taps/sec (minimal travel)
  if (m.maxTapRate > 0) {
    if (m.maxTapRate > 30) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — exceeds human mechanical limit (~20/sec), indicates rapid trigger`, supports: "rapid_trigger" });
    } else if (m.maxTapRate > 18) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — very fast, at the edge of what's possible on mechanical`, supports: "magnetic" });
    } else if (m.maxTapRate > 5) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — within normal range for mechanical switches`, supports: "neutral" });
    }
  }

  // Signal 5: Hold duration consistency
  // Analog sensing = clean, uniform timing; contact-based = noisier from bounce/debounce
  if (m.holdCount >= 20 && m.holdMean > 0) {
    const cv = m.holdStdDev / m.holdMean;
    if (cv < 0.2 && m.holdMean < 40) {
      signals.push({ name: "Hold Consistency", finding: `CV = ${cv.toFixed(2)} (mean ${m.holdMean.toFixed(0)}ms) — very uniform short holds, typical of analog hall-effect sensing`, supports: "magnetic" });
    } else if (cv > 0.5) {
      signals.push({ name: "Hold Consistency", finding: `CV = ${cv.toFixed(2)} — high variance in hold durations, can indicate debounce timing artifacts`, supports: "mechanical" });
    }
  }

  // Signal 6: Ghost/bounce events
  if (m.totalEvents >= 100) {
    if (m.ghostEvents > 3) {
      signals.push({ name: "Contact Bounce", finding: `${m.ghostEvents} ghost events — repeated keydown without keyup, characteristic of contact-based switch bounce`, supports: "mechanical" });
    } else if (m.ghostEvents === 0) {
      signals.push({ name: "Contact Bounce", finding: `0 ghost events — clean signaling, consistent with analog (non-contact) sensing`, supports: "magnetic" });
    }
  }

  // Tally weighted scores
  let rt = 0, mag = 0, mech = 0;
  for (const sig of signals) {
    switch (sig.supports) {
      case "rapid_trigger": rt += 1.0; mag += 0.3; break;
      case "magnetic": mag += 1.0; break;
      case "mechanical": mech += 1.0; break;
    }
  }

  const total = rt + mag + mech;
  if (total === 0 || signals.length < 2) {
    return { verdict: "INCONCLUSIVE", confidence: "LOW", description: "Not enough distinguishing signals. Rapidly tap a single key for 10+ seconds to generate more data.", signals };
  }

  const maxScore = Math.max(rt, mag, mech);
  const dominance = maxScore / total;
  const dataRich = m.totalEvents >= 100 && m.holdCount >= 30;
  const conf: "HIGH" | "MEDIUM" | "LOW" = dominance > 0.55 && dataRich ? "HIGH" : dominance > 0.4 ? "MEDIUM" : "LOW";

  if (rt >= mag && rt >= mech) {
    return { verdict: "RAPID TRIGGER", confidence: conf, description: "Magnetic/Hall effect switches with rapid trigger enabled. Ultra-short holds and near-instant re-activation detected — impossible on mechanical switches.", signals };
  } else if (mag >= mech) {
    return { verdict: "LIKELY MAGNETIC", confidence: conf, description: "Characteristics consistent with magnetic/Hall effect switches. Clean timing with short hold durations and no contact bounce artifacts.", signals };
  } else {
    return { verdict: "LIKELY MECHANICAL", confidence: conf, description: "Characteristics consistent with traditional mechanical switches. Hold patterns match physical key travel distance and firmware debounce behavior.", signals };
  }
}

const VERDICT_COLORS: Record<string, string> = {
  "RAPID TRIGGER": "#ff44cc",
  "LIKELY MAGNETIC": "#44aaff",
  "LIKELY MECHANICAL": "#ffaa44",
  "INCONCLUSIVE": "#888888",
  "NEED MORE DATA": "#555555",
};
const SIGNAL_COLORS: Record<string, string> = {
  rapid_trigger: "#ff44cc", magnetic: "#44aaff", mechanical: "#ffaa44", neutral: "#555555",
};

// --- Component ---

export default function KeyboardTester() {
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const [tab, setTab] = useState("diagnostics");
  const [isRecording, setIsRecording] = useState(true);

  const eventsRef = useRef<KeyEvent[]>([]);
  const startRef = useRef(performance.now());
  const statsRef = useRef<InternalStats>(createFreshStats());

  const getStats = useCallback((): DisplayStats => {
    const s = statsRef.current;

    const kdIntervals = s.keydownIntervals;
    const rates = kdIntervals.filter(i => i > 0).map(i => 1000 / i);
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const peakRate = rates.length > 0 ? Math.max(...rates) : 0;
    const minInterval = kdIntervals.length > 0 ? Math.min(...kdIntervals) : Infinity;
    const maxInterval = kdIntervals.length > 0 ? Math.max(...kdIntervals) : 0;
    const kdMean = kdIntervals.length > 0 ? kdIntervals.reduce((a, b) => a + b, 0) / kdIntervals.length : 0;
    const kdVar = kdIntervals.length > 0 ? kdIntervals.reduce((a, b) => a + (b - kdMean) ** 2, 0) / kdIntervals.length : 0;
    const jitter = Math.sqrt(kdVar);

    const holds = s.holdDurations;
    const avgHold = holds.length > 0 ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;
    const minHold = holds.length > 0 ? Math.min(...holds) : Infinity;
    const sortedHolds = [...holds].sort((a, b) => a - b);
    const holdP5 = pctSorted(sortedHolds, 5);
    const holdP25 = pctSorted(sortedHolds, 25);
    const holdP50 = pctSorted(sortedHolds, 50);
    const holdP75 = pctSorted(sortedHolds, 75);
    const holdP95 = pctSorted(sortedHolds, 95);
    const holdVar = holds.length > 0 ? holds.reduce((a, b) => a + (b - avgHold) ** 2, 0) / holds.length : 0;
    const holdStdDev = Math.sqrt(holdVar);

    const sortedReact = [...s.reactivationGaps].sort((a, b) => a - b);
    const reactP5 = pctSorted(sortedReact, 5);
    const reactMedian = pctSorted(sortedReact, 50);
    const reactMin = sortedReact.length > 0 ? sortedReact[0] : Infinity;

    const sortedTaps = [...s.sameKeyTapIntervals].sort((a, b) => a - b);
    const tapP5 = pctSorted(sortedTaps, 5);
    const maxTapRate = !isNaN(tapP5) && tapP5 > 0 ? 1000 / tapP5 : 0;

    const microRatio = s.totalKeyups > 0 ? s.microReleases / s.totalKeyups : 0;

    const classification = classifySwitch({
      holdP5, holdMean: avgHold, holdStdDev,
      reactP5, reactMin,
      microRatio, maxTapRate,
      ghostEvents: s.ghostEvents,
      totalEvents: s.totalEvents, totalKeyups: s.totalKeyups,
      holdCount: holds.length, reactCount: s.reactivationGaps.length,
    });

    return {
      avgRate, peakRate, minInterval, maxInterval, jitter,
      totalEvents: s.totalEvents, totalKeydowns: s.totalKeydowns,
      totalKeyups: s.totalKeyups, nkroMax: s.nkroMax,
      currentHeld: s.heldKeys.size, testedCount: s.testedKeys.size,
      ghostEvents: s.ghostEvents, microReleases: s.microReleases,
      avgHold, minHold,
      holdP5, holdP25, holdP50, holdP75, holdP95, holdStdDev,
      reactP5, reactMedian, reactMin,
      maxTapRate, microRatio,
      classification,
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

    const handleDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const s = statsRef.current;
      const now = performance.now();
      const key = KEY_CODE_MAP[e.code] || e.key;

      const allInterval = s.lastEventTime !== null ? (now - s.lastEventTime) : null;
      s.lastEventTime = now;
      s.totalEvents++;

      if (allInterval !== null && allInterval > 0) {
        s.allIntervals = [...s.allIntervals.slice(-499), allInterval];
      }

      let kdInterval: number | null = null;
      let reactivationGap: number | null = null;

      if (!e.repeat) {
        kdInterval = s.lastKeydownTime !== null ? (now - s.lastKeydownTime) : null;
        s.lastKeydownTime = now;
        s.totalKeydowns++;

        if (kdInterval !== null && kdInterval > 0) {
          s.keydownIntervals = [...s.keydownIntervals.slice(-499), kdInterval];
        }

        // Same-key re-activation gap: time since this key was last released
        const lastUp = s.keyUpTimes[key];
        if (lastUp !== undefined) {
          reactivationGap = now - lastUp;
          s.reactivationGaps = [...s.reactivationGaps.slice(-299), reactivationGap];
        }

        // Same-key tap interval: keydown-to-keydown of same key
        const lastDown = s.lastKeydownPerKey[key];
        if (lastDown !== undefined) {
          const tapInterval = now - lastDown;
          s.sameKeyTapIntervals = [...s.sameKeyTapIntervals.slice(-299), tapInterval];
        }
        s.lastKeydownPerKey[key] = now;

        if (s.heldKeys.has(key)) s.ghostEvents++;
        s.keyDownTimes[key] = now;
      }

      s.heldKeys.add(key);
      s.nkroMax = Math.max(s.nkroMax, s.heldKeys.size);
      s.testedKeys.add(key);

      const elapsedMs = now - startRef.current;
      addEvent({
        key, code: e.code, type: "DOWN", repeat: e.repeat,
        interval: allInterval !== null ? allInterval.toFixed(3) : "—",
        hz: allInterval !== null && allInterval > 0 ? (1000 / allInterval).toFixed(1) : "—",
        elapsed: (elapsedMs / 1000).toFixed(3),
        extra: e.repeat ? "REPEAT" : reactivationGap !== null ? `react: ${reactivationGap.toFixed(1)}ms` : "",
        timestampMs: now, elapsedMs,
        intervalMs: allInterval, holdMs: null,
        reactivationMs: reactivationGap,
      });
    };

    const handleUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const s = statsRef.current;
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
        s.holdDurations = [...s.holdDurations.slice(-299), holdDuration];
        if (holdDuration < MICRO_RELEASE_MS) s.microReleases++;
        delete s.keyDownTimes[key];
      }

      s.keyUpTimes[key] = now;
      s.heldKeys.delete(key);

      const elapsedMs = now - startRef.current;
      addEvent({
        key, code: e.code, type: "UP", repeat: false,
        interval: allInterval !== null ? allInterval.toFixed(3) : "—",
        hz: allInterval !== null && allInterval > 0 ? (1000 / allInterval).toFixed(1) : "—",
        elapsed: (elapsedMs / 1000).toFixed(3),
        extra: holdDuration !== null ? `hold: ${holdDuration.toFixed(1)}ms` : "",
        timestampMs: now, elapsedMs,
        intervalMs: allInterval, holdMs: holdDuration,
        reactivationMs: null,
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

  const downloadReport = () => {
    const ds = displayStats;
    const report = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      testDurationSec: parseFloat(((performance.now() - startRef.current) / 1000).toFixed(1)),
      analysis: {
        verdict: ds.classification.verdict,
        confidence: ds.classification.confidence,
        description: ds.classification.description,
        eventRate: { avgHz: +ds.avgRate.toFixed(2), peakHz: +ds.peakRate.toFixed(2), minIntervalMs: ds.minInterval < Infinity ? +ds.minInterval.toFixed(3) : null },
        holdDuration: {
          minMs: ds.minHold < Infinity ? +ds.minHold.toFixed(3) : null,
          avgMs: +ds.avgHold.toFixed(2), stdDevMs: +ds.holdStdDev.toFixed(2),
          p5: isNaN(ds.holdP5) ? null : +ds.holdP5.toFixed(2),
          p25: isNaN(ds.holdP25) ? null : +ds.holdP25.toFixed(2),
          p50: isNaN(ds.holdP50) ? null : +ds.holdP50.toFixed(2),
          p75: isNaN(ds.holdP75) ? null : +ds.holdP75.toFixed(2),
          p95: isNaN(ds.holdP95) ? null : +ds.holdP95.toFixed(2),
        },
        reactivation: {
          minMs: ds.reactMin < Infinity ? +ds.reactMin.toFixed(2) : null,
          p5: isNaN(ds.reactP5) ? null : +ds.reactP5.toFixed(2),
          medianMs: isNaN(ds.reactMedian) ? null : +ds.reactMedian.toFixed(2),
        },
        maxTapRateHz: +ds.maxTapRate.toFixed(1),
        microReleaseRatio: +ds.microRatio.toFixed(4),
        nkroMax: ds.nkroMax, ghostEvents: ds.ghostEvents,
        totalEvents: ds.totalEvents, totalKeydowns: ds.totalKeydowns, totalKeyups: ds.totalKeyups,
        keysTestedCount: ds.testedCount,
        signals: ds.classification.signals,
      },
      events: eventsRef.current.map(e => ({
        elapsedMs: +e.elapsedMs.toFixed(3), type: e.type, key: e.key, code: e.code, repeat: e.repeat,
        intervalMs: e.intervalMs !== null ? +e.intervalMs.toFixed(3) : null,
        holdMs: e.holdMs !== null ? +e.holdMs.toFixed(3) : null,
        reactivationMs: e.reactivationMs !== null ? +e.reactivationMs.toFixed(3) : null,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyboard-diag-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ds = displayStats;
  const cl = ds.classification;
  const verdictColor = VERDICT_COLORS[cl.verdict] || "#888";
  const rateColor = ds.avgRate > 30 ? "#00ff88" : ds.avgRate > 15 ? "#88ff00" : ds.avgRate > 5 ? "#c0c8d0" : "#5a6068";
  const mono = "var(--font-mono, 'JetBrains Mono'), 'SF Mono', 'Fira Code', monospace";

  const Stat = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div style={{ background: "#0c0e10", border: "1px solid #151a1e", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: "#3a4048", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#00ff88", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: "#2a3038", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const fmtP = (v: number) => isNaN(v) ? "—" : v < Infinity ? v.toFixed(1) : "—";

  return (
    <div style={{ color: "#c0c8d0", fontFamily: mono, display: "flex", flexDirection: "column", alignItems: "center" }}>
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
      <div style={{ width: "100%", maxWidth: 820, marginBottom: 10, background: "#0c0e10", border: "1px solid #151a1e", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a4048" }}>SWITCH TYPE ANALYSIS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 8, color: "#3a4048", border: `1px solid ${verdictColor}33`, borderRadius: 3, padding: "2px 6px", letterSpacing: 1 }}>{cl.confidence}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: verdictColor, letterSpacing: 1 }}>{cl.verdict}</span>
          </div>
        </div>
        <div style={{ fontSize: 8, color: "#3a4048", lineHeight: 1.5, marginBottom: 10 }}>{cl.description}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {[
            { label: "HOLD P5", value: fmtP(ds.holdP5), sub: "ms", color: ds.holdP5 < 10 ? "#ff44cc" : ds.holdP5 < 25 ? "#44aaff" : ds.holdP5 < 40 ? "#ffaa44" : "#c0c8d0" },
            { label: "REACT P5", value: fmtP(ds.reactP5), sub: "ms", color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#c0c8d0" },
            { label: "MICRO%", value: ds.totalKeyups > 0 ? `${(ds.microRatio * 100).toFixed(1)}` : "—", sub: `<${MICRO_RELEASE_MS}ms`, color: ds.microRatio > 0.2 ? "#ff44cc" : ds.microRatio > 0.05 ? "#44aaff" : "#556" },
            { label: "TAP RATE", value: ds.maxTapRate > 0 ? ds.maxTapRate.toFixed(1) : "—", sub: "taps/sec", color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#c0c8d0" },
            { label: "AVG HOLD", value: ds.avgHold > 0 ? ds.avgHold.toFixed(1) : "—", sub: "ms", color: "#c0c8d0" },
            { label: "GHOSTS", value: ds.ghostEvents, sub: "bounce evts", color: ds.ghostEvents > 3 ? "#ffaa44" : ds.ghostEvents > 0 ? "#ff5555" : "#556" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7, color: "#3a4048", letterSpacing: 1 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
              {item.sub && <div style={{ fontSize: 7, color: "#2a3038" }}>{item.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 8, color: "#2a3038", lineHeight: 1.5 }}>
          TIP: Rapidly tap a single key as fast as possible for 10+ seconds. The tool needs 50+ events for classification. Sub-10ms holds and near-instant re-activation are physically impossible on mechanical switches.
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
        <button onClick={downloadReport} style={{
          padding: "5px 12px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "inherit",
          background: "#0f1520", color: "#5588ff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
        }}>EXPORT</button>
      </div>

      {/* Content area */}
      <div ref={logRef} style={{
        background: "#0c0e10", border: "1px solid #151a1e", borderRadius: 8, padding: 10,
        width: "100%", maxWidth: 820, height: 400, overflowY: "auto", overflowX: "auto",
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
                      {e.hz !== "—" ? e.hz : "—"}
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
                <div>Jitter (σ): <span style={{ color: ds.jitter < 15 ? "#00ff88" : "#ffaa00" }}>{ds.jitter > 0 ? `±${ds.jitter.toFixed(3)} ms` : "—"}</span></div>
                <div>Total events: <span style={{ color: "#c0c8d0" }}>{ds.totalEvents}</span> <span style={{ color: "#3a4048", fontSize: 8 }}>({ds.totalKeydowns} presses, {ds.totalKeyups} releases)</span></div>
              </div>
              <div>
                <div style={{ color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>HOLD DURATION DISTRIBUTION</div>
                {ds.totalKeyups > 0 ? (
                  <div style={{ fontSize: 9 }}>
                    {[
                      { label: "P5", val: ds.holdP5 },
                      { label: "P25", val: ds.holdP25 },
                      { label: "P50", val: ds.holdP50 },
                      { label: "P75", val: ds.holdP75 },
                      { label: "P95", val: ds.holdP95 },
                    ].map(({ label, val }) => {
                      const w = !isNaN(val) && ds.holdP95 > 0 ? Math.min(100, (val / ds.holdP95) * 100) : 0;
                      const c = val < 10 ? "#ff44cc" : val < 25 ? "#44aaff" : val < 40 ? "#ffaa44" : "#3a4048";
                      return (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 24, textAlign: "right", color: "#3a4048", fontSize: 8 }}>{label}</span>
                          <div style={{ flex: 1, height: 6, background: "#111418", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${w}%`, height: "100%", background: c, borderRadius: 3, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ width: 50, fontSize: 8, color: c, fontWeight: 600 }}>{fmtP(val)}ms</span>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 8, color: "#2a3038", marginTop: 2 }}>
                      σ = {ds.holdStdDev > 0 ? ds.holdStdDev.toFixed(1) : "—"}ms &nbsp; avg = {ds.avgHold > 0 ? ds.avgHold.toFixed(1) : "—"}ms
                    </div>
                  </div>
                ) : <div style={{ color: "#1a1e22", fontSize: 9 }}>Press and release keys to see distribution...</div>}
              </div>
            </div>

            {/* Re-activation analysis */}
            <div style={{ marginTop: 12, color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>RE-ACTIVATION ANALYSIS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 10 }}>
              <div>
                <div>Re-activation P5: <span style={{ color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#c0c8d0", fontWeight: 600 }}>{fmtP(ds.reactP5)} ms</span></div>
                <div>Re-activation median: <span style={{ color: "#c0c8d0" }}>{fmtP(ds.reactMedian)} ms</span></div>
                <div>Re-activation min: <span style={{ color: "#c0c8d0" }}>{ds.reactMin < Infinity ? ds.reactMin.toFixed(2) : "—"} ms</span></div>
              </div>
              <div>
                <div>Max tap rate: <span style={{ color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#c0c8d0", fontWeight: 600 }}>{ds.maxTapRate > 0 ? `${ds.maxTapRate.toFixed(1)} taps/sec` : "—"}</span></div>
                <div>Micro-releases: <span style={{ color: ds.microReleases > 3 ? "#ffaa00" : "#c0c8d0" }}>{ds.microReleases}</span> <span style={{ color: "#3a4048", fontSize: 8 }}>({(ds.microRatio * 100).toFixed(1)}% of releases)</span></div>
                <div>Ghost events: <span style={{ color: ds.ghostEvents > 0 ? "#ff5555" : "#c0c8d0" }}>{ds.ghostEvents}</span></div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: "#2a3038", marginTop: 2, lineHeight: 1.5 }}>
              Re-activation = time from releasing a key to pressing the same key again. Mechanical keyboards need {">"}25ms (physical reset travel). Rapid trigger can re-actuate in {"<"}5ms.
            </div>

            {/* Classification evidence */}
            {cl.signals.length > 0 && (
              <>
                <div style={{ marginTop: 12, color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 6 }}>CLASSIFICATION EVIDENCE</div>
                {cl.signals.map((sig, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4, fontSize: 9, lineHeight: 1.5 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: SIGNAL_COLORS[sig.supports], marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <span style={{ color: SIGNAL_COLORS[sig.supports], fontWeight: 600 }}>{sig.name}</span>
                      <span style={{ color: "#3a4048" }}> — {sig.finding}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* How to test */}
            <div style={{ marginTop: 12, color: "#3a4048", fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>HOW TO TEST</div>
            <div style={{ fontSize: 9, color: "#3a4048", lineHeight: 1.7 }}>
              1. Tap a single key as fast as possible for 10+ sec — measures hold floor, re-activation speed, and tap rate<br />
              2. Press and hold 6+ keys simultaneously — tests N-key rollover (NKRO)<br />
              3. Focus on minimal finger movement during rapid tapping — rapid trigger keyboards show sub-10ms holds<br />
              4. Use EXPORT to download the full report as JSON for external analysis
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
        Browser event timing is limited to ~1-4ms resolution. Classification uses behavioral heuristics from key event patterns, not direct hardware access. For definitive results, use native USB protocol analysis. Export your data with EXPORT for detailed offline analysis.
      </div>
    </div>
  );
}
