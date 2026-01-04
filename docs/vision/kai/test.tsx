/**
 * Kai Investor Onboarding — Data Types & KPIs
 *
 * These are the data points and metrics the founder expects
 * for the Kai investor onboarding system.
 *
 * @see founder-thoughts.md for full vision
 * @see v0-onboarding.md for 5-7 day delivery scope
 */

// =============================================================================
// CORE ONBOARDING TYPES
// =============================================================================

/**
 * Onboarding session — tracks an investor's journey through Kai
 */
export interface OnboardingSession {
  sessionId: string;
  investorId: string;
  fundId: string; // e.g., "fund_a" for Hushh Technology Fund L.P.
  status: OnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // KPIs - measured per session
  timeToConsent?: number; // seconds from intro to consent
  timeToCompletion?: number; // seconds from start to completion
  touchCount: number; // number of investor interactions
}

export type OnboardingStatus =
  | "intro_shown"
  | "manager_selected"
  | "consent_granted"
  | "manager_notified"
  | "pending_verification"
  | "verification_complete"
  | "completed"
  | "abandoned";

// =============================================================================
// TRUST GRAPH — The Invisible Genius Move
// =============================================================================

/**
 * Trust relationship between investor and their manager
 *
 * From founder vision:
 * "Great investors already trust someone to manage their money."
 */
export interface TrustRelationship {
  investorId: string;
  managerId: string;
  managerType: ManagerType;
  managerName: string;
  managerEmail?: string;
  managerPhone?: string;

  // Consent state
  consentGranted: boolean;
  consentScope: ConsentScope[];
  consentGrantedAt?: Date;
  consentRevokedAt?: Date;

  // Verification state
  kycVerified: boolean;
  kycVerifiedAt?: Date;
  kycSource?: string;
  amlVerified: boolean;
  amlVerifiedAt?: Date;
  amlSource?: string;
  accreditationVerified: boolean;
  accreditationVerifiedAt?: Date;
}

/**
 * Manager types — the trusted intermediaries
 *
 * From founder vision:
 * "Family office, RIA, Fund administrator, Private bank, Custodian, Money manager"
 */
export type ManagerType =
  | "family_office"
  | "ria" // Registered Investment Advisor
  | "fund_administrator"
  | "private_bank"
  | "custodian"
  | "money_manager"
  | "self_managed"; // Investor manages themselves

/**
 * Consent scope — what Kai can coordinate on
 *
 * From founder vision:
 * "Consent is: Specific, Revocable, Scoped"
 */
export type ConsentScope =
  | "kyc_verification"
  | "aml_verification"
  | "accreditation"
  | "wiring_instructions"
  | "subscription_docs"
  | "contact_coordination";

// =============================================================================
// INVESTOR IDENTITY
// =============================================================================

export interface Investor {
  investorId: string;
  email: string;
  fullName?: string;

  // Identity verification
  identityVerified: boolean;
  identityVerifiedAt?: Date;
  identityVerificationMethod?: "google_sso" | "biometric" | "manual";

  // Contact
  phone?: string;
  preferredContact?: "email" | "phone";
}

// =============================================================================
// CONSENT RECORD — Audit Trail
// =============================================================================

/**
 * Consent grant — immutable record of consent
 *
 * From founder vision:
 * "Everything is logged. Everything is auditable."
 */
export interface ConsentGrant {
  consentId: string;
  sessionId: string;
  investorId: string;
  managerId: string;
  managerType: ManagerType;

  // Scope
  scope: ConsentScope[];
  purpose: string; // e.g., "lp_onboarding_fund_a"

  // Timing
  grantedAt: Date;
  expiresAt: Date;

  // State
  revoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

// =============================================================================
// AUDIT TRAIL
// =============================================================================

export interface AuditEntry {
  entryId: string;
  sessionId: string;
  timestamp: Date;

  // What happened
  action: AuditAction;
  actor: string; // who performed the action
  target?: string; // who was affected

  // Context
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;

