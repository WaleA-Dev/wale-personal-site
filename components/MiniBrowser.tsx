"use client";

import Image from "next/image";
import { useState, useRef } from "react";

interface MiniBrowserProps {
  url: string;
  height?: number;
}

export default function MiniBrowser({ url, height = 540 }: MiniBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const refresh = () => { setLoading(true); setKey((k) => k + 1); };

  const chrome = (
    <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 h-10 md:h-11 border-b border-subtle bg-surface shrink-0">
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <span className="window-dot" style={{ background: "#ff5f57" }} />
        <span className="window-dot" style={{ background: "#febc2e" }} />
        <span className="window-dot" style={{ background: "#28c840" }} />
      </div>
      <div className="flex flex-1 items-center gap-1.5 rounded-md px-2.5 py-1.5 bg-background/60 border border-subtle min-w-0">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-dim shrink-0">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span className="text-xs text-dim font-mono truncate">{displayUrl}</span>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#28c840", boxShadow: "0 0 4px #28c840", animation: "pulse 2s ease-in-out infinite" }} />
          <span className="hidden sm:inline text-xs text-dim">live</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={refresh} aria-label="Refresh" className="hidden md:flex text-dim hover:text-foreground transition-colors duration-200">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className="text-dim hover:text-foreground transition-colors duration-200">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden border border-subtle bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)]">
      {chrome}

      {/* Desktop: interactive iframe */}
      <div className="hidden md:block relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface">
            <div className="w-6 h-6 rounded-full border-2 border-subtle" style={{ borderTopColor: "var(--color-gold)", animation: "spin 0.8s linear infinite" }} />
            <span className="text-xs text-dim">Loading CONVERGE...</span>
          </div>
        )}
        <iframe
          key={key}
          ref={iframeRef}
          src={url}
          title="CONVERGE — Arlington Water Dynamic Reorder System"
          className="w-full h-full border-0 block"
          onLoad={() => setLoading(false)}
        />
      </div>

      {/* Mobile: screenshot + open button */}
      <div className="md:hidden">
        <div className="relative">
          <Image
            src="/images/converge-dashboard.png"
            alt="CONVERGE dashboard — Arlington Water Department"
            width={1920}
            height={1080}
            className="w-full h-auto"
          />
          <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface border border-subtle text-sm text-foreground backdrop-blur-sm shadow-lg"
            >
              Open Live Demo
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
