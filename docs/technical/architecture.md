# Hushh System Architecture

## 1. Overview

Hushh is a **Consent-First Personal Data Agent System** designed to give users control over their digital context.

### The Stack

- **Frontend:** Next.js (React) - User Interface for managing Agents and Consent.
- **Protocol:** HushhMCP (Python) - Cryptographic backbone for Permissions and Agent Logic.
- **Backend:** Python API (FastAPI - Planned) - Exposes HushhMCP agents to the Frontend.

## 2. Core Concepts (HushhMCP)

### Operons

The atomic units of logic (e.g., `verify_email`, `extract_receipt`). They are pure, stateless, and testable functions. Think of them as the "Genes" of an Agent.

### Agents

Modular orchestrators that act on behalf of the user.

- **Shopper:** Finds deals, manages value.
- **Identity:** Manages verified credentials.
- **Curator:** Organizes data.
- **Hushh:** The main orchestrator.

### Consent Tokens

Cryptographic proofs (`HUSHH_CT`) that authorize an Agent to perform an action for a specific scope.

- **Stateless:** Validated via HMAC signature.
- **Scoped:** Access is limited (e.g., `vault.read.email`).
- **Short-lived:** Tokens expire to limit risk.

### TrustLinks

Signed relationships allowing Agent-to-Agent (A2A) communication and delegation.

## 3. Data Flow

1.  **User Action:** User clicks "Search Deals" in Next.js UI.
2.  **Consent Request:** UI requests a Consent Token for `agent_shopper`.
3.  **Token Issue:** Identity Agent (local) signs a token.
4.  **API Call:** UI sends Token to Python API (`/agent/shopper/search`).
5.  **Validation:** Python API validates Token HMAC.
6.  **Execution:** If valid, runs the relevant Operon Logic.
7.  **Response:** Results returned to UI.

## 4. Directory Structure

- `/hushh-experimental` -> Frontend application (Next.js)
- `/consent-protocol` -> Core protocol logic (Python)
- `/docs` -> System documentation
