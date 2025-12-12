# Hushh Business Roadmap

## Vision

To build the infrastructure for **Personal Data Sovereignty**, enabling users to:

1.  Capture their own digital context (Data).
2.  Control who accesses it (Consent).
3.  Monetize or leverage it for value (Agents).

## Current Status (Alpha)

- [x] **Frontend Foundation:** Minimal Next.js UI established.
- [x] **Protocol:** HushhMCP (Python) core logic available (Tokens, TrustLinks).
- [ ] **Integration:** Connecting UI to Protocol (In Progress).

## Roadmap

### Q1: The Loop (Integration)

_Goal: End-to-end working demo of a user getting value from their data._

- **Shopper Agent:** User grants consent -> Agent finds a deal -> User sees result.
- **Local API:** Running the Python protocol locally to power the UI.

### Q2: The Vault (Storage)

_Goal: Secure, encrypted local storage for user data._

- Implement `Vault` (AES-256) in the Python layer.
- Build "Data Ingestion" Operons (e.g., read email, read receipts).

### Q3: The Network (A2A)

_Goal: Agents talking to Agents._

- Implement **TrustLink** flow where Shopper asks Identity for verification without user intervention.
- "Talk to my Agent" protocol.

### Q4: The Marketplace

_Goal: 3rd Party Agents._

- Developer SDK to write Operons.
- Marketplace for users to install new Agents.
