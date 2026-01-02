import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, Cog, FileText, Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { cn } from "@/lib/utils";
import {
  initializeAvatar,
  speakText as avatarSpeak,
  stopAvatar,
  setEventCallbacks,
  isAvatarActive,
  interruptSpeech,
} from "@/services/chat/heygenService";

// Step data with timing for avatar speech
const steps = [
  {
    id: 1,
    icon: Camera,
    title: "Subes fotos o vídeos",
    description: "Cuéntanos qué ocurre en tu vivienda. El sistema te guía paso a paso.",
    speechText: "Primero, sube fotos o vídeos de tu problema. Es muy fácil, el sistema te guía paso a paso.",
  },
  {
    id: 2,
    icon: Cog,
    title: "Analizamos tu caso",
    description: "Identificamos qué ocurre, por qué ocurre y si es algo leve o importante.",
    speechText: "Después, nuestros expertos analizan tu caso. Identificamos el problema y su gravedad.",
  },
  {
    id: 3,
    icon: FileText,
    title: "Recibes tu diagnóstico",
    description: "Un arquitecto o ingeniero valida tu informe antes de entregarlo.",
    speechText: "Finalmente, recibes tu diagnóstico validado por un técnico colegiado. ¡Así de simple!",
  },
];

// Welcome message
const welcomeSpeech = "¡Hola! Te explico cómo funciona nuestro diagnóstico en tres sencillos pasos.";

// Avatar states
type AvatarState = "idle" | "loading" | "ready" | "speaking" | "error";

// Export function to stop this section's avatar (called from ChatContainer)
export let stopHowItWorksAvatar: (() => Promise<void>) | null = null;

