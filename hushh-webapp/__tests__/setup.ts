// __tests__/setup.ts

/**
 * Vitest Test Setup
 *
 * Configures mock environment for API route testing.
 */

import { vi } from "vitest";

// Mock environment variables for testing
process.env.ENVIRONMENT_MODE = "development";
process.env.BACKEND_URL = "http://localhost:8000";
process.env.NODE_ENV = "test";

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
