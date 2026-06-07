"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// CONSTANTS
// ============================================================

const MICRO_RELEASE_MS = 20;
const HOLD_CAP_MS = 3000;       // ignore accidental holds > 3s (e.g. walking away)
const ROLLING_WINDOW_MS = 3000; // sliding window for "current" rate display
const EMPTY = "--";

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
  Slash: "/", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Delete: "Del", Insert: "Ins", Home: "Home", End: "End", PageUp: "PgUp", PageDown: "PgDn",
  ControlLeft: "LCtrl", ControlRight: "RCtrl",
  MetaLeft: "Win", MetaRight: "Win", AltLeft: "LAlt", AltRight: "RAlt",
  Space: "Space", ContextMenu: "Menu", NumLock: "Num",
  F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  Backquote: "`", PrintScreen: "PrtSc", ScrollLock: "ScrLk", Pause: "Pause",
  // Numpad — separate physical keys from main digits
  Numpad0: "N0", Numpad1: "N1", Numpad2: "N2", Numpad3: "N3", Numpad4: "N4",
  Numpad5: "N5", Numpad6: "N6", Numpad7: "N7", Numpad8: "N8", Numpad9: "N9",
  NumpadAdd: "N+", NumpadSubtract: "N-", NumpadMultiply: "N*", NumpadDivide: "N/",
  NumpadDecimal: "N.", NumpadEnter: "NEntr",
};

// ============================================================
// KEYBOARD LAYOUT (ANSI)
// ============================================================

interface KDef { code: string; label: string; w: number }
interface KSpacer { spacer: true; w: number }
type KItem = KDef | KSpacer;
const isSpacer = (item: KItem): item is KSpacer => "spacer" in item;

const LAYOUT: KItem[][] = [
  [
    { code: "Escape", label: "ESC", w: 1 },
    { spacer: true, w: 1 },
    { code: "F1", label: "F1", w: 1 }, { code: "F2", label: "F2", w: 1 },
    { code: "F3", label: "F3", w: 1 }, { code: "F4", label: "F4", w: 1 },
    { spacer: true, w: 0.5 },
    { code: "F5", label: "F5", w: 1 }, { code: "F6", label: "F6", w: 1 },
    { code: "F7", label: "F7", w: 1 }, { code: "F8", label: "F8", w: 1 },
    { spacer: true, w: 0.5 },
    { code: "F9", label: "F9", w: 1 }, { code: "F10", label: "F10", w: 1 },
    { code: "F11", label: "F11", w: 1 }, { code: "F12", label: "F12", w: 1 },
  ],
  [
    { code: "Backquote", label: "`", w: 1 },
    { code: "Digit1", label: "1", w: 1 }, { code: "Digit2", label: "2", w: 1 },
    { code: "Digit3", label: "3", w: 1 }, { code: "Digit4", label: "4", w: 1 },
    { code: "Digit5", label: "5", w: 1 }, { code: "Digit6", label: "6", w: 1 },
    { code: "Digit7", label: "7", w: 1 }, { code: "Digit8", label: "8", w: 1 },
    { code: "Digit9", label: "9", w: 1 }, { code: "Digit0", label: "0", w: 1 },
    { code: "Minus", label: "-", w: 1 }, { code: "Equal", label: "=", w: 1 },
    { code: "Backspace", label: "BKSP", w: 2 },
  ],
  [
    { code: "Tab", label: "TAB", w: 1.5 },
    { code: "KeyQ", label: "Q", w: 1 }, { code: "KeyW", label: "W", w: 1 },
    { code: "KeyE", label: "E", w: 1 }, { code: "KeyR", label: "R", w: 1 },
    { code: "KeyT", label: "T", w: 1 }, { code: "KeyY", label: "Y", w: 1 },
    { code: "KeyU", label: "U", w: 1 }, { code: "KeyI", label: "I", w: 1 },
    { code: "KeyO", label: "O", w: 1 }, { code: "KeyP", label: "P", w: 1 },
    { code: "BracketLeft", label: "[", w: 1 }, { code: "BracketRight", label: "]", w: 1 },
    { code: "Backslash", label: "\\", w: 1.5 },
  ],
  [
    { code: "CapsLock", label: "CAPS", w: 1.75 },
    { code: "KeyA", label: "A", w: 1 }, { code: "KeyS", label: "S", w: 1 },
    { code: "KeyD", label: "D", w: 1 }, { code: "KeyF", label: "F", w: 1 },
    { code: "KeyG", label: "G", w: 1 }, { code: "KeyH", label: "H", w: 1 },
    { code: "KeyJ", label: "J", w: 1 }, { code: "KeyK", label: "K", w: 1 },
    { code: "KeyL", label: "L", w: 1 }, { code: "Semicolon", label: ";", w: 1 },
    { code: "Quote", label: "'", w: 1 },
    { code: "Enter", label: "ENTER", w: 2.25 },
  ],
  [
    { code: "ShiftLeft", label: "SHIFT", w: 2.25 },
    { code: "KeyZ", label: "Z", w: 1 }, { code: "KeyX", label: "X", w: 1 },
    { code: "KeyC", label: "C", w: 1 }, { code: "KeyV", label: "V", w: 1 },
    { code: "KeyB", label: "B", w: 1 }, { code: "KeyN", label: "N", w: 1 },
    { code: "KeyM", label: "M", w: 1 }, { code: "Comma", label: ",", w: 1 },
    { code: "Period", label: ".", w: 1 }, { code: "Slash", label: "/", w: 1 },
    { code: "ShiftRight", label: "SHIFT", w: 2.75 },
  ],
  [
    { code: "ControlLeft", label: "CTRL", w: 1.25 },
    { code: "MetaLeft", label: "WIN", w: 1.25 },
    { code: "AltLeft", label: "ALT", w: 1.25 },
    { code: "Space", label: "", w: 6.25 },
    { code: "AltRight", label: "ALT", w: 1.25 },
    { code: "MetaRight", label: "WIN", w: 1.25 },
    { code: "ContextMenu", label: "FN", w: 1.25 },
    { code: "ControlRight", label: "CTRL", w: 1.25 },
  ],
];

// ============================================================
// TYPES
// ============================================================

