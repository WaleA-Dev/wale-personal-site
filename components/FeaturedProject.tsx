"use client";

import AnimatedSection from "./AnimatedSection";

const tags = [
  "Dynamic Reorder Points",
  "Demand Forecasting",
  "Weather-Adjusted Models",
  "React + TypeScript",
  "Supabase",
  "Python",
];

const metrics = [
  { value: "95%", label: "Stockout Reduction" },
  { value: "$1.3M", label: "Projected Annual Savings" },
  { value: "25", label: "Weekly Sprints" },
  { value: "3", label: "Person Team" },
];

const awards = [
  {
    title: "Best Paper",
    event: "GDRKMCC-26 · West Point",
    track: "Modeling & Simulation",
  },
  {
    title: "Best Paper",
    event: "SMDC-26 · George Mason",
    track: "Systems Engineering",
  },
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
            CONVERGE
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mb-8">
            A dynamic inventory reorder system built for the Arlington County
            Water Department. Replaced static reorder points with a model that
            factors in part break history, material type, and weather patterns —
            cutting annual stockouts by 95% and projecting $1.3M in yearly cost
            savings.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="flex flex-wrap gap-3 mb-10">
            {awards.map((award) => (
              <div
                key={award.event}
                className="flex items-center gap-3 rounded-lg border border-[#2a2218] bg-[#16120a] px-4 py-3"
              >
                <span className="text-gold text-base leading-none">★</span>
                <div>
                  <p className="text-foreground text-xs font-medium">
                    {award.title}
                  </p>
                  <p className="text-dim text-xs">{award.event}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-subtle bg-surface p-6 text-center"
              >
                <p className="font-heading text-3xl md:text-4xl text-foreground mb-1">
                  {m.value}
                </p>
                <p className="text-dim text-xs tracking-wide uppercase">
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <div className="flex flex-wrap gap-3 mb-10">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-dim border border-subtle rounded-full px-4 py-1.5 tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="mt-2">
            <a
              href="https://github.com/WaleA-Dev/CONVERGE---Arlington-Water-s-Dynamic-Reorder-System"
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
