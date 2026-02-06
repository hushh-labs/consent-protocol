/**
 * HushhOnboarding Web Fallback Implementation
 *
 * This implementation is used when running in a browser (web/cloud mode).
 * It calls the existing API routes instead of native Swift plugins.
 */

import { WebPlugin } from "@capacitor/core";
import type { HushhOnboardingPlugin, OnboardingStatusResult } from "../index";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export class HushhOnboardingWeb extends WebPlugin implements HushhOnboardingPlugin {
  async checkOnboardingStatus(options: {
    userId: string;
    authToken?: string;
  }): Promise<OnboardingStatusResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
    }

    const response = await fetch(
      `${BACKEND_URL}/api/onboarding/status?userId=${encodeURIComponent(options.userId)}`,
      { headers }
    );

    if (!response.ok) {
      return { completed: false, completedAt: null };
    }

    const data = await response.json();
    return {
      completed: data.completed || false,
      completedAt: data.completedAt || null,
    };
  }

  async completeOnboarding(options: {
    userId: string;
    authToken?: string;
  }): Promise<{ success: boolean }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.authToken) {
      headers["Authorization"] = `Bearer ${options.authToken}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/onboarding/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: options.userId }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return { success: data.success || false };
  }
}