export function AvatarHowItWorksSection() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [videoReady, setVideoReady] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasInitialized = useRef(false);
  const isSpeakingRef = useRef(false);

  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.3,
  });

  const { ref: contentRef, isVisible: contentVisible } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.2,
  });

  // Stop and cleanup function
  const stopAndCleanup = useCallback(async () => {
    setIsPlaying(false);
    setAvatarState("idle");
    setVideoReady(false);
    window.speechSynthesis?.cancel();
    await interruptSpeech();
    await stopAvatar();
    hasInitialized.current = false;
    isSpeakingRef.current = false;
  }, []);

  // Export the stop function for external use
  useEffect(() => {
    stopHowItWorksAvatar = stopAndCleanup;
    return () => {
      stopHowItWorksAvatar = null;
    };
  }, [stopAndCleanup]);

  // Try to play video with fallback for autoplay policy
  const tryPlayVideo = useCallback(async () => {
    if (!videoRef.current) return false;

    try {
      // First try to play muted (always allowed)
      videoRef.current.muted = true;
      await videoRef.current.play();

      // Then unmute if not muted by user
      if (!isMuted) {
        videoRef.current.muted = false;
      }

      setVideoReady(true);
      console.log("Video playing successfully");
      return true;
    } catch (error) {
      console.warn("Autoplay failed:", error);
      // Keep muted but playing
      setVideoReady(true);
      return true;
    }
  }, [isMuted]);

  // Initialize HeyGen avatar session
  const initializeAvatarSession = useCallback(async () => {
    if (hasInitialized.current && isAvatarActive()) {
      return true;
    }

    // Stop any existing session first
    await stopAvatar();
    hasInitialized.current = false;

    setAvatarState("loading");
    setVideoReady(false);

    // Set up event callbacks
    setEventCallbacks({
      onStreamReady: (stream: MediaStream) => {
        console.log("HeyGen stream ready");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            await tryPlayVideo();
          };
        }
        setAvatarState("ready");
        hasInitialized.current = true;
      },
      onAvatarStartTalking: () => {
        setAvatarState("speaking");
        isSpeakingRef.current = true;
        if (videoRef.current && videoRef.current.paused) {
          tryPlayVideo();
        }
      },
      onAvatarStopTalking: () => {
        setAvatarState("ready");
        isSpeakingRef.current = false;
      },
      onDisconnected: () => {
        console.log("Avatar disconnected");
        setAvatarState("idle");
        setVideoReady(false);
        hasInitialized.current = false;
        isSpeakingRef.current = false;
      },
    });

    // Initialize avatar - use default avatar
    const success = await initializeAvatar();

    if (!success) {
      setAvatarState("error");
      hasInitialized.current = false;
      return false;
    }

    return true;
  }, [tryPlayVideo]);

  // Speak text using HeyGen avatar or fallback to browser TTS
  const speakText = useCallback(async (text: string, onEnd?: () => void) => {
    if (isMuted) {
      if (onEnd) {
        setTimeout(onEnd, text.length * 60);
      }
      return;
    }

    // Try HeyGen avatar first
    if (isAvatarActive()) {
      setAvatarState("speaking");
      isSpeakingRef.current = true;
      const success = await avatarSpeak(text);
      if (success) {
        // Wait for avatar to finish speaking using ref
        const checkSpeaking = setInterval(() => {
          if (!isSpeakingRef.current) {
            clearInterval(checkSpeaking);
            if (onEnd) onEnd();
          }
        }, 300);

        // Timeout fallback
        setTimeout(() => {
          clearInterval(checkSpeaking);
          isSpeakingRef.current = false;
          setAvatarState("ready");
          if (onEnd) onEnd();
        }, text.length * 80 + 3000);
        return;
      }
    }

    // Fallback to browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const femaleSpanishVoices = [
        "Microsoft Helena", "Helena", "Microsoft Laura", "Laura",
        "Google español", "Mónica", "Monica", "Elvira",
      ];

      let selectedVoice = null;
      for (const femaleName of femaleSpanishVoices) {
        selectedVoice = voices.find(
          (v) => v.name.toLowerCase().includes(femaleName.toLowerCase()) && v.lang.startsWith("es")
        );
        if (selectedVoice) break;
      }

      if (!selectedVoice) {
        selectedVoice = voices.find((v) => v.lang.startsWith("es"));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setAvatarState("speaking");
      utterance.onend = () => {
        setAvatarState("ready");
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setAvatarState("ready");
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } else if (onEnd) {
      setTimeout(onEnd, text.length * 60);
    }
  }, [isMuted]);

  // Play the presentation sequence
  const playSequence = useCallback(() => {
    if (!isPlaying) return;

    if (currentStep === 0) {
      speakText(welcomeSpeech, () => {
        if (isPlaying) {
          setTimeout(() => setCurrentStep(1), 500);
        }
      });
    } else if (currentStep >= 1 && currentStep <= 3) {
      const step = steps[currentStep - 1];
      speakText(step.speechText, () => {
        if (isPlaying && currentStep < 3) {
          setTimeout(() => setCurrentStep((prev) => prev + 1), 500);
        } else if (currentStep === 3) {
          setIsPlaying(false);
        }
      });
    }
  }, [isPlaying, currentStep, speakText]);

  // Effect to handle sequence progression
  useEffect(() => {
    if (isPlaying && hasStarted) {
      playSequence();
    }
  }, [isPlaying, currentStep, hasStarted, playSequence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      stopAvatar();
    };
  }, []);

  // Handle play/pause - USER MUST CLICK TO START
  const togglePlay = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      window.speechSynthesis?.cancel();
      await interruptSpeech();
      setAvatarState(avatarState === "speaking" ? "ready" : avatarState);
    } else {
      // Reset if completed
      if (hasStarted && currentStep >= 3) {
        setCurrentStep(0);
      }

      // Initialize avatar if needed
      if (!isAvatarActive()) {
        await initializeAvatarSession();
      }

      setHasStarted(true);
      setIsPlaying(true);
    }
  };

  // Handle mute/unmute
  const toggleMute = async () => {
    const newMuted = !isMuted;

    if (newMuted) {
      window.speechSynthesis?.cancel();
      await interruptSpeech();
      setAvatarState(avatarState === "speaking" ? "ready" : avatarState);
    }

    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }

    setIsMuted(newMuted);
  };

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className="section bg-gradient-to-b from-background to-muted/30"
    >
      <div className="container">
        {/* Header */}
        <div
          ref={headerRef}
          className={cn(
            "section-header transition-all duration-600 ease-out",
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <h2 className="section-title">¿Cómo funciona el diagnóstico?</h2>
          <p className="section-subtitle">
            Un proceso guiado, sencillo y sin compromiso.
            <br />
            <span className="font-medium text-foreground">Pulsa play y nuestro asistente te explica</span>
          </p>
        </div>

        {/* Main Content - Avatar + Steps */}
        <div
          ref={contentRef}
          className={cn(
            "mx-auto max-w-6xl transition-all duration-600 ease-out",
            contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
            {/* LEFT SIDE - Avatar */}
            <div className="flex flex-col items-center">
              {/* Avatar Container */}
              <div className="relative">
                {/* Avatar Circle with Video */}
                <div
                  className={cn(
                    "relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden",
                    "bg-gradient-to-br from-primary/20 to-primary/5",
                    "ring-4 ring-primary/30 shadow-2xl shadow-primary/20",
                    "transition-all duration-300",
                    avatarState === "speaking" && "ring-primary/60 scale-105"
                  )}
                >
                  {/* HeyGen Video Stream */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    className={cn(
                      "w-full h-full object-cover absolute inset-0",
                      !videoReady && "opacity-0"
                    )}
                  />

                  {/* Fallback/Loading States */}
                  {(!videoReady || avatarState === "idle" || avatarState === "loading" || avatarState === "error") && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      {avatarState === "loading" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Cargando...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                            <Play className="h-8 w-8 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {avatarState === "error" ? "Pulsa play para usar voz" : "Pulsa play para iniciar"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speaking Indicator Overlay */}
                  {avatarState === "speaking" && videoReady && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-primary/80 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div
                  className={cn(
                    "absolute -bottom-2 left-1/2 -translate-x-1/2",
                    "bg-card border border-border rounded-full px-4 py-1.5 shadow-lg",
                    "text-sm font-medium"
                  )}
                >
                  {avatarState === "loading" ? (
                    <span className="text-muted-foreground">Conectando...</span>
                  ) : avatarState === "speaking" ? (
                    <span className="text-primary">Hablando...</span>
                  ) : isPlaying ? (
                    <span className="text-muted-foreground">Preparando...</span>
                  ) : hasStarted && currentStep >= 3 ? (
                    <span className="text-green-600">¡Completado!</span>
                  ) : avatarState === "error" ? (
                    <span className="text-amber-600">Modo voz</span>
                  ) : (
                    <span className="text-muted-foreground">Asistente Virtual</span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 mt-8">
                {/* Play/Pause Button */}
                <Button
                  variant="default"
                  size="lg"
                  onClick={togglePlay}
                  disabled={avatarState === "loading"}
                  className="rounded-full h-12 px-6 gap-2"
                >
                  {avatarState === "loading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Cargando...</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="h-5 w-5" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      <span>{hasStarted && currentStep > 0 && currentStep < 3 ? "Continuar" : "Reproducir"}</span>
                    </>
                  )}
                </Button>

                {/* Mute Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleMute}
                  className="rounded-full h-12 w-12"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Progress Indicator */}
              <div className="flex gap-2 mt-4">
                {[0, 1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      currentStep === step
                        ? "w-6 bg-primary"
                        : currentStep > step
                        ? "bg-primary/60"
                        : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT SIDE - Steps */}
            <div className="space-y-4">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "relative p-5 md:p-6 rounded-xl border-2 transition-all duration-500",
                      isActive
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                        : isCompleted
                        ? "bg-muted/50 border-primary/30"
                        : "bg-card border-border hover:border-primary/20"
                    )}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className={cn(
                          "flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="text-lg font-bold">{step.id}</span>
                      </div>

                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-300",
                          isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>

                      {isActive && (
                        <div className="ml-auto flex items-center gap-2 text-primary">
                          <span className="text-xs font-medium uppercase tracking-wider">Explicando</span>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                          </span>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="ml-auto">
                          <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">✓ Listo</span>
                        </div>
                      )}
                    </div>

                    <h3
                      className={cn(
                        "text-lg font-bold mb-2 transition-colors duration-300",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}

              {/* No Pressure Message */}
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center mt-6">
                <p className="text-destructive font-semibold text-sm">
                  Sin llamadas comerciales · Sin obras innecesarias · <span className="font-bold">Tú decides</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-14 text-center">
          <Button
            variant="cta"
            size="lg"
            className="h-auto py-3 px-8 flex-col gap-0.5 shadow-lg shadow-primary/20 btn-animated"
            asChild
          >
            <Link to="/asistente">
              <span className="text-base font-semibold">Analiza tu caso Ahora</span>
              <span className="text-sm font-bold">¡ES GRATIS!</span>
            </Link>
          </Button>

          <p className="mt-5 text-sm text-muted-foreground">
            3 – 5 minutos · Sin compromisos · <span className="font-semibold text-primary">¡GRATIS!</span>
          </p>
        </div>
      </div>
    </section>
  );
}
