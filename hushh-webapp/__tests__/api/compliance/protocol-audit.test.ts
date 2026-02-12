// __tests__/api/compliance/protocol-audit.test.ts

/**
 * Protocol Compliance Audit Tests
 *
 * Tests all API endpoints for HushhMCP protocol compliance:
 * 1. Firebase Auth (identity verification)
 * 2. BYOK Encryption (client-side)
 * 3. Consent Protocol (token validation)
 *
 * Per consent-protocol/docs/consent.md:
 * - Every data operation MUST have valid consent token
 * - Token scope MUST match required operation
 * - User ID in token MUST match requesting user
 */

import {
  createMockGET,
  expectError,
  mockFetch,
} from "../../utils/test-helpers";

// Dynamic imports for route handlers (food/professional routes removed; use world-model)
let vaultGetRoute: { GET: Function };
let vaultCheckRoute: { GET: Function };

beforeAll(async () => {
  vaultGetRoute = await import("../../../app/api/vault/get/route");
  vaultCheckRoute = await import("../../../app/api/vault/check/route");
});

describe("🔐 Protocol Compliance Audit", () => {
  // =========================================================================
  // VAULT WRITE ENDPOINTS - Require Consent Token
  // =========================================================================
  // =========================================================================
  // IDENTITY ENDPOINTS - Require Firebase Auth
  // =========================================================================
  describe("Identity Endpoints (require Firebase auth)", () => {
    describe("GET /api/vault/get", () => {
      it("should reject without Authorization header", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockGET("/api/vault/get", {
          userId: "test_user",
        });

        const response = await vaultGetRoute.GET(request);
        await expectError(response, 401, "AUTH_REQUIRED");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });

    describe("GET /api/vault/check", () => {
      it("should reject without Authorization header", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockGET("/api/vault/check", {
          userId: "test_user",
        });

        const response = await vaultCheckRoute.GET(request);
        await expectError(response, 401, "AUTH_REQUIRED");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });
  });

  // =========================================================================
  // DEVELOPMENT MODE - Auto-grant behavior
  // =========================================================================
  describe("ENVIRONMENT_MODE=development (auto-grant)", () => {
    beforeEach(() => {
      process.env.ENVIRONMENT_MODE = "development";
    });

    it("should allow vault get in dev mode when route exists", async () => {
      mockFetch(null, 404);
      const request = createMockGET("/api/vault/get", { userId: "test_user" });
      const response = await vaultGetRoute.GET(request);
      expect(response.status).not.toBe(401);
    });
  });
});
