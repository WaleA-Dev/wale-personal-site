import Hero from "@/components/Hero";
import About from "@/components/About";
import FeaturedProject from "@/components/FeaturedProject";
import ProjectGrid from "@/components/ProjectGrid";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <FeaturedProject />
      <ProjectGrid />
      <Footer />
    </main>
  );
}
