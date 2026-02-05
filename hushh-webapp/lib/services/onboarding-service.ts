/**
 * Onboarding Service
 * ==================
 * 
 * Client-side service for managing user onboarding tour completion status.
 * Communicates with backend API to check and mark onboarding completion.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class OnboardingService {
  /**
   * Check if user has completed onboarding tour.
   * 
   * @param userId - The user ID to check
   * @returns Promise<boolean> - True if onboarding completed
   */
  static async checkOnboardingStatus(userId: string): Promise<boolean> {
    try {
      const url = `${API_BASE}/api/onboarding/status?userId=${encodeURIComponent(userId)}`;
      console.log("[OnboardingService] Checking status at:", url);

      const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to check onboarding status:", response.statusText);
        return false;
      }

      const data = await response.json();
      return data.completed || false;
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
      const response = await fetch(`${API_BASE}/api/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        console.error("Failed to complete onboarding:", response.statusText);
        return false;
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error("Error completing onboarding:", error);
      return false;
    }
  }

  /**
   * Reset onboarding status (for testing/debugging).
   * Note: This would require a backend endpoint to be implemented.
   * 
   * @param userId - The user ID
   */
  static async resetOnboarding(userId: string): Promise<void> {
    console.log(`Reset onboarding for ${userId} - implement backend endpoint if needed`);
  }
}