interface KeyEvent {
  displayKey: string;
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
  // Timing
  keydownIntervals: number[];       // between consecutive non-repeat keydowns (for avg rate)
  rollingKdTimestamps: number[];    // timestamps of recent keydowns (for rolling rate)
  lastKeydownTime: number | null;
  lastEventTime: number | null;     // for event log interval column only
  // Counts — repeats excluded
  totalKeydowns: number;
  totalKeyups: number;
  // Physical key state — ALL keyed by e.code for correctness
  heldCodes: Set<string>;           // currently held physical keys
  keyDownTimes: Record<string, number>;    // code → keydown timestamp
  keyUpTimes: Record<string, number>;      // code → last keyup timestamp
  lastKeydownPerKey: Record<string, number>; // code → last keydown timestamp (for tap interval)
  // NKRO
  nkroMax: number;
  // Per-key stats
  testedCodes: Set<string>;
  keyPressCount: Record<string, number>;  // code → press count
  maxSingleKeyPresses: number;
  // Hold distribution
  holdDurations: number[];          // capped at HOLD_CAP_MS, excludes modifier-only holds
  microReleases: number;
  // Reactivation (same physical key: up→down gap)
  reactivationGaps: number[];
  // Same-key tap cycle (keydown→keydown of same key)
  sameKeyTapIntervals: number[];
  // Bounce detection
  bounceEvents: number;
  // WPM
  typingChars: number;
  typingStartTime: number | null;
}

interface ClassSignal {
  name: string;
  finding: string;
  supports: "rapid_trigger" | "magnetic" | "mechanical" | "membrane" | "scissor" | "neutral";
}

interface Classification {
  verdict: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  signals: ClassSignal[];
}

interface DisplayStats {
  avgRate: number;
  rollingRate: number;
  peakRate: number;
  minInterval: number;
  maxInterval: number;
  jitter: number;
  totalKeydowns: number;
  totalKeyups: number;
  nkroMax: number;
  currentHeld: number;
  testedCount: number;
  bounceEvents: number;
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
  pressedCodes: Set<string>;
  testedCodes: Set<string>;
  keyPressCount: Record<string, number>;
  wpm: number;
  maxSingleKeyPresses: number;
  // total meaningful events (no repeats) for threshold checks
  totalEvents: number;
}

// ============================================================
// CLASSIFICATION ENGINE
// ============================================================

