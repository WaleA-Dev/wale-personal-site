"use client";

import AnimatedSection from "./AnimatedSection";

const projects = [
  {
    title: "Monte Carlo Engine",
    description:
      "Stress-test validated trades with 200K+ Monte Carlo simulations.",
    language: "Python",
    url: "https://github.com/WaleA-Dev/wale-montecarlo-engine",
  },
  {
    title: "PineTS",
    description:
      "Open-source Pine Script transpiler \u2014 run TradingView logic in Node.js and the browser.",
    language: "TypeScript",
    url: "https://github.com/WaleA-Dev/PineTS-wale",
  },
  {
    title: "ECOWAS Energy Dataset",
    description: "Energy dataset locator for West African nations.",
    language: "Python",
    url: "https://github.com/WaleA-Dev/ECOWAS-Energy-Dataset-Locator",
  },
];

const langColors: Record<string, string> = {
  Python: "#3572A5",
  TypeScript: "#3178C6",
};

export default function ProjectGrid() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-12">
            More Projects
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <AnimatedSection key={project.title} delay={i * 0.1}>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block rounded-xl border border-subtle bg-surface p-6 h-full hover:border-[#2a2a2a] transition-all duration-300"
              >
                <div className="card-glow" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-foreground font-medium text-base">
                      {project.title}
                    </h3>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-dim group-hover:text-muted transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    >
                      <path d="M7 17L17 7" />
                      <path d="M7 7h10v10" />
                    </svg>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-6">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: langColors[project.language] || "#888",
                      }}
                    />
                    <span className="text-xs text-dim">
                      {project.language}
                    </span>
                  </div>
                </div>
              </a>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
