import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Play, ArrowRight, Sparkles } from "lucide-react";

export function FloatingCtaIcon() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past hero (100vh)
      const scrollThreshold = window.innerHeight;
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop Floating CTA - Modern pill design */}
      <div
        className={`hidden lg:block fixed bottom-8 right-8 z-50 transition-all duration-500 ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-20 opacity-0 pointer-events-none"
        }`}
      >
        <Link
          to="/asistente"
          className="group relative flex items-center gap-3 overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect */}
          <div className="absolute -inset-2 bg-gradient-to-r from-primary/40 via-cyan-400/30 to-primary/40 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />

          {/* Main button container */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-5 py-3 rounded-full shadow-2xl shadow-primary/30 group-hover:shadow-primary/50 transition-all duration-300 group-hover:scale-105">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Sparkles className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
            </div>

            {/* Text - Expands on hover */}
            <span
              className={`font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                isHovered ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              Analizar mi caso
            </span>

            {/* Arrow */}
            <ArrowRight
              className={`h-4 w-4 transition-all duration-300 ${
                isHovered ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
              }`}
            />
          </div>
        </Link>
      </div>

      {/* Mobile Floating CTA - Compact modern design */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3">
          <Link
            to="/asistente"
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground w-full py-3.5 rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
          >
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">Analizar mi caso · Gratis</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
