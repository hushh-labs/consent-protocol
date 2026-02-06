import { HushhOnboarding } from "@/lib/capacitor";
import { AuthService } from "@/lib/services/auth-service";

export class OnboardingService {
  /**
   * Check if user has completed onboarding tour.
   * 
   * @param userId - The user ID to check
   * @returns Promise<boolean> - True if onboarding completed
   */
  static async checkOnboardingStatus(userId: string): Promise<boolean> {
    try {
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
