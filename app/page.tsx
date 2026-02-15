import Hero from "@/components/Hero";
import About from "@/components/About";
import FeaturedProject from "@/components/FeaturedProject";
import ProjectGrid from "@/components/ProjectGrid";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <div className="section-divider max-w-5xl mx-auto" />
      <About />
      <div className="section-divider max-w-5xl mx-auto" />
      <FeaturedProject />
      <div className="section-divider max-w-5xl mx-auto" />
      <ProjectGrid />
      <Footer />
    </main>
  );
}
