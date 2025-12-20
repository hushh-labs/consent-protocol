// __tests__/api/vault/food.test.ts

/**
 * Food Vault API Tests
 *
 * Tests /api/vault/food endpoint for:
 * - GET: Session token validation
 * - POST: Consent token validation (vault.write.food scope)
 */

import {
  createMockGET,
  createMockPOST,
  expectError,
  expectSuccess,
  mockFetch,
} from "../../utils/test-helpers";
import { VALID_TOKENS, mockValidationResponse } from "../../utils/mock-tokens";

// Dynamic import
let route: { GET: Function; POST: Function };

beforeAll(async () => {
  route = await import("../../../app/api/vault/food/route");
});

describe("/api/vault/food", () => {
  // =========================================================================
  // GET Tests
  // =========================================================================
  describe("GET", () => {
    it("should require userId parameter", async () => {
      const request = createMockGET("/api/vault/food", {});
      const response = await route.GET(request);

      expect(response.status).toBe(400);
    });

    it("should return 404 if no food data exists", async () => {
      // In development mode, token not required
      process.env.ENVIRONMENT_MODE = "development";

      // Mock DB to return null
      jest.mock("@/lib/db", () => ({
        getAllFoodData: jest.fn().mockResolvedValue(null),
      }));

      const request = createMockGET("/api/vault/food", { userId: "test_user" });
      const response = await route.GET(request);

      expect(response.status).toBe(404);
    });
  });

  // =========================================================================
  // POST Tests
  // =========================================================================
  describe("POST", () => {
    it("should require all fields", async () => {
      const request = createMockPOST("/api/vault/food", {
        userId: "test_user",
        // Missing fieldName, ciphertext, iv, tag
      });

      const response = await route.POST(request);
      expect(response.status).toBe(400);
    });

    it("should accept valid consent token with correct scope", async () => {
      process.env.ENVIRONMENT_MODE = "production";

      // Mock backend validation
      mockFetch(
        mockValidationResponse(true, {
          userId: "test_user",
          agentId: "agent_food_dining",
          scope: "vault.write.food",
        })
      );

      // Mock DB store
      jest.mock("@/lib/db", () => ({
        storeFoodData: jest.fn().mockResolvedValue(undefined),
      }));

      const request = createMockPOST("/api/vault/food", {
        userId: "test_user",
        fieldName: "dietary_restrictions",
        ciphertext: "AES256_encrypted_data",
        iv: "random_iv_base64",
        tag: "auth_tag_base64",
        consentToken: VALID_TOKENS.foodWrite,
      });

      const response = await route.POST(request);
      const data = await expectSuccess(response);

      expect(data.success).toBe(true);
      expect(data.domain).toBe("food");

      process.env.ENVIRONMENT_MODE = "development";
    });

    it("should reject consent token with wrong scope", async () => {
      process.env.ENVIRONMENT_MODE = "production";

      // Token has wrong scope
      mockFetch(
        mockValidationResponse(false, {
          reason:
            "Scope mismatch: expected vault.write.food, got vault.read.food",
        })
      );

      const request = createMockPOST("/api/vault/food", {
        userId: "test_user",
        fieldName: "dietary_restrictions",
        ciphertext: "data",
        iv: "iv",
        tag: "tag",
        consentToken: VALID_TOKENS.foodRead, // Wrong - read not write
      });

      const response = await route.POST(request);
      await expectError(response, 403, "CONSENT_INVALID");

      process.env.ENVIRONMENT_MODE = "development";
    });
  });
});
