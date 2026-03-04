import Link from "next/link";
import AnimatedSection from "@/components/AnimatedSection";
import Footer from "@/components/Footer";

const demos = [
  {
    title: "Keyboard Diagnostics",
    description:
      "Test your keyboard's performance characteristics. Measures event timing, hold durations, N-key rollover, and analyzes whether your switches might be magnetic or mechanical.",
    href: "/projects/keyboard-tester",
    tags: ["Interactive", "Hardware"],
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gold"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
        <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
        <path d="M8 16h8" />
      </svg>
    ),
  },
];

export default function ProjectsPage() {
  return (
    <main className="pt-28 pb-12 px-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <p className="text-gold text-sm tracking-[0.15em] uppercase mb-4">
            Projects
          </p>
          <h1 className="font-heading text-5xl md:text-6xl text-foreground mb-4">
            Demo Projects
          </h1>
          <p className="text-muted text-lg max-w-2xl leading-relaxed mb-16">
            Interactive tools and experiments you can try directly in your
            browser.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {demos.map((demo, i) => (
            <AnimatedSection key={demo.title} delay={0.1 + i * 0.1}>
              <Link
                href={demo.href}
                className="group relative block rounded-xl border border-subtle bg-surface p-8 h-full hover:border-[#2a2a2a] transition-all duration-300"
              >
                <div className="card-glow" />
                <div className="relative z-10">
                  <div className="mb-5">{demo.icon}</div>
                  <h3 className="text-foreground font-medium text-lg mb-2">
                    {demo.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed mb-6">
                    {demo.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {demo.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-dim border border-subtle rounded-full px-3 py-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-dim group-hover:text-gold transition-colors duration-300 flex items-center gap-1.5">
                      Launch
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="group-hover:translate-x-0.5 transition-transform duration-300"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>

      <div className="mt-32">
        <Footer />
      </div>
    </main>
  );
}
