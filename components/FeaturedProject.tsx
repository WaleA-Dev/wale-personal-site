"use client";

import AnimatedSection from "./AnimatedSection";
import MiniBrowser from "./MiniBrowser";

const tags = [
  "Dynamic Reorder Points",
  "Demand Forecasting",
  "Weather-Adjusted Models",
  "SQL",
  "REST APIs",
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
    subtitle: "West Point Military Academy",
    url: "https://www.ieworldconference.org/content/WP2026/Papers/GDRKMCC26_37.pdf",
  },
  {
    title: "Best Paper",
    event: "SMDC-26 · George Mason",
    subtitle: "",
    url: "",
  },
  {
    title: "Best Poster",
    event: "STAR-TIDES 2026",
    subtitle: "",
    url: "https://star-tides.net/wp-content/uploads/2026/05/Poster_Predictive_Inventory.pdf",
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
            Worked directly with the Arlington Water Department to design and
            develop a dynamic reorder point model that factored in part break
            history, material type, and weather patterns, replacing static
            reorder points and cutting annual stockouts by 95% and projecting
            $1.3M in yearly cost savings.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="flex flex-wrap gap-3 mb-10">
            {awards.map((award) => {
              const badge = (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition-opacity duration-200 hover:opacity-80"
                  style={{
                    background: "var(--gold-bg)",
                    border: "1px solid var(--gold-border)",
                  }}
                >
                  <span className="text-gold text-base leading-none">★</span>
                  <div>
                    <p className="text-foreground text-xs font-medium">
                      {award.title}
                    </p>
                    <p className="text-dim text-xs">{award.event}</p>
                    {award.subtitle && (
                      <p className="text-dim text-xs">{award.subtitle}</p>
                    )}
                  </div>
                </div>
              );

              return award.url ? (
                <a
                  key={award.event}
                  href={award.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {badge}
                </a>
              ) : (
                <div key={award.event}>{badge}</div>
              );
            })}
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

        <AnimatedSection delay={0.25}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "#28c840",
                boxShadow: "0 0 5px #28c840",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span className="text-xs text-dim tracking-[0.12em] uppercase">
              Interactive Demo
            </span>
          </div>
          <div className="mb-10">
            <MiniBrowser
              url="https://converge-arlington-water.vercel.app"
              height={540}
            />
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

        <AnimatedSection delay={0.35}>
          <a
            href="https://www.ieworldconference.org/content/WP2026/Papers/GDRKMCC26_37.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors duration-300"
          >
            Read the Paper
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
        </AnimatedSection>
      </div>
    </section>
  );
}
