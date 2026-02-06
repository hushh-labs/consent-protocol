import { Capacitor } from "@capacitor/core";
import { HushhOnboarding } from "@/lib/capacitor";
import { AuthService } from "@/lib/services/auth-service";

/** On native, wait for Capacitor bridge to be ready before calling plugins. */
function waitForBridgeReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export class OnboardingService {
  /**
   * Check if user has completed onboarding tour.
   *
   * On native, defers the check until the Capacitor bridge is ready to avoid
   * calling the plugin before it is registered.
   *
   * @param userId - The user ID to check
   * @returns Promise<boolean> - True if onboarding completed
   */
  static async checkOnboardingStatus(userId: string): Promise<boolean> {
    try {
      await waitForBridgeReady();
      const authToken = (await AuthService.getIdToken()) ?? undefined;
      const result = await HushhOnboarding.checkOnboardingStatus({
        userId,
        authToken,
      });
      return result.completed;
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      return false;
    }
  }

  /**
   * Mark user's onboarding as complete.
   * 
   * @param userId - The user ID
   * @returns Promise<boolean> - True if successful
   */
  static async completeOnboarding(userId: string): Promise<boolean> {
    try {
      const authToken = (await AuthService.getIdToken()) ?? undefined;
      const result = await HushhOnboarding.completeOnboarding({
        userId,
        authToken,
      });
      return result.success;
    } catch (error) {
      console.error("Error completing onboarding:", error);
      return false;
    }
  }

  /**
   * Reset onboarding status (for testing/debugging).
   * 
   * @param userId - The user ID
   */
  static async resetOnboarding(userId: string): Promise<void> {
    console.log(`Reset onboarding for ${userId} - implement backend endpoint if needed`);
  }
}
