# Hushh PDA - iOS Local-First Architecture

## Overview

**Local-First Design:** All data is stored locally on-device using SQLCipher.
User can trigger "Sync to Cloud" to push/pull with GCP Cloud SQL.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS App                              │
├─────────────────────────────────────────────────────────────┤
│  WebView (UI)                                               │
│       ↓                                                     │
│  VaultService / ConsentService                              │
│       ↓                                                     │
│  VaultStorageManager (defaults: local)                      │
│       ↓                                                     │
│  LocalVaultStorage                                          │
│       ↓                                                     │
│  SQLCipherDatabase (encrypted SQLite)                       │
│       ↓                                                     │
│  hushh_vault.sqlite                                         │
│                                                             │
│  SyncService (user-triggered)                               │
│       ├→ push (local → cloud)                               │
│       └→ pull (cloud → local)                               │
│             ↓                                               │
│  CloudDBProxy → Cloud Run → CloudSQL                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Database Layer

| Component             | File                                        | Purpose                         |
| --------------------- | ------------------------------------------- | ------------------------------- |
| `SQLCipherDatabase`   | `HushhMCP/Database/SQLCipherDatabase.swift` | Encrypted SQLite wrapper        |
| `LocalVaultStorage`   | `HushhMCP/Cloud/LocalVaultStorage.swift`    | Implements VaultStorageProtocol |
| `CloudVaultStorage`   | `HushhMCP/Cloud/VaultStorageProtocol.swift` | Cloud fallback                  |
| `VaultStorageManager` | `HushhMCP/Cloud/VaultStorageProtocol.swift` | Storage router (defaults local) |

### Sync Layer

| Component         | File                                      | Purpose               |
| ----------------- | ----------------------------------------- | --------------------- |
| `SyncService`     | `HushhMCP/Sync/SyncService.swift`         | Push/pull sync logic  |
| `HushhSyncPlugin` | `Plugins/HushhSync/HushhSyncPlugin.swift` | Capacitor bridge      |
| `CloudDBProxy`    | `HushhMCP/Cloud/CloudDBProxy.swift`       | Cloud Run HTTP client |

## Data Flow

### Write (Always Local First)

```
User action → VaultService → LocalVaultStorage → SQLCipherDatabase
                                                      ↓
                                              sync_status = 'pending'
```

### Sync (User Triggered)

```
User taps Sync → HushhSync.sync() → SyncService.push()
                                          ↓
                                  Get pending records
                                          ↓
                                  POST to /db/vault/setup
                                          ↓
                                  Mark as 'synced'
```

## TypeScript Usage

```typescript
import { HushhSync } from "@/lib/capacitor";

// Sync vault data
const result = await HushhSync.sync({ authToken });
console.log(`Pushed: ${result.pushedRecords}, Pulled: ${result.pulledRecords}`);

// Check sync status
const status = await HushhSync.getSyncStatus();
if (status.hasPendingChanges) {
  // Show sync indicator
}
```

## Database Schema (Local SQLite)

```sql
CREATE TABLE vault_keys (
    user_id TEXT PRIMARY KEY,
    auth_method TEXT,
    encrypted_vault_key TEXT,
    salt TEXT, iv TEXT,
    recovery_encrypted_vault_key TEXT,
    recovery_salt TEXT, recovery_iv TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    sync_status TEXT DEFAULT 'pending'
);
```

## Switching Storage Mode

The abstraction layer makes switching simple:

```swift
// Default: Local-first (current)
VaultStorageManager.shared.useLocal()

// Cloud-only mode (if needed)
VaultStorageManager.shared.useCloud(authToken: token)
```