function classifySwitch(m: {
  holdP5: number; holdMean: number; holdStdDev: number;
  reactP5: number; reactMin: number;
  microRatio: number; maxTapRate: number;
  bounceEvents: number; totalEvents: number; totalKeyups: number;
  holdCount: number; reactCount: number;
  nkroMax: number; testedKeys: number;
  maxSingleKeyPresses: number;
}): Classification {
  if (m.totalEvents < 50) {
    return {
      verdict: "NEED MORE DATA",
      confidence: "LOW",
      description: "Type naturally or rapidly tap a single key to generate at least 50 physical press/release events.",
      signals: [],
    };
  }

  const signals: ClassSignal[] = [];
  let rt = 0, mag = 0, mech = 0, mem = 0, sc = 0;

  // ── Signal 1: NKRO (weight up to 3.0) ──────────────────────
  // Hardware signal — membrane matrix physically limits simultaneous keys.
  // Most reliable differentiator because it's not affected by typing speed.
  if (m.testedKeys >= 6) {
    if (m.nkroMax <= 3) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — strong indicator of membrane matrix. Mechanical/magnetic keyboards register 6+ simultaneously.`, supports: "membrane" });
      mem += 3.0;
    } else if (m.nkroMax === 4) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — limited rollover, common in membrane. Press 6+ keys at once for a definitive reading.`, supports: "membrane" });
      mem += 1.5;
    } else if (m.nkroMax >= 10) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — full NKRO, typical of mechanical (diode matrix) or magnetic keyboards.`, supports: "mechanical" });
      mech += 1.5; mag += 0.5;
    } else if (m.nkroMax >= 7) {
      signals.push({ name: "Key Rollover", finding: `Max ${m.nkroMax} simultaneous keys — good rollover capacity, consistent with mechanical or better membrane.`, supports: "mechanical" });
      mech += 0.5;
    }
  }

  // ── Signal 2: Hold Duration Floor — P5 (weight up to 2.0) ──
  // P5 of hold durations = the shortest 5% of holds.
  // Sub-15ms is only achievable with non-contact sensors (RT/magnetic).
  // 15-42ms is mechanical spring territory.
  // Above 55ms without rapid-tap evidence = membrane rubber dome.
  const didRapidTap = m.maxSingleKeyPresses >= 30;
  if (m.holdCount >= 10 && !isNaN(m.holdP5)) {
    const p5 = m.holdP5;
    if (p5 < 8) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — sub-8ms holds are physically impossible without non-contact sensing. Rapid trigger confirmed.`, supports: "rapid_trigger" });
      rt += 2.0; mag += 0.5;
    } else if (p5 < 15) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — well below mechanical spring floor (~30ms). Consistent with magnetic hall-effect switches.`, supports: "magnetic" });
      mag += 1.5;
    } else if (p5 < 25) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — short holds. Could be magnetic switches or very deliberate fast mechanical tapping.`, supports: "neutral" });
    } else if (p5 < 42) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — consistent with mechanical switch spring travel (2-4mm + firmware debounce).`, supports: "mechanical" });
      mech += 1.5;
    } else if (p5 < 55) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — ambiguous zone (42-55ms). All switch types produce this during normal typing. Complete the rollover and rapid-tap tests.`, supports: "neutral" });
    } else if (p5 < 65) {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — slightly elevated. May indicate rubber dome. Rollover test needed for confirmation.`, supports: "neutral" });
    } else {
      signals.push({ name: "Hold Duration Floor", finding: `P5 = ${p5.toFixed(1)}ms — elevated floor typical of membrane rubber dome keyboards.`, supports: "membrane" });
      mem += 1.0;
    }
  }

  // ── Signal 3: Same-key Re-activation P5 (weight up to 1.5) ──
  // Measures the up→down gap for repeated presses of the same key.
  // Only meaningful when the user deliberately rapid-tapped one key.
  if (m.reactCount >= 5 && !isNaN(m.reactP5)) {
    const rp5 = m.reactP5;
    if (rp5 < 8) {
      signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — near-instant re-activation. Hallmark of rapid trigger (0.1mm reset).`, supports: "rapid_trigger" });
      rt += 1.5; mag += 0.5;
    } else if (rp5 < 20) {
      signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — very fast re-activation, below mechanical spring reset time (~25ms).`, supports: "magnetic" });
      mag += 1.5;
    } else if (rp5 >= 100 && didRapidTap) {
      signals.push({ name: "Re-activation Speed", finding: `P5 = ${rp5.toFixed(1)}ms — slow re-activation during rapid tapping, consistent with rubber dome rebound delay.`, supports: "membrane" });
      mem += 1.0;
    }
  }

  // ── Signal 4: Re-activation Floor (weight up to 2.5) ──────
  // Fastest single same-key re-activation. Only scored when user did rapid tapping,
  // because during normal typing this just reflects natural typing cadence.
  if (m.reactCount >= 3 && m.reactMin < Infinity) {
    if (m.reactMin < 5) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(1)}ms — near-instant, only possible with rapid trigger hardware.`, supports: "rapid_trigger" });
      rt += 1.5;
    } else if (m.reactMin < 15) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(1)}ms — very fast minimum, consistent with magnetic hall-effect switches.`, supports: "magnetic" });
      mag += 1.0;
    } else if (m.reactMin > 55 && didRapidTap) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(1)}ms during rapid tapping — rubber dome membranes physically cannot reset faster than ~55ms.`, supports: "membrane" });
      mem += 2.5;
    } else if (m.reactMin > 55 && !didRapidTap) {
      signals.push({ name: "Re-activation Floor", finding: `Min = ${m.reactMin.toFixed(1)}ms — but no rapid-tap evidence yet. Tap a single key 30+ times rapidly for this signal to be meaningful.`, supports: "neutral" });
    }
  }

  // ── Signal 5: Micro-release Ratio (weight up to 2.5) ──────
  // Sub-20ms holds are physically impossible with spring or dome travel.
  // Only non-contact sensors (hall-effect + RT) can produce them.
  if (m.totalKeyups >= 20) {
    if (m.microRatio > 0.2) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% of holds <${MICRO_RELEASE_MS}ms — strong rapid trigger indicator (impossible with physical travel).`, supports: "rapid_trigger" });
      rt += 2.5;
    } else if (m.microRatio > 0.05) {
      signals.push({ name: "Micro-release Ratio", finding: `${(m.microRatio * 100).toFixed(1)}% micro-releases — consistent with magnetic hall-effect switches.`, supports: "magnetic" });
      mag += 1.5;
    }
  }

  // ── Signal 6: Contact Bounce Events (weight up to 1.0) ────
  // A "bounce event" is a second keydown on the same physical key before its keyup —
  // indicating firmware debounce failure (metal contact bounce).
  // Note: focus changes can also cause stale held-key state, so this has some
  // false-positive risk and is weighted conservatively.
  if (m.totalKeyups >= 100) {
    if (m.bounceEvents > 5) {
      signals.push({ name: "Contact Bounce", finding: `${m.bounceEvents} bounce events — repeated keydown without intermediate keyup. Indicates firmware debounce failure, more common in cheap mechanical keyboards.`, supports: "mechanical" });
      mech += 1.0;
    } else if (m.bounceEvents === 0 && m.totalKeyups >= 200) {
      signals.push({ name: "Contact Bounce", finding: `0 bounce events over ${m.totalKeyups} keyups — clean signaling. Consistent with good firmware debounce, membrane, or magnetic (non-contact) keyboards.`, supports: "neutral" });
    }
  }

  // ── Signal 7: Hold Consistency (weight up to 0.5) ─────────
  if (m.holdCount >= 20 && m.holdMean > 0) {
    const cv = m.holdStdDev / m.holdMean;
    if (cv < 0.15 && m.holdMean < 30) {
      signals.push({ name: "Hold Consistency", finding: `CV = ${cv.toFixed(2)} with mean ${m.holdMean.toFixed(0)}ms — very uniform short holds, typical of analog hall-effect sensing.`, supports: "magnetic" });
      mag += 0.5;
    }
  }

  // ── Signal 8: Peak Tap Rate (weight up to 0.5) ────────────
  // Computed from P5 of keydown-to-keydown intervals on the SAME key.
  // Only scored at extremes — average human max ~15-20 taps/sec on mechanical.
  if (m.maxTapRate > 30) {
    signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — exceeds mechanical/membrane physical limits (~20-25/sec). Rapid trigger territory.`, supports: "rapid_trigger" });
    rt += 0.5; mag += 0.3;
  } else if (m.maxTapRate > 20) {
    signals.push({ name: "Peak Tap Rate", finding: `${m.maxTapRate.toFixed(1)} taps/sec — at or above the mechanical capability ceiling.`, supports: "magnetic" });
    mag += 0.3;
  }

  // ── Signal 9: Scissor Switch Signature (compound) ─────────
  // Scissor switches have moderate hold (42-65ms) but faster reactivation
  // than standard membrane, because their small dome reforms faster.
  if (m.holdCount >= 10 && m.reactCount >= 3 && !isNaN(m.holdP5) && m.reactMin < Infinity) {
    const p5 = m.holdP5;
    const isScissorHoldRange = p5 >= 42 && p5 <= 65;
    const isScissorReactMin = m.reactMin < 35;
    const isScissorReactP5 = !isNaN(m.reactP5) && m.reactP5 < 80;

    if (isScissorHoldRange && isScissorReactMin) {
      signals.push({
        name: "Scissor Switch Signature",
        finding: `Hold P5 = ${p5.toFixed(1)}ms (42-65ms range) + React Min = ${m.reactMin.toFixed(1)}ms (<35ms). Standard dome membranes need 55ms+ to reform; scissor domes with ~1mm travel reform much faster.`,
        supports: "scissor",
      });
      sc += 1.5;
      if (isScissorReactP5) {
        signals.push({
          name: "Scissor Reactivation Profile",
          finding: `React P5 = ${m.reactP5.toFixed(1)}ms (<80ms) — consistent with low-profile scissor mechanism (faster than standard membrane, typically >85ms).`,
          supports: "scissor",
        });
        sc += 1.0;
      }
    }
  }

  // ── Verdict ────────────────────────────────────────────────
  const total = rt + mag + mech + mem + sc;
  const maxScore = Math.max(rt, mag, mech, mem, sc);
  const conclusive = signals.length >= 2 || maxScore >= 2.5 || (total >= 1.5 && signals.length >= 1);

  if (!conclusive) {
    const hints: string[] = [];
    if (m.nkroMax < 6 || m.testedKeys < 6) hints.push("press 6+ keys simultaneously to test rollover");
    if (m.maxSingleKeyPresses < 30) hints.push("rapidly tap a single key 30+ times");
    if (hints.length === 0) hints.push("try rapid trigger micro-tapping if your keyboard supports it");
    return {
      verdict: "INCONCLUSIVE",
      confidence: "LOW",
      description: `Data is ambiguous — during normal typing, mechanical and magnetic keyboards produce nearly identical patterns. To get a definitive result: ${hints.join("; ")}.`,
      signals,
    };
  }

  const dominance = maxScore / total;
  const dataRich = m.totalKeyups >= 100 && m.holdCount >= 30;
  const conf: "HIGH" | "MEDIUM" | "LOW" =
    dominance > 0.5 && dataRich && total >= 2.0 ? "HIGH" : dominance > 0.35 ? "MEDIUM" : "LOW";

  if (rt >= mag && rt >= mech && rt >= mem && rt >= sc) {
    return { verdict: "RAPID TRIGGER", confidence: conf, description: "Magnetic hall-effect switches with rapid trigger enabled. Ultra-short holds and near-instant re-activation detected — physically impossible on mechanical or membrane.", signals };
  } else if (mag >= mech && mag >= mem && mag >= sc) {
    return { verdict: "LIKELY MAGNETIC", confidence: conf, description: "Characteristics consistent with magnetic hall-effect switches. Clean timing, short hold durations, and no contact bounce.", signals };
  } else if (sc >= mech && sc >= mem) {
    return { verdict: "LIKELY SCISSOR", confidence: conf, description: "Characteristics consistent with scissor (low-profile) switches, typically found in laptop keyboards. Moderate hold times with faster-than-membrane reactivation indicate a small dome with ~1mm travel.", signals };
  } else if (mem > mech) {
    return { verdict: "LIKELY MEMBRANE", confidence: conf, description: "Characteristics consistent with membrane (rubber dome) keyboard. Limited key rollover and/or elevated hold durations indicate rubber dome construction.", signals };
  } else {
    return { verdict: "LIKELY MECHANICAL", confidence: conf, description: "Characteristics consistent with mechanical switches. Hold patterns match spring-based travel and firmware debounce. Note: magnetic switches without rapid trigger produce identical patterns during normal typing.", signals };
  }
}

