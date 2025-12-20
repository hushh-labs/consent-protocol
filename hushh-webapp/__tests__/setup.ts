// __tests__/setup.ts

/**
 * Jest Test Setup
 *
 * Configures mock environment for API route testing.
 */

// Mock environment variables for testing
process.env.ENVIRONMENT_MODE = "development";
process.env.BACKEND_URL = "http://localhost:8000";
process.env.NODE_ENV = "test";

// Mock fetch globally
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
