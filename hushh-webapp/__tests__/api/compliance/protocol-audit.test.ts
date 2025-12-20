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
  createMockPOST,
  expectError,
  mockFetch,
} from "../../utils/test-helpers";
import {
  INVALID_TOKENS,
  mockValidationResponse,
  mockFirebaseHeader,
} from "../../utils/mock-tokens";

// Dynamic imports for route handlers
let vaultFoodRoute: { GET: Function; POST: Function };
let vaultProfessionalRoute: { GET: Function; POST: Function };
let vaultGetPreferencesRoute: { GET: Function };
let vaultGetRoute: { GET: Function };
let vaultCheckRoute: { GET: Function };

beforeAll(async () => {
  // Import routes dynamically to allow mocking
  vaultFoodRoute = await import("../../../app/api/vault/food/route");
  vaultProfessionalRoute = await import(
    "../../../app/api/vault/professional/route"
  );
  vaultGetPreferencesRoute = await import(
    "../../../app/api/vault/get-preferences/route"
  );
  vaultGetRoute = await import("../../../app/api/vault/get/route");
  vaultCheckRoute = await import("../../../app/api/vault/check/route");
});

describe("🔐 Protocol Compliance Audit", () => {
  // =========================================================================
  // VAULT WRITE ENDPOINTS - Require Consent Token
  // =========================================================================
  describe("Vault Write Endpoints (require consent token)", () => {
    describe("POST /api/vault/food", () => {
      it("should reject write without consent token", async () => {
        // Set production mode for this test
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockPOST("/api/vault/food", {
          userId: "test_user",
          fieldName: "dietary_restrictions",
          ciphertext: "encrypted_data",
          iv: "iv_value",
          tag: "tag_value",
          // No consentToken!
        });

        const response = await vaultFoodRoute.POST(request);
        await expectError(response, 403, "CONSENT_REQUIRED");

        // Reset to development
        process.env.ENVIRONMENT_MODE = "development";
      });

      it("should reject write with invalid consent token", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        // Mock backend to return invalid
        mockFetch(mockValidationResponse(false, { reason: "Token expired" }));

        const request = createMockPOST("/api/vault/food", {
          userId: "test_user",
          fieldName: "dietary_restrictions",
          ciphertext: "encrypted_data",
          iv: "iv_value",
          tag: "tag_value",
          consentToken: INVALID_TOKENS.expired,
        });

        const response = await vaultFoodRoute.POST(request);
        await expectError(response, 403, "CONSENT_INVALID");

        process.env.ENVIRONMENT_MODE = "development";
      });

      it("should reject write with user mismatch", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        // Token is for different user
        mockFetch(mockValidationResponse(true, { userId: "other_user" }));

        const request = createMockPOST("/api/vault/food", {
          userId: "test_user", // Different from token
          fieldName: "dietary_restrictions",
          ciphertext: "encrypted_data",
          iv: "iv_value",
          tag: "tag_value",
          consentToken: "HCT:valid_token.signature",
        });

        const response = await vaultFoodRoute.POST(request);
        await expectError(response, 403, "USER_MISMATCH");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });

    describe("POST /api/vault/professional", () => {
      it("should reject write without consent token", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockPOST("/api/vault/professional", {
          userId: "test_user",
          fieldName: "skills",
          ciphertext: "encrypted_data",
          iv: "iv_value",
          tag: "tag_value",
        });

        const response = await vaultProfessionalRoute.POST(request);
        await expectError(response, 403, "CONSENT_REQUIRED");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });
  });

  // =========================================================================
  // VAULT READ ENDPOINTS - Require Session Token
  // =========================================================================
  describe("Vault Read Endpoints (require session token)", () => {
    describe("GET /api/vault/food", () => {
      it("should reject read without session token", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockGET("/api/vault/food", {
          userId: "test_user",
        });

        const response = await vaultFoodRoute.GET(request);
        await expectError(response, 401, "SESSION_REQUIRED");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });

    describe("GET /api/vault/get-preferences", () => {
      it("should reject read without session token", async () => {
        process.env.ENVIRONMENT_MODE = "production";

        const request = createMockGET("/api/vault/get-preferences", {
          userId: "test_user",
        });

        const response = await vaultGetPreferencesRoute.GET(request);
        await expectError(response, 401, "SESSION_REQUIRED");

        process.env.ENVIRONMENT_MODE = "development";
      });
    });
  });

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

    it("should allow vault read without session token in dev mode", async () => {
      // Mock database to return empty
      mockFetch({ preferences: null }, 404);

      const request = createMockGET("/api/vault/food", { userId: "test_user" });
      const response = await vaultFoodRoute.GET(request);

      // Should not reject with SESSION_REQUIRED
      expect(response.status).not.toBe(401);
    });
  });
});
