// HeyGen Interactive Avatar Service with Session Management
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";

const HEYGEN_API_KEY = import.meta.env.VITE_HEYGEN_API_KEY;
const HEYGEN_API_BASE = "https://api.heygen.com/v1";

// Session configuration
const SESSION_KEEP_ALIVE_INTERVAL = 30000; // 30 seconds
const SESSION_TIMEOUT_WARNING = 60000; // 1 minute before expiry warning

// Available avatar IDs from HeyGen
// Use "default" or check labs.heygen.com/interactive-avatar for available avatars
export const AVATAR_OPTIONS = {
  // Default avatar provided by HeyGen
  default: "default",
  // Some known public avatar IDs (may change)
  anna: "Anna_public_3_20240108",
  wayne: "Wayne_20240711",
  kristin: "Kristin_public_2_20240108",
  josh: "Josh_lite3_20230714",
};

// Avatar display info for UI selector
export interface AvatarOption {
  id: string;
  name: string;
  description: string;
  image: string;
  gender: "female" | "male";
}

// HeyGen official avatar preview images from their CDN
export const AVATAR_SELECTOR_OPTIONS: AvatarOption[] = [
  {
    id: "Angela-inblackskirt-20220820",
    name: "Angela",
    description: "Profesional y elegante",
    image: "https://files.heygen.ai/avatar/v3/Angela-inblackskirt-20220820_7a68b1e4-a45a-11ed-8912-0242ac110002/preview_target.webp",
    gender: "female",
  },
  {
    id: "Daisy-inskirt-20220818",
    name: "Daisy",
    description: "Cercana y amigable",
    image: "https://files.heygen.ai/avatar/v3/Daisy-inskirt-20220818_c0b0e782-a45a-11ed-bf0e-0242ac110002/preview_target.webp",
    gender: "female",
  },
  {
    id: "June-HR-20230809",
    name: "June",
    description: "Moderna y dinámica",
    image: "https://files.heygen.ai/avatar/v3/June-HR-20230809_b7f02604-3659-11ee-92db-0242ac110004/preview_target.webp",
    gender: "female",
  },
  {
    id: "Kayla-incasualsuit-20220818",
    name: "Kayla",
    description: "Natural y confiable",
    image: "https://files.heygen.ai/avatar/v3/Kayla-incasualsuit-20220818_0a27a2b6-a45b-11ed-be97-0242ac110002/preview_target.webp",
    gender: "female",
  },
];

// Voice configuration - use language code for automatic voice selection
export const VOICE_OPTIONS = {
  spanish: "es",
  english: "en",
  default: "es", // Spanish as default
};

// Session state management
interface SessionState {
  avatar: StreamingAvatar | null;
  sessionId: string | null;
  isActive: boolean;
  keepAliveInterval: NodeJS.Timeout | null;
  lastActivity: number;
  onStreamReady: ((stream: MediaStream) => void) | null;
  onAvatarStartTalking: (() => void) | null;
  onAvatarStopTalking: (() => void) | null;
  onDisconnected: (() => void) | null;
}

let sessionState: SessionState = {
  avatar: null,
  sessionId: null,
  isActive: false,
  keepAliveInterval: null,
  lastActivity: Date.now(),
  onStreamReady: null,
  onAvatarStartTalking: null,
  onAvatarStopTalking: null,
  onDisconnected: null,
};

