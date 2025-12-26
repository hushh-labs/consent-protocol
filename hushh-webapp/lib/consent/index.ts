/**
 * Consent Module Exports
 * ======================
 *
 * Centralized exports for all consent-related utilities.
 */

// SSE Context
export {
  ConsentSSEProvider,
  useConsentSSE,
  useConsentSSEStatus,
  type ConsentEvent,
  type ConsentAction,
} from "./sse-context";

// Actions Hook
export { useConsentActions, type PendingConsent } from "./use-consent-actions";
