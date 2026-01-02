import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ParallaxSection } from "@/components/layout/ParallaxSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";

// Lazy load below-the-fold components for faster initial page load
const AvatarHowItWorksSection = lazy(() => import("@/components/landing/AvatarHowItWorksSection").then(m => ({ default: m.AvatarHowItWorksSection })));
const PathologiesSection = lazy(() => import("@/components/landing/PathologiesSection").then(m => ({ default: m.PathologiesSection })));
const HumanReviewSection = lazy(() => import("@/components/landing/HumanReviewSection").then(m => ({ default: m.HumanReviewSection })));
const TestimonialsSection = lazy(() => import("@/components/landing/TestimonialsSection").then(m => ({ default: m.TestimonialsSection })));
const PacksSection = lazy(() => import("@/components/landing/PacksSection").then(m => ({ default: m.PacksSection })));
const ProfilesSection = lazy(() => import("@/components/landing/ProfilesSection").then(m => ({ default: m.ProfilesSection })));
const TransparencySection = lazy(() => import("@/components/landing/TransparencySection").then(m => ({ default: m.TransparencySection })));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then(m => ({ default: m.FAQSection })));
const FloatingCtaIcon = lazy(() => import("@/components/landing/FloatingCtaIcon").then(m => ({ default: m.FloatingCtaIcon })));
const ChatContainer = lazy(() => import("@/components/chat").then(m => ({ default: m.ChatContainer })));

// Loading fallback component
const SectionLoader = () => (
  <div className="min-h-[200px] flex items-center justify-center">
    <div className="animate-pulse flex space-x-2">
      <div className="w-3 h-3 bg-primary/40 rounded-full"></div>
      <div className="w-3 h-3 bg-primary/40 rounded-full animation-delay-200"></div>
      <div className="w-3 h-3 bg-primary/40 rounded-full animation-delay-400"></div>
    </div>
  </div>
);

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Diagnóstico Técnico de Patologías en Vivienda | Revisión Humana</title>
        <meta name="description" content="Servicio de diagnóstico de patologías en viviendas en España. Humedades, grietas, filtraciones. Orientación preliminar asistida + revisión humana obligatoria. Empieza gratis." />
        <link rel="canonical" href="https://diagnosticotecnico.es/" />
      </Helmet>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pb-20 lg:pb-0">
          {/* Hero with fullscreen video background - includes trust bar */}
          <HeroSection />

          {/* Problem section - What problem do we solve */}
          <ProblemSection />

          {/* Lazy loaded sections below the fold */}
          <Suspense fallback={<SectionLoader />}>
            {/* Process Zone */}
            <ParallaxSection background="process" overlay="gradient">
              <AvatarHowItWorksSection />
              <PathologiesSection />
            </ParallaxSection>

            {/* Human Review Section - Very prominent */}
            <HumanReviewSection />

            {/* Testimonials Section - Client reviews carousel */}
            <TestimonialsSection />

            {/* Services Zone */}
            <ParallaxSection background="services" overlay="gradient">
              <PacksSection />
              <ProfilesSection />
            </ParallaxSection>

            {/* Trust Zone */}
            <ParallaxSection background="trust" overlay="gradient">
              <TransparencySection />
              <FAQSection />
            </ParallaxSection>
          </Suspense>
        </main>
        <Footer />
        {/* Floating CTA Icon - modern design, appears after scroll */}
        <Suspense fallback={null}>
          <FloatingCtaIcon />
          {/* AI Chatbot - Asistente Virtual */}
          <ChatContainer />
        </Suspense>
      </div>
    </>
  );
};

export default Index;
