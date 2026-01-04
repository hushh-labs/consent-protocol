/**
 * Kai Onboarding — Server Actions
 *
 * V0 Operons for investor onboarding flow.
 * These are Next.js server actions that can be called from the client.
 */

"use server";

import { randomUUID } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export type ManagerType =
  | "family_office"
  | "ria"
  | "private_bank"
  | "self_managed";

export type ConsentScope =
  | "kyc_verification"
  | "aml_verification"
  | "accreditation"
  | "contact_coordination";

export type AuditAction =
  | "session_started"
  | "intro_viewed"
  | "manager_selected"
  | "consent_granted"
  | "consent_denied"
  | "manager_notified"
  | "session_completed";

// =============================================================================
// IN-MEMORY STORAGE (V0 - Replace with PostgreSQL in V1)
// =============================================================================

interface Session {
  sessionId: string;
  userId: string;
  fundId: string;
  status: string;
  managerType: ManagerType | null;
  managerName: string | null;
  managerEmail: string | null;
  consentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Consent {
  consentId: string;
  sessionId: string;
  scope: ConsentScope[];
  grantedAt: Date;
  revoked: boolean;
}

interface AuditEntry {
  entryId: string;
  sessionId: string;
  action: AuditAction;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// V0: In-memory storage (will be PostgreSQL in production)
const sessions: Map<string, Session> = new Map();
const consents: Map<string, Consent> = new Map();
const auditLog: AuditEntry[] = [];

// =============================================================================
// OPERON: create_investor_session
// =============================================================================

export async function createInvestorSession(
  userId: string,
  fundId: string = "fund_a"
): Promise<{ sessionId: string }> {
  const sessionId = `session_${randomUUID()}`;

  const session: Session = {
    sessionId,
    userId,
    fundId,
    status: "intro_shown",
    managerType: null,
    managerName: null,
    managerEmail: null,
    consentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  sessions.set(sessionId, session);

  // Log audit entry
  await logAudit(sessionId, "session_started", { userId, fundId });

  console.log(`[Kai] Created session: ${sessionId} for user: ${userId}`);

  return { sessionId };
}

// =============================================================================
// OPERON: record_manager_selection
// =============================================================================

export async function recordManagerSelection(
  sessionId: string,
  managerType: ManagerType,
  managerName?: string,
  managerEmail?: string
): Promise<{ success: boolean }> {
  const session = sessions.get(sessionId);

  if (!session) {
    console.error(`[Kai] Session not found: ${sessionId}`);
    return { success: false };
  }

  session.managerType = managerType;
  session.managerName = managerName || null;
  session.managerEmail = managerEmail || null;
  session.status = "manager_selected";
  session.updatedAt = new Date();

  sessions.set(sessionId, session);

  // Log audit entry
  await logAudit(sessionId, "manager_selected", {
    managerType,
    managerName,
    managerEmail,
  });

  console.log(
    `[Kai] Manager selected: ${managerType} for session: ${sessionId}`
  );

  return { success: true };
}

// =============================================================================
// OPERON: grant_consent
// =============================================================================

export async function grantConsent(
  sessionId: string,
  scope: ConsentScope[] = [
    "kyc_verification",
    "aml_verification",
    "accreditation",
  ]
): Promise<{ consentId: string; success: boolean }> {
  const session = sessions.get(sessionId);

  if (!session) {
    console.error(`[Kai] Session not found: ${sessionId}`);
    return { consentId: "", success: false };
  }

  const consentId = `consent_${randomUUID()}`;

  const consent: Consent = {
    consentId,
    sessionId,
    scope,
    grantedAt: new Date(),
    revoked: false,
  };

  consents.set(consentId, consent);

  session.consentId = consentId;
  session.status = "consent_granted";
  session.updatedAt = new Date();
  sessions.set(sessionId, session);

  // Log audit entry
  await logAudit(sessionId, "consent_granted", { consentId, scope });

  console.log(`[Kai] Consent granted: ${consentId} for session: ${sessionId}`);

  // Auto-trigger manager notification
  await notifyManager(sessionId, consentId);

  return { consentId, success: true };
}

// =============================================================================
// OPERON: notify_manager
// =============================================================================

export async function notifyManager(
  sessionId: string,
  consentId: string
): Promise<{ notificationId: string; success: boolean }> {
  const session = sessions.get(sessionId);

  if (!session) {
    console.error(`[Kai] Session not found: ${sessionId}`);
    return { notificationId: "", success: false };
  }

  const notificationId = `notif_${randomUUID()}`;

  // V0: Log notification (actual email sending in V1)
  console.log(`[Kai] NOTIFICATION SENT:`);
  console.log(`  To: ${session.managerEmail || "[Manager Email]"}`);
  console.log(`  Manager Type: ${session.managerType}`);
  console.log(`  Session: ${sessionId}`);
  console.log(`  Consent: ${consentId}`);

  // TODO V1: Send actual email via SendGrid
  // await sendEmail({
  //   to: session.managerEmail,
  //   subject: "Kai: LP Onboarding Verification Request",
  //   body: `...`
  // });

  session.status = "manager_notified";
  session.updatedAt = new Date();
  sessions.set(sessionId, session);

  // Log audit entry
  await logAudit(sessionId, "manager_notified", {
    notificationId,
    managerType: session.managerType,
    managerEmail: session.managerEmail,
  });

  return { notificationId, success: true };
}

// =============================================================================
// OPERON: log_audit
// =============================================================================

export async function logAudit(
  sessionId: string,
  action: AuditAction,
  metadata: Record<string, unknown> = {}
): Promise<{ entryId: string }> {
  const entryId = `audit_${randomUUID()}`;

  const entry: AuditEntry = {
    entryId,
    sessionId,
    action,
    metadata,
    timestamp: new Date(),
  };

  auditLog.push(entry);

  console.log(`[Kai Audit] ${action} - Session: ${sessionId}`);

  return { entryId };
}

// =============================================================================
// OPERON: get_session_status (bonus for status page)
// =============================================================================

export async function getSessionStatus(sessionId: string): Promise<{
  session: Session | null;
  consent: Consent | null;
  auditEntries: AuditEntry[];
}> {
  const session = sessions.get(sessionId) || null;
  const consent = session?.consentId
    ? consents.get(session.consentId) || null
    : null;
  const auditEntries = auditLog.filter((e) => e.sessionId === sessionId);

  return { session, consent, auditEntries };
}
