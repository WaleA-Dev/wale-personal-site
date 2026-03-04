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
  supports: "rapid_trigger" | "magnetic" | "mechanical" | "membrane" | "neutral";
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
  nkroMax: number; testedKeys: number;
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
  // Rubber dome membrane: mushy travel, P5 typically 45-80ms
  // Mechanical spring: crisper travel, P5 typically 25-40ms
  // Magnetic: configurable actuation, P5 can be 8-25ms
  // Rapid trigger: 0.1mm actuation, P5 < 8ms
  if (m.holdCount >= 10) {
    const p5 = m.holdP5;
    if (!isNaN(p5)) {
      if (p5 < 8) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — sub-8ms holds are physically impossible on mechanical/membrane (require full travel cycle)`, supports: "rapid_trigger" });
      } else if (p5 < 15) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — very short holds, well below mechanical (~30ms) or membrane (~50ms) floor`, supports: "magnetic" });
      } else if (p5 < 25) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — short holds, could be magnetic switches or very fast mechanical typing`, supports: "neutral" });
      } else if (p5 < 42) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — consistent with mechanical switch springs (~2mm travel + debounce)`, supports: "mechanical" });
      } else if (p5 < 60) {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — elevated hold floor, consistent with membrane rubber dome actuation (mushier than mechanical springs)`, supports: "membrane" });
      } else {
        signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — high hold floor, typical of membrane rubber dome keyboards`, supports: "membrane" });
      }
    }
  }

  // Signal 2: Same-key re-activation speed (keyup → next keydown of same key)
  if (m.reactCount >= 5) {
    const rp5 = m.reactP5;
    if (!isNaN(rp5)) {
      if (rp5 < 8) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — near-instant same-key re-activation, hallmark of rapid trigger (0.1mm reset)`, supports: "rapid_trigger" });
      } else if (rp5 < 20) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — fast re-activation, below mechanical reset travel time`, supports: "magnetic" });
      } else if (rp5 < 40) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — moderate re-activation, consistent with mechanical spring reset`, supports: "neutral" });
      } else if (rp5 < 80) {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — slow re-activation, consistent with mechanical hysteresis`, supports: "mechanical" });
      } else {
        signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — very slow re-activation, rubber dome membranes need longer to rebound`, supports: "membrane" });
      }
    }
  }

  // Signal 3: Minimum re-activation gap (absolute fastest same-key repeat)
  // Mechanical spring reset: ~30-50ms minimum achievable
  // Membrane rubber dome: ~55-80ms minimum (dome needs to fully reform)
  if (m.reactCount >= 3 && m.reactMin < Infinity) {
    if (m.reactMin > 55) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(0)}ms — rubber dome membranes physically can't reset faster than ~55ms`, supports: "membrane" });
    } else if (m.reactMin > 35) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(0)}ms — consistent with mechanical spring reset cycle`, supports: "mechanical" });
    } else if (m.reactMin < 10) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(0)}ms — near-instant, only possible with rapid trigger`, supports: "rapid_trigger" });
    }
  }

  // Signal 4: Micro-release ratio (% of holds under 20ms)
  if (m.totalKeyups >= 20) {
    if (m.microRatio > 0.2) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% of holds were <20ms — strong rapid trigger indicator`, supports: "rapid_trigger" });
    } else if (m.microRatio > 0.05) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% micro-releases — some very short holds detected`, supports: "magnetic" });
    } else if (m.microRatio < 0.01 && m.totalKeyups >= 50) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% — virtually no sub-20ms holds, consistent with physical travel constraints`, supports: "mechanical" });
    }
  }

  // Signal 5: Maximum single-key tap rate
  if (m.maxTapRate > 0) {
    if (m.maxTapRate > 30) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — exceeds mechanical/membrane limit (~15-20/sec), indicates rapid trigger`, supports: "rapid_trigger" });
    } else if (m.maxTapRate > 18) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — very fast, at the edge of mechanical capability`, supports: "magnetic" });
    } else if (m.maxTapRate > 10) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — normal range for mechanical switches`, supports: "neutral" });
    } else if (m.maxTapRate <= 10 && m.maxTapRate > 0) {
      signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — low tap rate, rubber dome resistance limits rapid tapping`, supports: "membrane" });
    }
  }

  // Signal 6: Hold duration consistency
  if (m.holdCount >= 20 && m.holdMean > 0) {
    const cv = m.holdStdDev / m.holdMean;
    if (cv < 0.2 && m.holdMean < 40) {
      signals.push({ name: "Hold Consistency", finding: `CV = ${cv.toFixed(2)} (mean ${m.holdMean.toFixed(0)}ms) — very uniform short holds, typical of analog hall-effect sensing`, supports: "magnetic" });
    } else if (cv > 0.5) {
      signals.push({ name: "Hold Consistency", finding: `CV = ${cv.toFixed(2)} — high variance in hold durations, can indicate debounce timing artifacts`, supports: "mechanical" });
    }
  }

  // Signal 7: Ghost/bounce events
  if (m.totalEvents >= 100) {
    if (m.ghostEvents > 3) {
      signals.push({ name: "Contact Bounce", finding: `${m.ghostEvents} ghost events — repeated keydown without keyup, characteristic of mechanical switch bounce`, supports: "mechanical" });
    } else if (m.ghostEvents === 0) {
      signals.push({ name: "Contact Bounce", finding: `0 ghost events — clean signaling, both membrane and magnetic switches avoid contact bounce`, supports: "neutral" });
    }
  }

  // Signal 8: NKRO capability
  // Membrane keyboards use a simpler matrix: typically 3-6 key rollover
  // Mechanical with diodes: often full NKRO (10+ simultaneous keys)
  if (m.nkroMax > 0) {
    if (m.nkroMax <= 3 && m.testedKeys >= 8) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — low rollover is characteristic of membrane matrix design. Press 6+ keys at once to confirm.`, supports: "membrane" });
    } else if (m.nkroMax >= 10) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — full NKRO, typically found on mechanical keyboards with diode matrix`, supports: "mechanical" });
    }
  }

  // Tally weighted scores
  let rt = 0, mag = 0, mech = 0, mem = 0;
  for (const sig of signals) {
    switch (sig.supports) {
      case "rapid_trigger": rt += 1.0; mag += 0.3; break;
      case "magnetic": mag += 1.0; break;
      case "mechanical": mech += 1.0; break;
      case "membrane": mem += 1.0; break;
    }
  }

  const total = rt + mag + mech + mem;
  if (total === 0 || signals.length < 2) {
    return { verdict: "INCONCLUSIVE", confidence: "LOW", description: "Not enough distinguishing signals. Rapidly tap a single key for 10+ seconds to generate more data.", signals };
  }

  const maxScore = Math.max(rt, mag, mech, mem);
  const dominance = maxScore / total;
  const dataRich = m.totalEvents >= 100 && m.holdCount >= 30;
  const conf: "HIGH" | "MEDIUM" | "LOW" = dominance > 0.5 && dataRich ? "HIGH" : dominance > 0.35 ? "MEDIUM" : "LOW";

  if (rt >= mag && rt >= mech && rt >= mem) {
    return { verdict: "RAPID TRIGGER", confidence: conf, description: "Magnetic/Hall effect switches with rapid trigger enabled. Ultra-short holds and near-instant re-activation detected — physically impossible on mechanical or membrane switches.", signals };
  } else if (mag >= mech && mag >= mem) {
    return { verdict: "LIKELY MAGNETIC", confidence: conf, description: "Characteristics consistent with magnetic/Hall effect switches. Clean timing with short hold durations and no contact bounce artifacts.", signals };
  } else if (mem > mech) {
    return { verdict: "LIKELY MEMBRANE", confidence: conf, description: "Characteristics consistent with membrane (rubber dome) keyboard. Elevated hold durations, slow re-activation, and limited key rollover — rubber domes are mushier and slower to reset than mechanical springs.", signals };
  } else {
    return { verdict: "LIKELY MECHANICAL", confidence: conf, description: "Characteristics consistent with traditional mechanical switches. Hold patterns match spring-based travel distance and firmware debounce behavior.", signals };
  }
}

const VERDICT_COLORS: Record<string, string> = {
  "RAPID TRIGGER": "#ff44cc",
  "LIKELY MAGNETIC": "#44aaff",
  "LIKELY MECHANICAL": "#ffaa44",
  "LIKELY MEMBRANE": "#22ccaa",
  "INCONCLUSIVE": "#888888",
  "NEED MORE DATA": "#555555",
};
const SIGNAL_COLORS: Record<string, string> = {
  rapid_trigger: "#ff44cc", magnetic: "#44aaff", mechanical: "#ffaa44", membrane: "#22ccaa", neutral: "#555555",
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
      nkroMax: s.nkroMax, testedKeys: s.testedKeys.size,
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
    if (tab === "event log" && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events, tab]);

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
    <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#00ff88", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#52525b", marginTop: 5 }}>{sub}</div>}
    </div>
  );

  const fmtP = (v: number) => isNaN(v) ? "—" : v < Infinity ? v.toFixed(1) : "—";

  const tabStyle = (t: string) => ({
    padding: "8px 18px", fontSize: 11, letterSpacing: 0.5, fontFamily: "inherit",
    background: tab === t ? "#18181b" : "transparent",
    color: tab === t ? "#fafafa" : "#52525b",
    border: "none", borderRadius: 8, cursor: "pointer" as const, fontWeight: 500,
    transition: "all 0.2s ease",
  });

  const actionBtn = (bg: string, fg: string) => ({
    padding: "7px 14px", fontSize: 10, fontFamily: "inherit", letterSpacing: 0.5,
    background: bg, color: fg,
    border: `1px solid ${fg}20`, borderRadius: 8, cursor: "pointer" as const, fontWeight: 500,
    transition: "all 0.2s ease",
  });

  return (
    <div style={{ color: "#d4d4d8", fontFamily: mono, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#3f3f46", marginBottom: 4 }}>ADVANCED</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#00ff88", letterSpacing: -0.5, margin: "4px 0 10px" }}>KEY DIAGNOSTICS</h1>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: "#71717a", flexWrap: "wrap", alignItems: "center" }}>
          <span>{ds.totalEvents} events</span>
          <span>{ds.totalKeydowns} presses</span>
          <span style={{ color: isRecording ? "#00ff88" : "#ef4444", animation: isRecording ? "blink 1.5s infinite" : "none" }}>
            {isRecording ? "● Recording" : "○ Paused"}
          </span>
        </div>
        {/* Live verdict badge */}
        <div style={{ marginTop: 10 }}>
          <span style={{
            color: verdictColor, fontWeight: 600, fontSize: 12, letterSpacing: 0.5,
            background: `${verdictColor}12`, border: `1px solid ${verdictColor}30`,
            borderRadius: 20, padding: "5px 16px",
            transition: "all 0.4s ease",
          }}>
            {cl.verdict}
          </span>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%", maxWidth: 820, marginBottom: 14 }}>
        <Stat label="Event Rate" value={ds.avgRate > 0 ? `${ds.avgRate.toFixed(0)}Hz` : "—"} sub={`peak ${ds.peakRate > 0 ? ds.peakRate.toFixed(0) + "Hz" : "—"}`} color={rateColor} />
        <Stat label="Min Interval" value={ds.minInterval < Infinity ? `${ds.minInterval.toFixed(2)}ms` : "—"} sub={`max ${ds.maxInterval > 0 ? ds.maxInterval.toFixed(1) + "ms" : "—"}`} color="#d4d4d8" />
        <Stat label="Jitter" value={ds.jitter > 0 ? `±${ds.jitter.toFixed(2)}ms` : "—"} sub="std deviation" color={ds.jitter < 15 ? "#00ff88" : ds.jitter < 50 ? "#ffaa00" : "#ff5555"} />
        <Stat label="NKRO Max" value={ds.nkroMax || "—"} sub={`${ds.currentHeld} held now`} color="#d4d4d8" />
      </div>

      {/* Switch analysis */}
      <div style={{ width: "100%", maxWidth: 820, marginBottom: 14, background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#52525b", textTransform: "uppercase" }}>Switch Type Analysis</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#52525b", background: `${verdictColor}15`, border: `1px solid ${verdictColor}25`, borderRadius: 4, padding: "2px 8px", letterSpacing: 0.5 }}>{cl.confidence}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: verdictColor }}>{cl.verdict}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.6, marginBottom: 14 }}>{cl.description}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {[
            { label: "HOLD P5", value: fmtP(ds.holdP5), sub: "ms", color: ds.holdP5 < 10 ? "#ff44cc" : ds.holdP5 < 25 ? "#44aaff" : ds.holdP5 < 42 ? "#ffaa44" : "#d4d4d8" },
            { label: "REACT P5", value: fmtP(ds.reactP5), sub: "ms", color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#d4d4d8" },
            { label: "MICRO%", value: ds.totalKeyups > 0 ? `${(ds.microRatio * 100).toFixed(1)}` : "—", sub: `<${MICRO_RELEASE_MS}ms`, color: ds.microRatio > 0.2 ? "#ff44cc" : ds.microRatio > 0.05 ? "#44aaff" : "#52525b" },
            { label: "TAP RATE", value: ds.maxTapRate > 0 ? ds.maxTapRate.toFixed(1) : "—", sub: "taps/sec", color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#d4d4d8" },
            { label: "AVG HOLD", value: ds.avgHold > 0 ? ds.avgHold.toFixed(1) : "—", sub: "ms", color: "#d4d4d8" },
            { label: "GHOSTS", value: ds.ghostEvents, sub: "bounce", color: ds.ghostEvents > 3 ? "#ffaa44" : ds.ghostEvents > 0 ? "#ef4444" : "#52525b" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ fontSize: 9, color: "#52525b", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              {item.sub && <div style={{ fontSize: 8, color: "#3f3f46", marginTop: 2 }}>{item.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: "#71717a", lineHeight: 1.6, borderTop: "1px solid #18181b", paddingTop: 10 }}>
          Rapidly tap a single key for 10+ seconds. The tool needs 50+ events. Sub-10ms holds and instant re-activation are physically impossible on mechanical or membrane switches.
        </div>
      </div>

      {/* Controls: tabs on left, actions on right */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", maxWidth: 820, marginBottom: 10, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 4, background: "#09090b", borderRadius: 10, padding: 3, border: "1px solid #18181b" }}>
          {["diagnostics", "event log", "intervals"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setIsRecording(!isRecording)} style={actionBtn(isRecording ? "#1c1917" : "#052e16", isRecording ? "#f97316" : "#22c55e")}>
            {isRecording ? "Pause" : "Resume"}
          </button>
          <button onClick={reset} style={actionBtn("#1c1917", "#ef4444")}>Reset</button>
          <button onClick={downloadReport} style={actionBtn("#0c1222", "#3b82f6")}>Export</button>
        </div>
      </div>

      {/* Content area */}
      <div ref={logRef} style={{
        background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 14,
        width: "100%", maxWidth: 820, height: 420, overflowY: "auto", overflowX: "auto",
      }}>
        {tab === "event log" && (
          <div style={{ minWidth: 600 }}>
            <div style={{ display: "grid", gridTemplateColumns: "72px 42px 52px 72px 82px 72px 1fr", gap: 0, fontSize: 10 }}>
              {["ELAPSED", "TYPE", "KEY", "CODE", "INTERVAL", "Hz", "DETAIL"].map(h => (
                <div key={h} style={{ color: "#52525b", padding: "6px 0", borderBottom: "1px solid #18181b", letterSpacing: 1, fontSize: 9, fontWeight: 500 }}>{h}</div>
              ))}
              {events.map((e, i) => {
                const isDown = e.type === "DOWN";
                return (
                  <React.Fragment key={i}>
                    <div style={{ color: "#52525b", padding: "3px 0" }}>{e.elapsed}s</div>
                    <div style={{ color: isDown ? "#22c55e" : "#52525b", padding: "3px 0", fontWeight: 600 }}>
                      {e.type}{e.repeat ? "®" : ""}
                    </div>
                    <div style={{ color: "#d4d4d8", padding: "3px 0", fontWeight: 600 }}>{e.key}</div>
                    <div style={{ color: "#3f3f46", padding: "3px 0", fontSize: 9 }}>{e.code}</div>
                    <div style={{ color: "#71717a", padding: "3px 0", fontVariantNumeric: "tabular-nums" }}>
                      {e.interval !== "—" ? `${e.interval}ms` : "—"}
                    </div>
                    <div style={{ color: parseFloat(e.hz) > 200 ? "#22c55e" : "#71717a", padding: "3px 0" }}>
                      {e.hz !== "—" ? e.hz : "—"}
                    </div>
                    <div style={{ color: "#52525b", padding: "3px 0", fontSize: 9 }}>{e.extra}</div>
                  </React.Fragment>
                );
              })}
            </div>
            {events.length === 0 && <div style={{ textAlign: "center", color: "#27272a", marginTop: 100, fontSize: 12 }}>Press any key to begin...</div>}
          </div>
        )}

        {tab === "diagnostics" && (
          <div style={{ fontSize: 11, lineHeight: 1.9, color: "#71717a" }}>
            <div style={{ color: "#22c55e", fontSize: 10, letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>SYSTEM DIAGNOSTICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>EVENT TIMING</div>
                <div>Avg event rate: <span style={{ color: rateColor, fontWeight: 700 }}>{ds.avgRate > 0 ? `${ds.avgRate.toFixed(2)} Hz` : "—"}</span></div>
                <div>Peak event rate: <span style={{ color: "#d4d4d8", fontWeight: 600 }}>{ds.peakRate > 0 ? `${ds.peakRate.toFixed(2)} Hz` : "—"}</span></div>
                <div>Min interval: <span style={{ color: "#d4d4d8" }}>{ds.minInterval < Infinity ? `${ds.minInterval.toFixed(3)} ms` : "—"}</span></div>
                <div>Jitter (σ): <span style={{ color: ds.jitter < 15 ? "#22c55e" : "#eab308" }}>{ds.jitter > 0 ? `±${ds.jitter.toFixed(3)} ms` : "—"}</span></div>
                <div>Total events: <span style={{ color: "#d4d4d8" }}>{ds.totalEvents}</span> <span style={{ color: "#52525b", fontSize: 9 }}>({ds.totalKeydowns} presses, {ds.totalKeyups} releases)</span></div>
              </div>
              <div>
                <div style={{ color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>HOLD DURATION DISTRIBUTION</div>
                {ds.totalKeyups > 0 ? (
                  <div style={{ fontSize: 10 }}>
                    {[
                      { label: "P5", val: ds.holdP5 },
                      { label: "P25", val: ds.holdP25 },
                      { label: "P50", val: ds.holdP50 },
                      { label: "P75", val: ds.holdP75 },
                      { label: "P95", val: ds.holdP95 },
                    ].map(({ label, val }) => {
                      const w = !isNaN(val) && ds.holdP95 > 0 ? Math.min(100, (val / ds.holdP95) * 100) : 0;
                      const c = val < 10 ? "#ff44cc" : val < 25 ? "#44aaff" : val < 42 ? "#ffaa44" : "#52525b";
                      return (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ width: 26, textAlign: "right", color: "#52525b", fontSize: 9, fontWeight: 500 }}>{label}</span>
                          <div style={{ flex: 1, height: 7, background: "#18181b", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${w}%`, height: "100%", background: c, borderRadius: 4, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ width: 55, fontSize: 9, color: c, fontWeight: 600, textAlign: "right" }}>{fmtP(val)}ms</span>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 9, color: "#52525b", marginTop: 4 }}>
                      σ = {ds.holdStdDev > 0 ? ds.holdStdDev.toFixed(1) : "—"}ms &nbsp; avg = {ds.avgHold > 0 ? ds.avgHold.toFixed(1) : "—"}ms
                    </div>
                  </div>
                ) : <div style={{ color: "#27272a", fontSize: 10 }}>Press and release keys to see distribution...</div>}
              </div>
            </div>

            {/* Re-activation analysis */}
            <div style={{ marginTop: 16, color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>RE-ACTIVATION ANALYSIS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 11 }}>
              <div>
                <div>Re-activation P5: <span style={{ color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#d4d4d8", fontWeight: 600 }}>{fmtP(ds.reactP5)} ms</span></div>
                <div>Re-activation median: <span style={{ color: "#d4d4d8" }}>{fmtP(ds.reactMedian)} ms</span></div>
                <div>Re-activation min: <span style={{ color: "#d4d4d8" }}>{ds.reactMin < Infinity ? ds.reactMin.toFixed(2) : "—"} ms</span></div>
              </div>
              <div>
                <div>Max tap rate: <span style={{ color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#d4d4d8", fontWeight: 600 }}>{ds.maxTapRate > 0 ? `${ds.maxTapRate.toFixed(1)} taps/sec` : "—"}</span></div>
                <div>Micro-releases: <span style={{ color: ds.microReleases > 3 ? "#eab308" : "#d4d4d8" }}>{ds.microReleases}</span> <span style={{ color: "#52525b", fontSize: 9 }}>({(ds.microRatio * 100).toFixed(1)}%)</span></div>
                <div>Ghost events: <span style={{ color: ds.ghostEvents > 0 ? "#ef4444" : "#d4d4d8" }}>{ds.ghostEvents}</span></div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#52525b", marginTop: 4, lineHeight: 1.6 }}>
              Re-activation = time from releasing a key to pressing the same key again. Mechanical needs {">"}25ms. Rapid trigger can re-actuate in {"<"}5ms.
            </div>

            {/* Classification evidence */}
            {cl.signals.length > 0 && (
              <>
                <div style={{ marginTop: 16, color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>CLASSIFICATION EVIDENCE</div>
                {cl.signals.map((sig, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 10, lineHeight: 1.6 }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: SIGNAL_COLORS[sig.supports], marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <span style={{ color: SIGNAL_COLORS[sig.supports], fontWeight: 600 }}>{sig.name}</span>
                      <span style={{ color: "#71717a" }}> — {sig.finding}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* How to test */}
            <div style={{ marginTop: 16, color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>HOW TO TEST</div>
            <div style={{ fontSize: 10, color: "#71717a", lineHeight: 1.8 }}>
              1. Tap a single key rapidly for 10+ sec — measures hold floor, re-activation, and tap rate<br />
              2. Press and hold 6+ keys — tests N-key rollover<br />
              3. Minimal finger travel during rapid tapping — rapid trigger shows sub-10ms holds<br />
              4. Export the full report as JSON for offline analysis
            </div>
          </div>
        )}

        {tab === "intervals" && (
          <div>
            <div style={{ color: "#22c55e", fontSize: 10, letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>KEYDOWN INTERVAL DISTRIBUTION</div>
            {ds.keydownIntervals.length > 0 ? (
              <React.Fragment>
                <div style={{ display: "flex", alignItems: "flex-end", height: 200, gap: 1, padding: "0 6px" }}>
                  {(() => {
                    const maxVal = Math.max(...ds.keydownIntervals);
                    return ds.keydownIntervals.map((v, i) => {
                      const h = maxVal > 0 ? (v / maxVal) * 180 : 0;
                      const rate = 1000 / v;
                      const color = rate > 30 ? "#22c55e" : rate > 15 ? "#84cc16" : rate > 5 ? "#eab308" : "#ef4444";
                      return (
                        <div key={i} style={{
                          flex: 1, minWidth: 2, maxWidth: 8, height: h, background: color,
                          borderRadius: "2px 2px 0 0", opacity: 0.85,
                        }} title={`${v.toFixed(3)}ms (${rate.toFixed(0)}Hz)`} />
                      );
                    });
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#52525b", marginTop: 6, padding: "0 6px" }}>
                  <span>← older</span>
                  <span>Last 100 keydown intervals — shorter bars = faster</span>
                  <span>newer →</span>
                </div>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10, fontSize: 9 }}>
                  {[
                    { color: "#22c55e", label: ">30Hz" },
                    { color: "#84cc16", label: ">15Hz" },
                    { color: "#eab308", label: ">5Hz" },
                    { color: "#ef4444", label: "<5Hz" },
                  ].map((l, i) => (
                    <span key={i} style={{ color: "#71717a" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: l.color, borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </React.Fragment>
            ) : (
              <div style={{ textAlign: "center", color: "#27272a", marginTop: 80, fontSize: 12 }}>Press keys to see interval histogram...</div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 10, fontSize: 9, color: "#27272a", textAlign: "center", maxWidth: 820, lineHeight: 1.6 }}>
        Browser event timing is limited to ~1-4ms resolution. Classification uses behavioral heuristics, not direct hardware access. Privacy: all processing happens entirely in your browser — no keystroke data is collected, transmitted, or stored on any server.
      </div>
    </div>
  );
}
