"use client";

import Image from "next/image";
import AnimatedSection from "./AnimatedSection";

export default function About() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <AnimatedSection>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-14">
            {/* Headshot */}
            <div className="shrink-0">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border border-subtle">
                <Image
                  src="/images/headshot.png"
                  alt="Wale Adekambi"
                  width={144}
                  height={144}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>

            {/* Text */}
            <div className="text-center md:text-left">
              <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-6">
                About
              </h2>
              <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl">
                Recent Industrial &amp; Systems Engineering grad from George Mason
                University, with a technical emphasis in Electrical Engineering.
                I build systems that solve real problems for real organizations,
                from a dynamic inventory model that projected $1.3M in yearly
                savings for the Arlington Water Department to AI-powered pipelines
                processing 1,000+ renewable energy records across 15 West African
                nations. I work best at the intersection of engineering, data, and
                the tools that make both useful.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
