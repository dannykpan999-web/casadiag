import { useState, useCallback } from "react";
import { ChatIcon } from "./ChatIcon";
import { ChatWidget } from "./ChatWidget";
import { stopHowItWorksAvatar } from "@/components/landing/AvatarHowItWorksSection";

export function ChatContainer() {
  const [isOpen, setIsOpen] = useState(false);

  // Handle opening chat - stop How It Works avatar if playing
  const handleOpenChat = useCallback(async () => {
    // Stop the How It Works section avatar before opening chat
    if (stopHowItWorksAvatar) {
      try {
        await stopHowItWorksAvatar();
        console.log("Stopped How It Works avatar");
      } catch (error) {
        console.warn("Error stopping How It Works avatar:", error);
      }
    }
    setIsOpen(true);
  }, []);

  return (
    <>
      <ChatIcon onClick={handleOpenChat} isOpen={isOpen} />
      <ChatWidget isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
