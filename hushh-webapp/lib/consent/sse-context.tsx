"use client";

/**
 * Consent SSE Context - Unified Server-Sent Events Connection
 * ============================================================
 *
 * PROBLEM SOLVED:
 * Previously, 3 separate SSE connections were opened per user:
 * - ConsentNotificationProvider
 * - ConsentsPage
 * - usePendingConsentCount hook
 *
 * This caused race conditions and unnecessary server load.
 *
 * SOLUTION:
 * Single SSE connection per user session that all components subscribe to.
 * Auto-reconnects with exponential backoff on errors.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { getApiBaseUrl } from "@/lib/services/api-service";
import { getSessionItem } from "@/lib/utils/session-storage";

// ============================================================================
// Types
// ============================================================================

export type ConsentAction =
  | "REQUESTED"
  | "CONSENT_GRANTED"
  | "CONSENT_DENIED"
  | "REVOKED"
  | "TIMEOUT";

export interface ConsentEvent {
  request_id: string;
  action: ConsentAction;
  scope: string;
  agent_id: string;
  timestamp: number;
}

type ConnectionState = "disconnected" | "connecting" | "connected";

interface ConsentSSEContextType {
  /** Latest consent event received */
  lastEvent: ConsentEvent | null;

  /** Current connection state */
  connectionState: ConnectionState;

  /** Whether connection is active */
  isConnected: boolean;

  /** Force reconnect (useful after errors) */
  reconnect: () => void;

  /** Event counter (increments on each event, useful for useEffect deps) */
  eventCount: number;
}

// ============================================================================
// Context
// ============================================================================

const ConsentSSEContext = createContext<ConsentSSEContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ConsentSSEProviderProps {
  children: ReactNode;
}

export function ConsentSSEProvider({ children }: ConsentSSEProviderProps) {
  const [lastEvent, setLastEvent] = useState<ConsentEvent | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [eventCount, setEventCount] = useState(0);

  // Refs for reconnection logic
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  // Max backoff: 30 seconds
  const MAX_RECONNECT_DELAY = 30000;
  const BASE_RECONNECT_DELAY = 2000;

  const connect = useCallback(async () => {
    // Get user ID from platform-aware storage
    const userId = await getSessionItem("user_id");
    if (!userId) {
      console.log("🔌 [SSE] No user_id found, skipping connection");
      setConnectionState("disconnected");
      return;
    }

    userIdRef.current = userId;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState("connecting");

    const backendUrl =
      getApiBaseUrl() ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:8000";
    const sseUrl = `${backendUrl}/api/consent/events/${userId}`;

    console.log(`🔌 [SSE] Connecting to ${sseUrl}`);

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("✅ [SSE] Connection established");
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0; // Reset backoff on success
    };

    eventSource.addEventListener("consent_update", (event) => {
      console.log("📡 [SSE] Event received:", event.data);

      try {
        const data = JSON.parse(event.data) as ConsentEvent;
        setLastEvent(data);
        setEventCount((prev) => prev + 1);
      } catch (err) {
        console.error("❌ [SSE] Failed to parse event:", err);
      }
    });

    // Heartbeat listener (server sends these to keep connection alive)
    eventSource.addEventListener("heartbeat", () => {
      console.log("💓 [SSE] Heartbeat received");
    });

    eventSource.onerror = (error) => {
      console.error("❌ [SSE] Connection error:", error);
      setConnectionState("disconnected");

      // Close the broken connection
      eventSource.close();
      eventSourceRef.current = null;

      // Exponential backoff for reconnection
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
        MAX_RECONNECT_DELAY
      );

      console.log(
        `🔄 [SSE] Reconnecting in ${delay / 1000}s (attempt ${
          reconnectAttemptsRef.current + 1
        })`
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, delay);
    };
  }, []);

  const reconnect = useCallback(() => {
    // Cancel any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset attempts and connect
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      console.log("🔌 [SSE] Cleaning up connection");

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // Also reconnect if user_id changes (e.g., after login)
  useEffect(() => {
    const checkUserId = async () => {
      const currentUserId = await getSessionItem("user_id");

      // User ID changed (logged in or out)
      if (currentUserId !== userIdRef.current) {
        console.log("👤 [SSE] User changed, reconnecting...");
        reconnect();
      }
    };

    // Check periodically (in case sessionStorage changes)
    const intervalId = setInterval(checkUserId, 5000);

    return () => clearInterval(intervalId);
  }, [reconnect]);

  const value: ConsentSSEContextType = {
    lastEvent,
    connectionState,
    isConnected: connectionState === "connected",
    reconnect,
    eventCount,
  };

  return (
    <ConsentSSEContext.Provider value={value}>
      {children}
    </ConsentSSEContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useConsentSSE(): ConsentSSEContextType {
  const context = useContext(ConsentSSEContext);

  if (!context) {
    throw new Error("useConsentSSE must be used within a ConsentSSEProvider");
  }

  return context;
}

/**
 * Hook that only provides connection status (for components that just need to know if connected)
 */
export function useConsentSSEStatus(): {
  isConnected: boolean;
  connectionState: ConnectionState;
} {
  const { isConnected, connectionState } = useConsentSSE();
  return { isConnected, connectionState };
}
