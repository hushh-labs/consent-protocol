/**
 * Database Utility Library
 *
 * Handles storage of encrypted user data.
 * Currently a stub implementation to allow build to pass.
 * TODO: Implement backend API call to persist data to Cloud SQL via db_proxy.
 */

export async function storeUserData(
  userId: string,
  key: string,
  value: string,
  iv: string,
  tag: string
): Promise<boolean> {
  console.log(`[STUB] storeUserData called for user ${userId}, key ${key}`);
  console.log(`[STUB] Value size: ${value.length}, IV: ${iv}, Tag: ${tag}`);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Return success to allow flow to continue
  return true;
}

export async function getAllFoodData(
  userId: string
): Promise<Record<string, unknown> | null> {
  console.log(`[STUB] getAllFoodData called for user ${userId}`);
  return null;
}

export async function getAllProfessionalData(
  userId: string
): Promise<Record<string, unknown> | null> {
  console.log(`[STUB] getAllProfessionalData called for user ${userId}`);
  return null;
}
