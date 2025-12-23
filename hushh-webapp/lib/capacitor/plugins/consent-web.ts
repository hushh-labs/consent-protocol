/**
 * HushhConsent Web Fallback Implementation
 *
 * This implementation is used when running in a browser (web/cloud mode).
 * It calls the existing API routes instead of native Swift plugins.
 *
 * NOTE: In native iOS mode, the Swift plugin implementation is used instead.
 */

import { WebPlugin } from "@capacitor/core";
import type {
  IssueTokenOptions,
  IssueTokenResult,
  ValidateTokenOptions,
  ValidateTokenResult,
  RevokeTokenOptions,
  CreateTrustLinkOptions,
  TrustLink,
  VerifyTrustLinkOptions,
  VerifyTrustLinkResult,
} from "../types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export class HushhConsentWeb extends WebPlugin {
  async issueToken(options: IssueTokenOptions): Promise<IssueTokenResult> {
    const response = await fetch(`${BACKEND_URL}/api/consent/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: options.userId,
        agent_id: options.agentId,
        scope: options.scope,
        expires_in_ms: options.expiresInMs,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to issue token: ${error}`);
    }

    const data = await response.json();
    return {
      token: data.token,
      tokenId: data.token_id || data.token.slice(0, 32),
      expiresAt: data.expires_at,
    };
  }

  async validateToken(
    options: ValidateTokenOptions
  ): Promise<ValidateTokenResult> {
    const response = await fetch(`${BACKEND_URL}/api/consent/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: options.token,
        expected_scope: options.expectedScope,
      }),
    });

    if (!response.ok) {
      return {
        valid: false,
        reason: "Token validation failed",
      };
    }

    const data = await response.json();
    return {
      valid: data.valid,
      reason: data.reason,
      agentId: data.agent_id,
      userId: data.user_id,
      scope: data.scope,
    };
  }

  async revokeToken(options: RevokeTokenOptions): Promise<void> {
    const response = await fetch(`${BACKEND_URL}/api/consent/revoke-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: options.token }),
    });

    if (!response.ok) {
      throw new Error("Failed to revoke token");
    }
  }

  async isTokenRevoked(options: {
    token: string;
  }): Promise<{ revoked: boolean }> {
    const response = await fetch(`${BACKEND_URL}/api/consent/is-revoked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: options.token }),
    });

    if (!response.ok) {
      return { revoked: false };
    }

    const data = await response.json();
    return { revoked: data.revoked };
  }

  async createTrustLink(options: CreateTrustLinkOptions): Promise<TrustLink> {
    const response = await fetch(`${BACKEND_URL}/api/trust/create-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_agent: options.fromAgent,
        to_agent: options.toAgent,
        scope: options.scope,
        signed_by_user: options.signedByUser,
        expires_in_ms: options.expiresInMs,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create trust link");
    }

    const data = await response.json();
    return {
      fromAgent: data.from_agent,
      toAgent: data.to_agent,
      scope: data.scope,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      signedByUser: data.signed_by_user,
      signature: data.signature,
    };
  }

  async verifyTrustLink(
    options: VerifyTrustLinkOptions
  ): Promise<VerifyTrustLinkResult> {
    const response = await fetch(`${BACKEND_URL}/api/trust/verify-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        link: {
          from_agent: options.link.fromAgent,
          to_agent: options.link.toAgent,
          scope: options.link.scope,
          created_at: options.link.createdAt,
          expires_at: options.link.expiresAt,
          signed_by_user: options.link.signedByUser,
          signature: options.link.signature,
        },
        required_scope: options.requiredScope,
      }),
    });

    if (!response.ok) {
      return { valid: false, reason: "Verification failed" };
    }

    const data = await response.json();
    return {
      valid: data.valid,
      reason: data.reason,
    };
  }
}