// ============================================================
// HELPERS
// ============================================================

const VERDICT_COLORS: Record<string, string> = {
  "RAPID TRIGGER": "#ff44cc",
  "LIKELY MAGNETIC": "#44aaff",
  "LIKELY MECHANICAL": "#ffaa44",
  "LIKELY SCISSOR": "#b388ff",
  "LIKELY MEMBRANE": "#22ccaa",
  "INCONCLUSIVE": "#888888",
  "NEED MORE DATA": "#555555",
};
const SIGNAL_COLORS: Record<string, string> = {
  rapid_trigger: "#ff44cc", magnetic: "#44aaff", mechanical: "#ffaa44",
  membrane: "#22ccaa", scissor: "#b388ff", neutral: "#555555",
};

function createFreshStats(): InternalStats {
  return {
    keydownIntervals: [],
    rollingKdTimestamps: [],
    lastKeydownTime: null,
    lastEventTime: null,
    totalKeydowns: 0,
    totalKeyups: 0,
    heldCodes: new Set(),
    keyDownTimes: {},
    keyUpTimes: {},
    lastKeydownPerKey: {},
    nkroMax: 0,
    testedCodes: new Set(),
    keyPressCount: {},
    maxSingleKeyPresses: 0,
    holdDurations: [],
    microReleases: 0,
    reactivationGaps: [],
    sameKeyTapIntervals: [],
    bounceEvents: 0,
    typingChars: 0,
    typingStartTime: null,
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

function isInteractiveElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("a, button, input, select, textarea, [contenteditable='true']") !== null)
  );
}

// Measure browser's performance.now() resolution by sampling 50 consecutive calls.
function measureTimingResolutionMs(): number {
  const samples: number[] = [];
  let prev = performance.now();
  for (let i = 0; i < 200; i++) {
    const now = performance.now();
    const delta = now - prev;
    if (delta > 0) samples.push(delta);
    prev = now;
  }
  if (samples.length === 0) return 1;
  samples.sort((a, b) => a - b);
  return samples[0]; // smallest non-zero step = resolution
}

