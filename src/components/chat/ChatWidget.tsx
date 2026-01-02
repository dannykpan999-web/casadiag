import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  findFAQMatch,
  isComplexQuestion,
  welcomeMessage,
  complexQuestionResponse,
  fallbackResponse,
  complexKeywords,
} from "@/services/chat/faqData";
import { getAIResponse } from "@/services/chat/openaiService";
import { sendWebhookNotification } from "@/services/chat/emailService";
import {
  initializeAvatar,
  speakText as avatarSpeak,
  stopAvatar,
  setEventCallbacks,
  isAvatarActive,
  interruptSpeech,
  AVATAR_SELECTOR_OPTIONS,
} from "@/services/chat/heygenService";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Avatar states
type AvatarState = "idle" | "loading" | "ready" | "speaking" | "error";

export function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: welcomeMessage,
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasInitialized = useRef(false);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize avatar when chat opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      initializeAvatarSession();
    }
  }, [isOpen]);

  // Cleanup when component unmounts or chat closes
  useEffect(() => {
    return () => {
      if (hasInitialized.current) {
        stopAvatar();
        hasInitialized.current = false;
      }
    };
  }, []);

  // Preload Spanish voices for better TTS quality
  useEffect(() => {
    // Load voices (some browsers load them asynchronously)
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        const spanishVoices = voices.filter((v) => v.lang.startsWith("es"));
        console.log("Available Spanish voices:", spanishVoices.map((v) => `${v.name} (${v.lang})`));
      }
    };

    // Try loading immediately
    loadVoices();

    // Also listen for voiceschanged event (Chrome loads voices async)
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Focus input when chat opens and avatar is ready
  useEffect(() => {
    if (isOpen && avatarState === "ready") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, avatarState]);

  // Initialize HeyGen avatar session
  const initializeAvatarSession = async () => {
    if (hasInitialized.current && isAvatarActive()) {
      return;
    }

    setAvatarState("loading");
    setAvatarError(null);

    // Set up event callbacks
    setEventCallbacks({
      onStreamReady: (stream: MediaStream) => {
        console.log("Stream ready, connecting to video element");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
        }
        setAvatarState("ready");
        hasInitialized.current = true;

        // Speak welcome message after avatar is ready
        if (!isMuted) {
          setTimeout(() => {
            avatarSpeak(welcomeMessage);
          }, 1000);
        }
      },
      onAvatarStartTalking: () => {
        setAvatarState("speaking");
      },
      onAvatarStopTalking: () => {
        setAvatarState("ready");
      },
      onDisconnected: () => {
        console.log("Avatar disconnected");
        setAvatarState("idle");
        hasInitialized.current = false;
      },
    });

    // Initialize avatar
    const success = await initializeAvatar();

    if (!success) {
      setAvatarState("error");
      setAvatarError("No se pudo conectar con el asistente virtual. Intenta de nuevo.");
      hasInitialized.current = false;
    }
  };

  // Retry avatar initialization
  const retryAvatarInit = () => {
    hasInitialized.current = false;
    initializeAvatarSession();
  };

  // Text-to-speech using HeyGen avatar or fallback to browser TTS
  const speakResponse = useCallback(async (text: string) => {
    if (isMuted) return;

    // Try HeyGen avatar first
    if (isAvatarActive()) {
      const success = await avatarSpeak(text);
      if (success) return;
    }

    // Fallback to browser TTS if avatar not available
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 0.9; // Slightly slower for natural sound
      utterance.pitch = 1.1; // Slightly higher pitch for feminine voice

      // Get all available voices
      const voices = window.speechSynthesis.getVoices();

      // Log available Spanish voices for debugging
      const spanishVoices = voices.filter((v) => v.lang.startsWith("es"));
      console.log("Available Spanish voices:", spanishVoices.map((v) => `${v.name} (${v.lang})`));

      // Priority list - FEMALE Spanish (Spain) voices ONLY
      // Ordered by quality and authenticity of Spanish accent
      const femaleSpanishVoices = [
        // Microsoft Windows voices (best quality)
        "Microsoft Helena Online (Natural) - Spanish (Spain)",
        "Microsoft Helena - Spanish (Spain)",
        "Microsoft Laura Online (Natural) - Spanish (Spain)",
        "Microsoft Laura - Spanish (Spain)",
        "Helena Online",
        "Helena",
        "Laura Online",
        "Laura",
        // Google Chrome voices
        "Google español",
        "Google español de España",
        // macOS voices
        "Mónica",
        "Monica",
        // Azure Neural voices
        "Elvira Online",
        "Elvira",
        // Other female voices
        "Paulina",
        "Conchita",
        "Lucia",
        "Penélope",
        "Lola",
      ];

      let selectedVoice = null;

      // First: Try to find a female voice by exact/partial name match
      for (const femaleName of femaleSpanishVoices) {
        selectedVoice = voices.find(
          (v) =>
            v.name.toLowerCase().includes(femaleName.toLowerCase()) &&
            v.lang.startsWith("es") &&
            // Exclude male voices explicitly
            !v.name.toLowerCase().includes("jorge") &&
            !v.name.toLowerCase().includes("pablo") &&
            !v.name.toLowerCase().includes("diego") &&
            !v.name.toLowerCase().includes("andrés") &&
            !v.name.toLowerCase().includes("enrique")
        );
        if (selectedVoice) {
          console.log("Found preferred female voice:", selectedVoice.name);
          break;
        }
      }

      // Second: Try any es-ES female voice (Spain Spanish)
      if (!selectedVoice) {
        selectedVoice = voices.find(
          (v) =>
            v.lang === "es-ES" &&
            (v.name.toLowerCase().includes("female") ||
             v.name.toLowerCase().includes("mujer") ||
             // Common female name patterns
             /helena|laura|mónica|monica|elvira|conchita|lucia|paulina|lola/i.test(v.name)) &&
            !v.name.toLowerCase().includes("male")
        );
        if (selectedVoice) {
          console.log("Found es-ES female voice:", selectedVoice.name);
        }
      }

      // Third: Any es-ES voice that's not explicitly male
      if (!selectedVoice) {
        selectedVoice = voices.find(
          (v) =>
            v.lang === "es-ES" &&
            !v.name.toLowerCase().includes("jorge") &&
            !v.name.toLowerCase().includes("pablo") &&
            !v.name.toLowerCase().includes("diego") &&
            !v.name.toLowerCase().includes("male")
        );
        if (selectedVoice) {
          console.log("Found es-ES voice (not male):", selectedVoice.name);
        }
      }

      // Fourth: Fallback to any Spanish voice
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => v.lang.startsWith("es"));
        if (selectedVoice) {
          console.log("Fallback to any Spanish voice:", selectedVoice.name);
        }
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log("Using Spanish voice:", selectedVoice.name, selectedVoice.lang);
      } else {
        console.warn("No Spanish voice found, using browser default");
      }

      utterance.onstart = () => setAvatarState("speaking");
      utterance.onend = () => setAvatarState("ready");
      utterance.onerror = () => setAvatarState("ready");

      window.speechSynthesis.speak(utterance);
    }
  }, [isMuted]);

  // Process user message
  const processMessage = async (userMessage: string) => {
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      content: userMessage,
      role: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let responseText: string;

    try {
      // Check for complex questions first
      if (isComplexQuestion(userMessage)) {
        responseText = complexQuestionResponse;

        // Send notification
        const detectedKeywords = complexKeywords.filter((kw) =>
          userMessage.toLowerCase().includes(kw.toLowerCase())
        );
        await sendWebhookNotification({
          userQuestion: userMessage,
          detectedKeywords,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Check FAQ
        const faqMatch = findFAQMatch(userMessage);

        if (faqMatch) {
          responseText = faqMatch.answer;
        } else {
          // Use AI for other questions
          try {
            responseText = await getAIResponse(userMessage);
          } catch {
            responseText = fallbackResponse;
          }
        }
      }
    } catch {
      responseText = fallbackResponse;
    }

    // Add assistant response
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      content: responseText,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsLoading(false);

    // Speak the response
    speakResponse(responseText);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputValue.trim();

    if (message && !isLoading) {
      setInputValue("");
      processMessage(message);
    }
  };

  // Toggle mute
  const toggleMute = async () => {
    if (!isMuted) {
      // Muting - stop current speech
      window.speechSynthesis?.cancel();
      await interruptSpeech();
      setAvatarState(avatarState === "speaking" ? "ready" : avatarState);
    }
    setIsMuted(!isMuted);
  };

  // Handle close with cleanup
  const handleClose = async () => {
    await interruptSpeech();
    onClose();
  };

  // Get status text
  const getStatusText = () => {
    switch (avatarState) {
      case "loading":
        return "Conectando...";
      case "speaking":
        return "Hablando...";
      case "error":
        return "Error de conexión";
      case "ready":
        return isLoading ? "Escribiendo..." : "En línea";
      default:
        return "Iniciando...";
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-28 right-6 z-50",
        "w-[380px] max-w-[calc(100vw-3rem)]",
        "bg-card rounded-2xl shadow-2xl border border-border",
        "flex flex-col overflow-hidden",
        "transition-all duration-300 ease-out",
        isOpen
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}
      style={{ height: "600px", maxHeight: "calc(100vh - 10rem)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="flex items-center gap-3">
          {/* Avatar mini preview */}
          <div className="relative h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
            {avatarState === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <img
                src={AVATAR_SELECTOR_OPTIONS[0]?.image || "https://files.heygen.ai/avatar/v3/Angela-inblackskirt-20220820_7a68b1e4-a45a-11ed-8912-0242ac110002/preview_target.webp"}
                alt="Asistente"
                className="h-full w-full object-cover"
              />
            )}
            {/* Status indicator */}
            <span
              className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-primary",
                avatarState === "ready" && "bg-green-400",
                avatarState === "speaking" && "bg-yellow-400 animate-pulse",
                avatarState === "loading" && "bg-blue-400 animate-pulse",
                avatarState === "error" && "bg-red-400",
                avatarState === "idle" && "bg-gray-400"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Asistente</h3>
            <p className="text-xs text-primary-foreground/80">
              {getStatusText()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Retry button (shown on error) */}
          {avatarState === "error" && (
            <button
              onClick={retryAvatarInit}
              className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
              aria-label="Reintentar conexión"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* Mute button */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
            aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
            aria-label="Cerrar chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Avatar Video Area - HeyGen Interactive Avatar */}
      <div className="relative bg-gradient-to-b from-muted/50 to-transparent p-3">
        <div className="relative mx-auto w-36 h-36 rounded-full overflow-hidden ring-4 ring-primary/20 shadow-lg bg-muted">
          {/* Video element for HeyGen stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className={cn(
              "h-full w-full object-cover",
              avatarState !== "ready" && avatarState !== "speaking" && "hidden"
            )}
          />

          {/* Fallback image when video not ready */}
          {(avatarState === "idle" || avatarState === "loading" || avatarState === "error") && (
            <div className="absolute inset-0 flex items-center justify-center">
              {avatarState === "loading" ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Cargando avatar...</span>
                </div>
              ) : avatarState === "error" ? (
                <div className="flex flex-col items-center gap-2 px-2 text-center">
                  <div className="text-red-500 text-2xl">⚠️</div>
                  <span className="text-xs text-muted-foreground">{avatarError}</span>
                  <button
                    onClick={retryAvatarInit}
                    className="text-xs text-primary hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <img
                  src={AVATAR_SELECTOR_OPTIONS[0]?.image || "https://files.heygen.ai/avatar/v3/Angela-inblackskirt-20220820_7a68b1e4-a45a-11ed-8912-0242ac110002/preview_target.webp"}
                  alt="Asistente Virtual"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          )}

          {/* Speaking indicator overlay */}
          {avatarState === "speaking" && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-black/30 px-2 py-1 rounded-full">
              <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              <p className="leading-relaxed">{message.content}</p>
              <p
                className={cn(
                  "text-[10px] mt-1",
                  message.role === "user"
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground"
                )}
              >
                {message.timestamp.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-full",
              "bg-muted border border-border",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-200"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {["¿Cuánto cuesta?", "¿Cómo funciona?", "Tengo humedades"].map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => {
                setInputValue(question);
                inputRef.current?.focus();
              }}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded-full transition-colors disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
