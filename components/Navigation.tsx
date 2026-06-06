"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";


export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-subtle"
          : ""
      }`}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-16">
        <Link
          href="/"
          className="font-heading text-2xl text-foreground/90 hover:text-foreground transition-colors duration-300"
        >
          W
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="/"
            className={`text-sm tracking-wide transition-colors duration-300 ${
              pathname === "/"
                ? "text-foreground"
                : "text-dim hover:text-muted"
            }`}
          >
            Home
          </Link>
          <Link
            href="/projects"
            className={`text-sm tracking-wide transition-colors duration-300 ${
              pathname.startsWith("/projects")
                ? "text-foreground"
                : "text-dim hover:text-muted"
            }`}
          >
            Projects
          </Link>
          <Link
            href="/resume"
            className={`text-sm tracking-wide transition-colors duration-300 ${
              pathname === "/resume"
                ? "text-foreground"
                : "text-dim hover:text-muted"
            }`}
          >
            Resume
          </Link>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex items-center justify-center w-7 h-7 rounded-full border border-subtle text-dim hover:text-foreground hover:border-muted/40 transition-all duration-300"
          >
            {isLight ? (
              /* Moon — switch to dark */
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              /* Sun — switch to light */
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