  // Security
  integrityHash?: string; // for tamper detection
}

export type AuditAction =
  | "session_started"
  | "intro_viewed"
  | "manager_type_selected"
  | "manager_details_entered"
  | "consent_screen_viewed"
  | "consent_granted"
  | "consent_revoked"
  | "manager_notified"
  | "kyc_verification_requested"
  | "kyc_verification_received"
  | "aml_verification_requested"
  | "aml_verification_received"
  | "subscription_docs_generated"
  | "wire_instructions_prepared"
  | "session_completed"
  | "session_abandoned";

// =============================================================================
// OPERONS — V0 Delivery (5-7 days)
// =============================================================================

/**
 * Operon: create_investor_profile
 * Store identity + trusted manager
 */
export interface CreateInvestorProfileInput {
  email: string;
  identityVerificationMethod: "google_sso";
}

export interface CreateInvestorProfileOutput {
  investorId: string;
  sessionId: string;
  status: "created";
}

/**
 * Operon: request_manager_consent
 * Display consent screen, capture grant
 */
export interface RequestManagerConsentInput {
  sessionId: string;
  investorId: string;
  managerType: ManagerType;
  managerName: string;
  managerEmail?: string;
  scope: ConsentScope[];
}

export interface RequestManagerConsentOutput {
  consentId: string;
  status: "granted" | "denied";
  grantedAt?: Date;
}

/**
 * Operon: initiate_kyc_handoff
 * Begin KYC/AML through trusted manager
 */
export interface InitiateKycHandoffInput {
  sessionId: string;
  consentId: string;
  managerId: string;
}

export interface InitiateKycHandoffOutput {
  handoffId: string;
  notificationStatus: "sent" | "failed";
  notificationMethod: "email" | "webhook";
  sentAt: Date;
}

// =============================================================================
// KPIs & METRICS — What the Founder Expects
// =============================================================================

/**
 * Primary success metrics for Kai Investor Onboarding
 *
 * From founder vision:
 * "The fastest, safest way serious money enters serious funds."
 */
export interface OnboardingKPIs {
  // Conversion
  completionRate: number; // Target: > 70% (V0), > 85% (V1)
  abandonmentRate: number; // Target: < 30% (V0), < 15% (V1)

  // Speed
  timeToConsentAvg: number; // Target: < 2 minutes
  timeToCompletionAvg: number; // Target: < 48 hours

  // Efficiency
  investorTouchesAvg: number; // Target: ≤ 3
  documentDuplicationRate: number; // Target: 0%

  // Quality
  lpSatisfactionScore: number; // Target: > 4.5/5
  complianceFlags: number; // Target: < 5% of sessions
  auditCompleteness: number; // Target: 100%

  // Growth
  lpReferralRate: number; // Target: > 30% (12 months)
  repeatInvestorTime: number; // Target: < 24 hours
}

/**
 * Session-level analytics
 */
export interface SessionAnalytics {
  sessionId: string;

  // Funnel
  introViewedAt?: Date;
  managerSelectedAt?: Date;
  consentGrantedAt?: Date;
  completedAt?: Date;

  // Drop-off points
  abandonedAt?: Date;
  abandonedStep?: OnboardingStatus;

  // Calculated metrics
  timeToConsent?: number; // seconds
  timeToCompletion?: number; // seconds
  touchCount: number;
}

// =============================================================================
// V0 DELIVERY SCOPE
// =============================================================================

/**
 * V0 API Endpoints
 */
export const V0_ENDPOINTS = {
  // Session management
  startSession: "POST /api/onboarding/start",
  getSession: "GET /api/onboarding/:sessionId",

  // Flow steps
  selectManager: "POST /api/onboarding/:sessionId/manager",
  grantConsent: "POST /api/onboarding/:sessionId/consent",
  notifyManager: "POST /api/onboarding/:sessionId/notify",
  completeSession: "POST /api/onboarding/:sessionId/complete",

  // Audit
  getAuditTrail: "GET /api/audit/:sessionId",
} as const;

/**
 * V0 feature flags for phased rollout
 */
export interface V0FeatureFlags {
  enableBiometricConsent: boolean; // Phase 2
  enableA2AProtocol: boolean; // Phase 2
  enableSubscriptionDocs: boolean; // Phase 2
  enableWireInstructions: boolean; // Phase 2
  enableManagerPortal: boolean; // Phase 2
  enablePatternLearning: boolean; // Phase 3
}

export const V0_FEATURE_FLAGS: V0FeatureFlags = {
  enableBiometricConsent: false,
  enableA2AProtocol: false,
  enableSubscriptionDocs: false,
  enableWireInstructions: false,
  enableManagerPortal: false,
  enablePatternLearning: false,
};
