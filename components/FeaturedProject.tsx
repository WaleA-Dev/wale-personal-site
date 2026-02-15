"use client";

import Image from "next/image";
import AnimatedSection from "./AnimatedSection";

const features = [
  "PineScript \u2192 Python",
  "4-Step Validation",
  "12 Built-in Strategies",
  "Local-First",
];

export default function FeaturedProject() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <p className="text-gold text-sm tracking-[0.15em] uppercase mb-4">
            Featured Project
          </p>
          <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-4">
            Wale Backtest Engine
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mb-8">
            A local backtesting platform that translates PineScript strategies
            into Python, runs them against real market data, and validates results
            through a 4-step statistical pipeline. Ships as both a Flask web app
            and a standalone Windows EXE.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.15}>
          <div className="flex flex-wrap gap-3 mb-10">
            {features.map((tag) => (
              <span
                key={tag}
                className="text-xs text-dim border border-subtle rounded-full px-4 py-1.5 tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          {/* Browser frame mockup */}
          <div className="rounded-xl overflow-hidden border border-subtle bg-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0c0c0c] border-b border-subtle">
              <span
                className="window-dot"
                style={{ background: "#ff5f57" }}
              />
              <span
                className="window-dot"
                style={{ background: "#febc2e" }}
              />
              <span
                className="window-dot"
                style={{ background: "#28c840" }}
              />
              <span className="ml-3 text-xs text-dim font-mono">
                127.0.0.1:5000
              </span>
            </div>
            {/* Screenshot */}
            <Image
              src="/images/backtest-screenshot.png"
              alt="Wale Backtest Engine dashboard showing summary metrics, trade analysis, and validation pipeline results"
              width={1920}
              height={1080}
              className="w-full h-auto"
              priority
            />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="mt-8">
            <a
              href="https://github.com/WaleA-Dev/wale-pinescript-engine"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors duration-300"
            >
              View on GitHub
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