function createEmptyDisplayStats(): DisplayStats {
  const empty = classifySwitch({
    holdP5: NaN, holdMean: 0, holdStdDev: 0,
    reactP5: NaN, reactMin: Infinity,
    microRatio: 0, maxTapRate: 0,
    bounceEvents: 0, totalEvents: 0, totalKeyups: 0,
    holdCount: 0, reactCount: 0, nkroMax: 0, testedKeys: 0, maxSingleKeyPresses: 0,
  });
  return {
    avgRate: 0, rollingRate: 0, peakRate: 0, minInterval: Infinity, maxInterval: 0, jitter: 0,
    totalKeydowns: 0, totalKeyups: 0,
    nkroMax: 0, currentHeld: 0, testedCount: 0,
    bounceEvents: 0, microReleases: 0,
    avgHold: 0, minHold: Infinity,
    holdP5: NaN, holdP25: NaN, holdP50: NaN, holdP75: NaN, holdP95: NaN, holdStdDev: 0,
    reactP5: NaN, reactMedian: NaN, reactMin: Infinity,
    maxTapRate: 0, microRatio: 0,
    classification: empty,
    keydownIntervals: [],
    pressedCodes: new Set(),
    testedCodes: new Set(),
    keyPressCount: {},
    wpm: 0,
    maxSingleKeyPresses: 0,
    totalEvents: 0,
  };
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#00ff88", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#52525b", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function KeyboardTester() {
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const [tab, setTab] = useState("diagnostics");
  const [isRecording, setIsRecording] = useState(true);
  const [isCaptureFocused, setIsCaptureFocused] = useState(false);
  const [timingResMs, setTimingResMs] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<KeyEvent[]>([]);
  const startRef = useRef(0);
  const statsRef = useRef<InternalStats>(createFreshStats());

  // Measure timing resolution once on mount
  useEffect(() => {
    startRef.current = performance.now();
    setTimingResMs(measureTimingResolutionMs());
    requestAnimationFrame(() => { containerRef.current?.focus(); });
  }, []);

  // ── Stats computation ──────────────────────────────────────
  const getStats = useCallback((): DisplayStats => {
    const s = statsRef.current;
    const now = performance.now();

    // Rolling rate: keydowns in the last ROLLING_WINDOW_MS
    const cutoff = now - ROLLING_WINDOW_MS;
    const recentKds = s.rollingKdTimestamps.filter(t => t >= cutoff);
    const rollingRate = recentKds.length > 1
      ? (recentKds.length - 1) / (ROLLING_WINDOW_MS / 1000)
      : 0;

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

    const totalKeyups = s.totalKeyups;
    const microRatio = totalKeyups > 0 ? s.microReleases / totalKeyups : 0;
    const totalEvents = s.totalKeydowns + totalKeyups;

    const classification = classifySwitch({
      holdP5, holdMean: avgHold, holdStdDev,
      reactP5, reactMin,
      microRatio, maxTapRate,
      bounceEvents: s.bounceEvents,
      totalEvents,
      totalKeyups,
      holdCount: holds.length,
      reactCount: s.reactivationGaps.length,
      nkroMax: s.nkroMax,
      testedKeys: s.testedCodes.size,
      maxSingleKeyPresses: s.maxSingleKeyPresses,
    });

    const elapsedMinutes = s.typingStartTime !== null ? (now - s.typingStartTime) / 60000 : 0;
    const wpm = elapsedMinutes > 0.05 ? (s.typingChars / elapsedMinutes) / 5 : 0;

    return {
      avgRate, rollingRate, peakRate, minInterval, maxInterval, jitter,
      totalKeydowns: s.totalKeydowns,
      totalKeyups,
      nkroMax: s.nkroMax,
      currentHeld: s.heldCodes.size,
      testedCount: s.testedCodes.size,
      bounceEvents: s.bounceEvents,
      microReleases: s.microReleases,
      avgHold, minHold,
      holdP5, holdP25, holdP50, holdP75, holdP95, holdStdDev,
      reactP5, reactMedian, reactMin,
      maxTapRate, microRatio,
      classification,
      keydownIntervals: [...s.keydownIntervals.slice(-100)],
      pressedCodes: new Set(s.heldCodes),
      testedCodes: new Set(s.testedCodes),
      keyPressCount: { ...s.keyPressCount },
      wpm,
      maxSingleKeyPresses: s.maxSingleKeyPresses,
      totalEvents,
    };
  }, []);

  const [displayStats, setDisplayStats] = useState<DisplayStats>(createEmptyDisplayStats);

  const addEvent = useCallback((evt: KeyEvent) => {
    eventsRef.current = [...eventsRef.current.slice(-500), evt];
    setEvents([...eventsRef.current]);
    setDisplayStats(getStats());
  }, [getStats]);

  // ── Event handlers ─────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;

    // We capture ALL keys when the tester has focus — including modifier combos.
    // e.preventDefault() prevents browser shortcuts; only true OS-level shortcuts
    // (Ctrl+W, Ctrl+T) may pass through depending on the browser.
    const canCapture = (event: KeyboardEvent): boolean => {
      if (!containerRef.current) return false;
      if (event.defaultPrevented) return false;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return false;
      if (!containerRef.current.contains(activeElement)) return false;
      return !isInteractiveElement(event.target);
    };

    const handleDown = (e: KeyboardEvent) => {
      if (!canCapture(e)) return;
      e.preventDefault();

      const s = statsRef.current;
      const now = performance.now();
      // physKey = e.code: unique physical key identifier (e.g. "ShiftLeft" vs "ShiftRight")
      const physKey = e.code;
      const displayKey = KEY_CODE_MAP[physKey] ?? e.key;

      // Interval between this event and the last (any type) — for event log display only
      const eventInterval = s.lastEventTime !== null ? (now - s.lastEventTime) : null;
      s.lastEventTime = now;

      // Only count non-repeat events as real keydowns
      if (e.repeat) {
        // Still log the repeat event for the event log, but don't count it anywhere else
        addEvent({
          displayKey, code: physKey, type: "DOWN", repeat: true,
          interval: eventInterval !== null ? eventInterval.toFixed(3) : EMPTY,
          hz: eventInterval !== null && eventInterval > 0 ? (1000 / eventInterval).toFixed(1) : EMPTY,
          elapsed: ((now - startRef.current) / 1000).toFixed(3),
          extra: "REPEAT",
          timestampMs: now, elapsedMs: now - startRef.current,
          intervalMs: eventInterval, holdMs: null, reactivationMs: null,
        });
        return;
      }

      // — Physical keydown (non-repeat) —
      const kdInterval = s.lastKeydownTime !== null ? (now - s.lastKeydownTime) : null;
      s.lastKeydownTime = now;
      s.totalKeydowns++;

      if (kdInterval !== null && kdInterval > 0) {
        s.keydownIntervals = [...s.keydownIntervals.slice(-499), kdInterval];
      }

      // Rolling rate window: keep timestamps for last ROLLING_WINDOW_MS + buffer
      s.rollingKdTimestamps = [...s.rollingKdTimestamps.slice(-999), now]
        .filter(t => t >= now - ROLLING_WINDOW_MS - 500);

      // Same-key re-activation gap (up→down of this physical key)
      let reactivationGap: number | null = null;
      const lastUp = s.keyUpTimes[physKey];
      if (lastUp !== undefined) {
        reactivationGap = now - lastUp;
        s.reactivationGaps = [...s.reactivationGaps.slice(-299), reactivationGap];
      }

      // Same-key tap cycle interval (keydown→keydown of this physical key)
      const lastDown = s.lastKeydownPerKey[physKey];
      if (lastDown !== undefined) {
        const tapInterval = now - lastDown;
        s.sameKeyTapIntervals = [...s.sameKeyTapIntervals.slice(-299), tapInterval];
      }
      s.lastKeydownPerKey[physKey] = now;

      // Contact bounce detection: non-repeat keydown while this key is already "held"
      // (can happen on debounce failure; also possible after a missed keyup from focus loss)
      if (s.heldCodes.has(physKey)) {
        s.bounceEvents++;
      }
      s.keyDownTimes[physKey] = now;

      // Per-code press count
      s.keyPressCount[physKey] = (s.keyPressCount[physKey] || 0) + 1;
      s.maxSingleKeyPresses = Math.max(s.maxSingleKeyPresses, s.keyPressCount[physKey]);

      // WPM: count alpha, digit, and space keys
      if (physKey.startsWith("Key") || physKey.startsWith("Digit") || physKey === "Space") {
        if (s.typingStartTime === null) s.typingStartTime = now;
        s.typingChars++;
      }

      s.heldCodes.add(physKey);
      s.nkroMax = Math.max(s.nkroMax, s.heldCodes.size);
      s.testedCodes.add(physKey);

      addEvent({
        displayKey, code: physKey, type: "DOWN", repeat: false,
        interval: eventInterval !== null ? eventInterval.toFixed(3) : EMPTY,
        hz: eventInterval !== null && eventInterval > 0 ? (1000 / eventInterval).toFixed(1) : EMPTY,
        elapsed: ((now - startRef.current) / 1000).toFixed(3),
        extra: reactivationGap !== null ? `react: ${reactivationGap.toFixed(1)}ms` : "",
        timestampMs: now, elapsedMs: now - startRef.current,
        intervalMs: eventInterval, holdMs: null, reactivationMs: reactivationGap,
      });
    };

    const handleUp = (e: KeyboardEvent) => {
      if (!canCapture(e)) return;
      e.preventDefault();

      const s = statsRef.current;
      const now = performance.now();
      const physKey = e.code;
      const displayKey = KEY_CODE_MAP[physKey] ?? e.key;

      const eventInterval = s.lastEventTime !== null ? (now - s.lastEventTime) : null;
      s.lastEventTime = now;
      s.totalKeyups++;

      const downTime = s.keyDownTimes[physKey];
      let holdDuration: number | null = null;
      if (downTime !== undefined) {
        holdDuration = now - downTime;
        // Cap at HOLD_CAP_MS to ignore accidental holds (walked away, focus loss, etc.)
        if (holdDuration <= HOLD_CAP_MS) {
          s.holdDurations = [...s.holdDurations.slice(-299), holdDuration];
          if (holdDuration < MICRO_RELEASE_MS) s.microReleases++;
        }
        delete s.keyDownTimes[physKey];
      }

      s.keyUpTimes[physKey] = now;
      s.heldCodes.delete(physKey);

      addEvent({
        displayKey, code: physKey, type: "UP", repeat: false,
        interval: eventInterval !== null ? eventInterval.toFixed(3) : EMPTY,
        hz: eventInterval !== null && eventInterval > 0 ? (1000 / eventInterval).toFixed(1) : EMPTY,
        elapsed: ((now - startRef.current) / 1000).toFixed(3),
        extra: holdDuration !== null ? `hold: ${holdDuration.toFixed(1)}ms` : "",
        timestampMs: now, elapsedMs: now - startRef.current,
        intervalMs: eventInterval, holdMs: holdDuration, reactivationMs: null,
      });
    };

    // Clear held-key state when window loses focus.
    // Without this, any key held when focus leaves stays "held" forever,
    // causing the next press of that key to be counted as a bounce event.
    const handleBlur = () => {
      const s = statsRef.current;
      s.heldCodes.clear();
      s.keyDownTimes = {};
      // Don't clear keyUpTimes — reactivation tracking across focus changes is still valid
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isRecording, addEvent]);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab === "event log" && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events, tab]);

  // ── Actions ────────────────────────────────────────────────
  const reset = () => {
    eventsRef.current = [];
    setEvents([]);
    startRef.current = performance.now();
    statsRef.current = createFreshStats();
    setDisplayStats(getStats());
    setIsRecording(true);
    requestAnimationFrame(() => { containerRef.current?.focus(); });
  };

  const downloadReport = () => {
    const ds = displayStats;
    const report = {
      version: "3.0",
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      timingResolutionMs: timingResMs,
      testDurationSec: parseFloat(((performance.now() - startRef.current) / 1000).toFixed(1)),
      analysis: {
        verdict: ds.classification.verdict,
        confidence: ds.classification.confidence,
        description: ds.classification.description,
        keydownRate: {
          avgHz: +ds.avgRate.toFixed(2),
          rollingHz: +ds.rollingRate.toFixed(2),
          peakHz: +ds.peakRate.toFixed(2),
          minIntervalMs: ds.minInterval < Infinity ? +ds.minInterval.toFixed(3) : null,
        },
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
        nkroMax: ds.nkroMax,
        bounceEvents: ds.bounceEvents,
        totalKeydowns: ds.totalKeydowns,
        totalKeyups: ds.totalKeyups,
        totalPhysicalEvents: ds.totalEvents,
        keysTestedCount: ds.testedCount,
        wpm: +ds.wpm.toFixed(1),
        signals: ds.classification.signals,
      },
      events: eventsRef.current.map(e => ({
        elapsedMs: +e.elapsedMs.toFixed(3), type: e.type, key: e.displayKey,
        code: e.code, repeat: e.repeat,
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

  // ── Render setup ───────────────────────────────────────────
  const ds = displayStats;
  const cl = ds.classification;
  const verdictColor = VERDICT_COLORS[cl.verdict] || "#888";
  const rateDisplay = ds.rollingRate > 0 ? ds.rollingRate : ds.avgRate;
  const rateColor = rateDisplay > 30 ? "#00ff88" : rateDisplay > 15 ? "#88ff00" : rateDisplay > 5 ? "#c0c8d0" : "#5a6068";
  const captureStatusColor = isCaptureFocused ? "#22c55e" : "#71717a";
  const captureStatusText = isCaptureFocused
    ? (isRecording ? "Capture armed — type to begin testing" : "Focused but paused")
    : "Click inside to arm keyboard capture";
  const mono = "var(--font-mono, 'JetBrains Mono'), 'SF Mono', 'Fira Code', monospace";
  const fmtP = (v: number) => isNaN(v) ? EMPTY : v < Infinity ? v.toFixed(1) : EMPTY;
  const timingWarn = timingResMs !== null && timingResMs > 2;

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

  const testChecks = [
    { done: ds.totalEvents >= 50, label: "Basic typing (50+ events)" },
    { done: ds.maxSingleKeyPresses >= 30, label: "Single-key rapid tap (30+ on one key)" },
    { done: ds.nkroMax >= 6, label: "Rollover test (6+ keys at once)" },
    { done: ds.testedCount >= 8, label: "Key diversity (8+ unique keys)" },
  ];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="Keyboard diagnostics tester"
      onFocusCapture={() => setIsCaptureFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsCaptureFocused(false);
        }
      }}
      onPointerDown={(event) => {
        if (isInteractiveElement(event.target)) return;
        requestAnimationFrame(() => { containerRef.current?.focus(); });
      }}
      className="kt-panel"
      style={{
        color: "#d4d4d8",
        fontFamily: mono,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        outline: "none",
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#3f3f46", marginBottom: 4 }}>ADVANCED</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#00ff88", letterSpacing: -0.5, margin: "4px 0 10px" }}>KEY DIAGNOSTICS</h1>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: "#71717a", flexWrap: "wrap", alignItems: "center" }}>
          <span>{ds.totalKeydowns} presses</span>
          <span>{ds.totalKeyups} releases</span>
          <span>{ds.testedCount} keys</span>
          {ds.wpm > 0 && <span>{ds.wpm.toFixed(0)} WPM</span>}
          <span style={{ color: isRecording ? "#00ff88" : "#ef4444", animation: isRecording ? "blink 1.5s infinite" : "none" }}>
            {isRecording ? "REC" : "PAUSED"}
          </span>
        </div>
        {timingResMs !== null && (
          <div style={{ marginTop: 4, fontSize: 9, color: timingWarn ? "#eab308" : "#3f3f46" }}>
            {timingWarn
              ? `⚠ Timer resolution: ~${timingResMs.toFixed(1)}ms — sub-5ms measurements may be imprecise`
              : `Timer resolution: ~${timingResMs.toFixed(2)}ms`}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <span style={{
            color: verdictColor, fontWeight: 600, fontSize: 12, letterSpacing: 0.5,
            background: `${verdictColor}12`, border: `1px solid ${verdictColor}30`,
            borderRadius: 20, padding: "5px 16px", transition: "all 0.4s ease",
          }}>
            {cl.verdict}
            {cl.confidence !== "LOW" && <span style={{ fontSize: 9, marginLeft: 8, opacity: 0.6 }}>{cl.confidence}</span>}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: captureStatusColor, lineHeight: 1.6 }}>
          {captureStatusText}
        </div>
      </div>

      {/* ── Visual Keyboard ─────────────────────────────────── */}
      <div style={{
        width: "100%", maxWidth: 820, marginBottom: 14,
        background: "#09090b", border: `1px solid ${isCaptureFocused && isRecording ? "#00ff8825" : "#18181b"}`,
        borderRadius: 12, padding: "14px 12px 10px",
        transition: "border-color 0.3s ease",
      }}>
        {LAYOUT.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 3, marginBottom: ri === 0 ? 8 : 3 }}>
            {row.map((item, ki) => {
              if (isSpacer(item)) {
                return <div key={`s${ki}`} style={{ flex: item.w }} />;
              }
              const pressed = ds.pressedCodes.has(item.code);
              const tested = ds.testedCodes.has(item.code);
              const count = ds.keyPressCount[item.code] || 0;
              const heatAlpha = Math.min(count / 40, 1);
              const heatBg = count > 0
                ? `rgba(0, 255, 136, ${0.04 + heatAlpha * 0.12})`
                : "#111113";

              return (
                <div
                  key={item.code}
                  style={{
                    flex: item.w,
                    height: ri === 0 ? 30 : 38,
                    borderRadius: 6,
                    background: pressed ? "#00ff88" : heatBg,
                    border: `1px solid ${pressed ? "#00ff88" : tested ? "#00ff8830" : "#1e1e22"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: item.w > 1.5 ? 8 : ri === 0 ? 9 : 11,
                    fontWeight: pressed ? 700 : 500,
                    color: pressed ? "#000" : tested ? "#8a8a96" : "#3a3a42",
                    transition: "all 0.08s ease-out",
                    boxShadow: pressed ? "0 0 16px #00ff8835, inset 0 0 8px #00ff8810" : "none",
                    letterSpacing: item.w > 1.5 ? 0.5 : 0,
                    userSelect: "none" as const,
                    position: "relative" as const,
                    overflow: "hidden",
                  }}
                >
                  {item.label}
                  {count > 0 && !pressed && (
                    <span style={{
                      position: "absolute", bottom: 2, right: 3,
                      fontSize: 7, color: "#00ff8850", fontWeight: 400,
                    }}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Top Stats ───────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, width: "100%", maxWidth: 820, marginBottom: 14 }}>
        <Stat
          label="Keydown Rate"
          value={rateDisplay > 0 ? `${rateDisplay.toFixed(0)}Hz` : EMPTY}
          sub={ds.avgRate > 0 ? `avg ${ds.avgRate.toFixed(0)}Hz` : "press keys to measure"}
          color={rateColor}
        />
        <Stat label="Min Interval" value={ds.minInterval < Infinity ? `${ds.minInterval.toFixed(2)}ms` : EMPTY} sub={`max ${ds.maxInterval > 0 ? ds.maxInterval.toFixed(1) + "ms" : EMPTY}`} color="#d4d4d8" />
        <Stat label="Jitter" value={ds.jitter > 0 ? `±${ds.jitter.toFixed(2)}ms` : EMPTY} sub="std deviation" color={ds.jitter < 15 ? "#00ff88" : ds.jitter < 50 ? "#ffaa00" : "#ff5555"} />
        <Stat label="NKRO Max" value={ds.nkroMax || EMPTY} sub={`${ds.currentHeld} held now`} color="#d4d4d8" />
      </div>

      {/* ── Switch Type Analysis ────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 820, marginBottom: 14, background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#52525b", textTransform: "uppercase" }}>Switch Type Analysis</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#52525b", background: `${verdictColor}15`, border: `1px solid ${verdictColor}25`, borderRadius: 4, padding: "2px 8px", letterSpacing: 0.5 }}>{cl.confidence}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: verdictColor }}>{cl.verdict}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.6, marginBottom: 14 }}>{cl.description}</div>

        {/* Quick metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
          {[
            { label: "HOLD P5", value: fmtP(ds.holdP5), sub: "ms", color: ds.holdP5 < 10 ? "#ff44cc" : ds.holdP5 < 25 ? "#44aaff" : ds.holdP5 < 42 ? "#ffaa44" : ds.holdP5 <= 65 ? "#b388ff" : "#d4d4d8" },
            { label: "REACT P5", value: fmtP(ds.reactP5), sub: "ms", color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#d4d4d8" },
            { label: "REACT MIN", value: ds.reactMin < Infinity ? ds.reactMin.toFixed(1) : EMPTY, sub: "ms", color: ds.reactMin < 15 ? "#ff44cc" : ds.reactMin < 35 ? "#b388ff" : ds.reactMin < 55 ? "#44aaff" : "#d4d4d8" },
            { label: "MICRO%", value: ds.totalKeyups > 0 ? `${(ds.microRatio * 100).toFixed(1)}` : EMPTY, sub: `<${MICRO_RELEASE_MS}ms`, color: ds.microRatio > 0.2 ? "#ff44cc" : ds.microRatio > 0.05 ? "#44aaff" : "#52525b" },
            { label: "TAP RATE", value: ds.maxTapRate > 0 ? ds.maxTapRate.toFixed(1) : EMPTY, sub: "taps/sec", color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#d4d4d8" },
            { label: "AVG HOLD", value: ds.avgHold > 0 ? ds.avgHold.toFixed(1) : EMPTY, sub: "ms", color: "#d4d4d8" },
            { label: "BOUNCE", value: ds.bounceEvents, sub: "events", color: ds.bounceEvents > 3 ? "#ffaa44" : ds.bounceEvents > 0 ? "#ef4444" : "#52525b" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ fontSize: 9, color: "#52525b", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              {item.sub && <div style={{ fontSize: 8, color: "#3f3f46", marginTop: 2 }}>{item.sub}</div>}
            </div>
          ))}
        </div>

        {/* Classification evidence */}
        {cl.signals.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid #18181b", paddingTop: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#52525b", marginBottom: 8, fontWeight: 600 }}>CLASSIFICATION EVIDENCE</div>
            {cl.signals.map((sig, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5, fontSize: 10, lineHeight: 1.6 }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: SIGNAL_COLORS[sig.supports], marginTop: 5, flexShrink: 0 }} />
                <div>
                  <span style={{ color: SIGNAL_COLORS[sig.supports], fontWeight: 600 }}>{sig.name}</span>
                  <span style={{ color: "#71717a" }}> — {sig.finding}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Test Completeness Checklist */}
        <div style={{ marginTop: 14, borderTop: "1px solid #18181b", paddingTop: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#52525b", marginBottom: 8, fontWeight: 600 }}>TEST COMPLETENESS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 10 }}>
            {testChecks.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${t.done ? "#00ff8860" : "#27272a"}`,
                  background: t.done ? "#00ff8812" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: t.done ? "#00ff88" : "#27272a",
                }}>
                  {t.done ? "✓" : ""}
                </span>
                <span style={{ color: t.done ? "#a1a1aa" : "#52525b" }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────── */}
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

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div ref={logRef} style={{
        background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 14,
        width: "100%", maxWidth: 820, height: 400, overflowY: "auto", overflowX: "auto",
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
                    <div style={{ color: e.repeat ? "#3f3f46" : isDown ? "#22c55e" : "#52525b", padding: "3px 0", fontWeight: 600 }}>
                      {e.type}{e.repeat ? "*" : ""}
                    </div>
                    <div style={{ color: "#d4d4d8", padding: "3px 0", fontWeight: 600 }}>{e.displayKey}</div>
                    <div style={{ color: "#3f3f46", padding: "3px 0", fontSize: 9 }}>{e.code}</div>
                    <div style={{ color: "#71717a", padding: "3px 0", fontVariantNumeric: "tabular-nums" }}>
                      {e.interval !== EMPTY ? `${e.interval}ms` : EMPTY}
                    </div>
                    <div style={{ color: parseFloat(e.hz) > 200 ? "#22c55e" : "#71717a", padding: "3px 0" }}>
                      {e.hz !== EMPTY ? e.hz : EMPTY}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>KEYDOWN RATE</div>
                <div>Rolling (3s): <span style={{ color: rateColor, fontWeight: 700 }}>{ds.rollingRate > 0 ? `${ds.rollingRate.toFixed(2)} Hz` : EMPTY}</span></div>
                <div>All-time avg: <span style={{ color: "#d4d4d8", fontWeight: 600 }}>{ds.avgRate > 0 ? `${ds.avgRate.toFixed(2)} Hz` : EMPTY}</span></div>
                <div>Peak: <span style={{ color: "#d4d4d8" }}>{ds.peakRate > 0 ? `${ds.peakRate.toFixed(2)} Hz` : EMPTY}</span></div>
                <div>Min interval: <span style={{ color: "#d4d4d8" }}>{ds.minInterval < Infinity ? `${ds.minInterval.toFixed(3)} ms` : EMPTY}</span></div>
                <div>Jitter (σ): <span style={{ color: ds.jitter < 15 ? "#22c55e" : "#eab308" }}>{ds.jitter > 0 ? `±${ds.jitter.toFixed(3)} ms` : EMPTY}</span></div>
                <div>Presses: <span style={{ color: "#d4d4d8" }}>{ds.totalKeydowns}</span> &nbsp; Releases: <span style={{ color: "#d4d4d8" }}>{ds.totalKeyups}</span></div>
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
                      σ = {ds.holdStdDev > 0 ? ds.holdStdDev.toFixed(1) : EMPTY}ms &nbsp; avg = {ds.avgHold > 0 ? ds.avgHold.toFixed(1) : EMPTY}ms &nbsp; (holds &gt;{HOLD_CAP_MS}ms excluded)
                    </div>
                  </div>
                ) : <div style={{ color: "#27272a", fontSize: 10 }}>Press and release keys to see distribution...</div>}
              </div>
            </div>

            {/* Re-activation analysis */}
            <div style={{ marginTop: 16, color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>RE-ACTIVATION ANALYSIS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, fontSize: 11 }}>
              <div>
                <div>Re-activation P5: <span style={{ color: ds.reactP5 < 10 ? "#ff44cc" : ds.reactP5 < 25 ? "#44aaff" : "#d4d4d8", fontWeight: 600 }}>{fmtP(ds.reactP5)} ms</span></div>
                <div>Re-activation median: <span style={{ color: "#d4d4d8" }}>{fmtP(ds.reactMedian)} ms</span></div>
                <div>Re-activation min: <span style={{ color: "#d4d4d8" }}>{ds.reactMin < Infinity ? ds.reactMin.toFixed(2) : EMPTY} ms</span></div>
              </div>
              <div>
                <div>Max tap rate: <span style={{ color: ds.maxTapRate > 30 ? "#ff44cc" : ds.maxTapRate > 18 ? "#44aaff" : "#d4d4d8", fontWeight: 600 }}>{ds.maxTapRate > 0 ? `${ds.maxTapRate.toFixed(1)} taps/sec` : EMPTY}</span></div>
                <div>Micro-releases: <span style={{ color: ds.microReleases > 3 ? "#eab308" : "#d4d4d8" }}>{ds.microReleases}</span> <span style={{ color: "#52525b", fontSize: 9 }}>({(ds.microRatio * 100).toFixed(1)}%)</span></div>
                <div>Bounce events: <span style={{ color: ds.bounceEvents > 0 ? "#ef4444" : "#d4d4d8" }}>{ds.bounceEvents}</span></div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#52525b", marginTop: 4, lineHeight: 1.6 }}>
              Re-activation = time from releasing a key to pressing the <em>same</em> key again (up→down gap, per physical key code).
            </div>

            {/* How to test */}
            <div style={{ marginTop: 16, color: "#52525b", fontSize: 9, letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>HOW TO TEST</div>
            <div style={{ fontSize: 10, color: "#71717a", lineHeight: 1.8 }}>
              1. <span style={{ color: "#d4d4d8" }}>Rapid tap</span> — tap a single key as fast as possible for 10+ seconds (unlocks re-activation signals)<br />
              2. <span style={{ color: "#d4d4d8" }}>Rollover</span> — press and hold 6+ keys simultaneously with both hands (NKRO signal)<br />
              3. <span style={{ color: "#d4d4d8" }}>Rapid trigger</span> — if your keyboard has RT enabled, tap with minimal finger travel<br />
              4. <span style={{ color: "#d4d4d8" }}>Export</span> — download full JSON report with every event timestamped
            </div>
          </div>
        )}

        {tab === "intervals" && (
          <div>
            <div style={{ color: "#22c55e", fontSize: 10, letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>KEYDOWN INTERVAL HISTORY</div>
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
                        }} title={`${v.toFixed(2)}ms (${rate.toFixed(0)}Hz)`} />
                      );
                    });
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#52525b", marginTop: 6, padding: "0 6px" }}>
                  <span>← older</span>
                  <span>Last 100 keydown intervals — taller bar = slower keystroke</span>
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
              <div style={{ textAlign: "center", color: "#27272a", marginTop: 80, fontSize: 12 }}>Press keys to see interval history...</div>
            )}
          </div>
        )}
      </div>

      {/* ── Disclaimer ──────────────────────────────────────── */}
      <div style={{ marginTop: 10, fontSize: 9, color: "#27272a", textAlign: "center", maxWidth: 820, lineHeight: 1.6 }}>
        All tracking uses physical key codes (e.code), not display characters — Left/Right modifiers and Numpad keys are measured separately.
        Browser timer resolution: ~{timingResMs !== null ? timingResMs.toFixed(2) : "?"}ms. Classification uses behavioral heuristics, not hardware access.
        No data is collected, transmitted, or stored.
      </div>
    </div>
  );
}
