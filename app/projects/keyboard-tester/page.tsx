"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import KeyboardTester from "@/components/demos/KeyboardTester";

export default function KeyboardTesterPage() {
  return (
    <main className="pt-20 pb-12 px-4 md:px-6 min-h-screen">
      <div className="max-w-[880px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-dim hover:text-muted transition-colors duration-300 mb-8"
          >
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
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Projects
          </Link>
        </motion.div>

        <KeyboardTester />
      </div>
    </main>
  );
}
