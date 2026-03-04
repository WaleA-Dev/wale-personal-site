"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#030303]/80 backdrop-blur-xl border-b border-subtle/50"
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
        </div>
      </div>
    </nav>
  );
}