// Get access token from HeyGen API
async function getAccessToken(): Promise<string | null> {
  try {
    // Check if API key is present
    if (!HEYGEN_API_KEY) {
      console.error("HeyGen API key is not configured. Please set VITE_HEYGEN_API_KEY in .env file");
      return null;
    }

    console.log("Requesting HeyGen access token...");
    const keyPrefix = HEYGEN_API_KEY?.substring(0, 15);
    console.log("API Key prefix:", keyPrefix + "...");

    // Check if this looks like a trial token vs API key
    // Trial tokens usually don't work with streaming API
    if (HEYGEN_API_KEY.length < 30) {
      console.warn("Warning: API key seems short. Make sure you're using a full API key, not a trial token.");
    }

    const response = await fetch(`${HEYGEN_API_BASE}/streaming.create_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token creation failed:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      // Provide helpful error messages based on status
      if (response.status === 401) {
        console.error("🔑 Invalid API key. Please check your VITE_HEYGEN_API_KEY in .env file.");
      } else if (response.status === 403) {
        console.error("⛔ Access denied. The Streaming Avatar API requires an Enterprise API key from HeyGen.");
        console.error("   Trial tokens do not have access to the Streaming Avatar feature.");
        console.error("   Get your API key at: https://app.heygen.com/settings?nav=API");
      } else if (response.status === 404) {
        console.error("🔍 API endpoint not found. This might be a temporary HeyGen service issue.");
      }

      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Token received successfully");
    return data.data?.token || null;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
}

// Set event callbacks
export function setEventCallbacks(callbacks: {
  onStreamReady?: (stream: MediaStream) => void;
  onAvatarStartTalking?: () => void;
  onAvatarStopTalking?: () => void;
  onDisconnected?: () => void;
}) {
  sessionState.onStreamReady = callbacks.onStreamReady || null;
  sessionState.onAvatarStartTalking = callbacks.onAvatarStartTalking || null;
  sessionState.onAvatarStopTalking = callbacks.onAvatarStopTalking || null;
  sessionState.onDisconnected = callbacks.onDisconnected || null;
}

// Start keep-alive interval to prevent session expiry
function startKeepAlive() {
  // Clear existing interval
  if (sessionState.keepAliveInterval) {
    clearInterval(sessionState.keepAliveInterval);
  }

  sessionState.keepAliveInterval = setInterval(async () => {
    if (sessionState.avatar && sessionState.isActive) {
      try {
        // Send keep-alive signal
        // The SDK doesn't have explicit keepAlive, so we check session status
        const timeSinceActivity = Date.now() - sessionState.lastActivity;

        // If inactive for too long, the session might expire
        // HeyGen sessions typically last 10-15 minutes
        if (timeSinceActivity > SESSION_TIMEOUT_WARNING) {
          console.log("Session may expire soon, consider renewing");
        }
      } catch (error) {
        console.error("Keep-alive error:", error);
      }
    }
  }, SESSION_KEEP_ALIVE_INTERVAL);
}

// Stop keep-alive interval
function stopKeepAlive() {
  if (sessionState.keepAliveInterval) {
    clearInterval(sessionState.keepAliveInterval);
    sessionState.keepAliveInterval = null;
  }
}

// Currently selected avatar ID (can be changed before initialization)
let selectedAvatarId: string | null = null;

// Set the avatar to use for the next session
export function setSelectedAvatar(avatarId: string): void {
  selectedAvatarId = avatarId;
  console.log("Selected avatar:", avatarId);
}

// Get the currently selected avatar
export function getSelectedAvatar(): string | null {
  return selectedAvatarId;
}

// Initialize and start avatar session
export async function initializeAvatar(avatarId?: string): Promise<boolean> {
  try {
    // If session already active, return true
    if (sessionState.avatar && sessionState.isActive) {
      console.log("Avatar session already active");
      return true;
    }

    // Get fresh access token
    const token = await getAccessToken();
    if (!token) {
      console.error("Failed to get access token");
      return false;
    }

    // Create new StreamingAvatar instance
    sessionState.avatar = new StreamingAvatar({ token });

    // Set up event listeners
    sessionState.avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
      console.log("Stream ready:", event);
      sessionState.isActive = true;
      sessionState.lastActivity = Date.now();

      if (event.detail && sessionState.onStreamReady) {
        sessionState.onStreamReady(event.detail);
      }
    });

    sessionState.avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
      console.log("Avatar started talking");
      sessionState.lastActivity = Date.now();

      if (sessionState.onAvatarStartTalking) {
        sessionState.onAvatarStartTalking();
      }
    });

    sessionState.avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
      console.log("Avatar stopped talking");
      sessionState.lastActivity = Date.now();

      if (sessionState.onAvatarStopTalking) {
        sessionState.onAvatarStopTalking();
      }
    });

    sessionState.avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      sessionState.isActive = false;
      stopKeepAlive();

      if (sessionState.onDisconnected) {
        sessionState.onDisconnected();
      }
    });

    // Use the provided avatar ID, or the selected one, or try defaults
    const preferredAvatarId = avatarId || selectedAvatarId;

    // Start the avatar session with minimal configuration
    // Try different avatar configurations if the first fails
    const avatarConfigs = preferredAvatarId
      ? [
          { avatarName: preferredAvatarId, quality: AvatarQuality.Medium },
          { avatarName: "Angela-inblackskirt-20220820", quality: AvatarQuality.Medium },
          { avatarName: "default", quality: AvatarQuality.Low },
        ]
      : [
          { avatarName: "Angela-inblackskirt-20220820", quality: AvatarQuality.Medium },
          { avatarName: "Daisy-inskirt-20220818", quality: AvatarQuality.Medium },
          { avatarName: "default", quality: AvatarQuality.Low },
        ];

    let sessionInfo = null;
    let lastError = null;

    for (const config of avatarConfigs) {
      try {
        console.log("Trying avatar configuration:", config);

        sessionInfo = await sessionState.avatar.createStartAvatar({
          quality: config.quality,
          avatarName: config.avatarName,
          language: "es", // Spanish
        });

        if (sessionInfo) {
          console.log("Avatar session started successfully with:", config.avatarName);
          break;
        }
      } catch (configError: any) {
        console.warn(`Avatar config ${config.avatarName} failed:`, configError?.message);
        lastError = configError;
        // Continue to try next config
      }
    }

    if (!sessionInfo) {
      throw lastError || new Error("Failed to start avatar with any configuration");
    }

    sessionState.sessionId = sessionInfo.session_id;
    console.log("Avatar session started:", sessionInfo.session_id);

    // Start keep-alive
    startKeepAlive();

    return true;
  } catch (error: any) {
    console.error("Error initializing avatar:", error);
    console.error("Error details:", {
      message: error?.message,
      status: error?.status,
      response: error?.response,
    });

    // Check quota to provide better error message
    try {
      const quota = await getStreamingQuota();
      if (quota && quota.remaining <= 0) {
        console.error("⚠️ Streaming quota exhausted! Remaining:", quota.remaining, "Used:", quota.used);
        console.error("   You need to upgrade your HeyGen plan or wait for quota reset.");
      }
    } catch {
      // Ignore quota check errors
    }

    sessionState.isActive = false;
    return false;
  }
}

// Make avatar speak text
export async function speakText(text: string): Promise<boolean> {
  try {
    // Check if session is active, if not, reinitialize
    if (!sessionState.avatar || !sessionState.isActive) {
      console.log("Session not active, reinitializing...");
      const initialized = await initializeAvatar();
      if (!initialized) {
        console.error("Failed to reinitialize avatar");
        return false;
      }
      // Wait a bit for session to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!sessionState.avatar) {
      console.error("Avatar not available");
      return false;
    }

    // Update activity timestamp
    sessionState.lastActivity = Date.now();

    // Make avatar speak
    await sessionState.avatar.speak({
      text: text,
      taskType: TaskType.REPEAT, // Just repeat the text, don't use AI
    });

    return true;
  } catch (error) {
    console.error("Error making avatar speak:", error);

    // If error might be due to session expiry, try to reinitialize
    if (String(error).includes("session") || String(error).includes("token")) {
      console.log("Session may have expired, attempting to reinitialize...");
      sessionState.isActive = false;

      // Try to reinitialize and speak again
      const reinitialized = await initializeAvatar();
      if (reinitialized && sessionState.avatar) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          await sessionState.avatar.speak({
            text: text,
            taskType: TaskType.REPEAT,
          });
          return true;
        } catch (retryError) {
          console.error("Retry failed:", retryError);
        }
      }
    }

    return false;
  }
}

// Interrupt current speech
export async function interruptSpeech(): Promise<boolean> {
  try {
    if (sessionState.avatar && sessionState.isActive) {
      await sessionState.avatar.interrupt();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error interrupting speech:", error);
    return false;
  }
}

// Stop and cleanup avatar session
export async function stopAvatar(): Promise<void> {
  try {
    stopKeepAlive();

    if (sessionState.avatar) {
      await sessionState.avatar.stopAvatar();
    }
  } catch (error) {
    console.error("Error stopping avatar:", error);
  } finally {
    sessionState.avatar = null;
    sessionState.sessionId = null;
    sessionState.isActive = false;
  }
}

// Check if avatar session is active
export function isAvatarActive(): boolean {
  return sessionState.isActive && sessionState.avatar !== null;
}

// Get current session ID
export function getSessionId(): string | null {
  return sessionState.sessionId;
}

// Check HeyGen API availability and list available avatars
export async function checkHeyGenStatus(): Promise<boolean> {
  try {
    // Check streaming avatars list
    console.log("Checking HeyGen API status...");

    const response = await fetch(`${HEYGEN_API_BASE}/interactive_avatars`, {
      method: "GET",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Available interactive avatars:", data);
      return true;
    } else {
      const errorText = await response.text();
      console.error("HeyGen API check failed:", response.status, errorText);

      // Check if it's a subscription/access issue
      if (response.status === 403 || response.status === 401) {
        console.error("⚠️ Your HeyGen API key may not have access to Interactive Avatars.");
        console.error("   This feature requires an Enterprise subscription.");
        console.error("   Visit: https://www.heygen.com/pricing to check your plan.");
      }

      return false;
    }
  } catch (error) {
    console.error("HeyGen API check failed:", error);
    return false;
  }
}

// Get remaining streaming quota
export async function getStreamingQuota(): Promise<{ remaining: number; used: number } | null> {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/streaming.remaining_quota`, {
      method: "GET",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Streaming quota:", data);
      return data.data || null;
    } else {
      console.error("Failed to get streaming quota:", response.status);
      return null;
    }
  } catch (error) {
    console.error("Error getting streaming quota:", error);
    return null;
  }
}
