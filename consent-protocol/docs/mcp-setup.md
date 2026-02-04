# 🔌 MCP Server Setup Guide

This guide explains how to connect the Hushh Consent MCP Server to Claude Desktop or other MCP hosts.

## Prerequisites

- Python 3.10+
- Claude Desktop app installed
- Hushh consent-protocol dependencies installed

## Quick Start

### 1. Install Dependencies

```bash
cd consent-protocol
pip install -r requirements.txt
```

### 2. Test the MCP Server

```bash
python mcp_server.py
```

You should see:

```
[HUSHH-MCP] INFO: ============================================================
[HUSHH-MCP] INFO: 🚀 HUSHH MCP SERVER STARTING
[HUSHH-MCP] INFO: ============================================================
```

Press `Ctrl+C` to stop.

### 3. Configure Claude Desktop

**Config file location:**

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**macOS:** Create or edit the file (use your actual repo path for `args` and `PYTHONPATH`):

```json
{
  "mcpServers": {
    "hushh-consent": {
      "command": "/usr/local/bin/python3",
      "args": [
        "/path/to/hushh-research/consent-protocol/mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "/path/to/hushh-research/consent-protocol"
      }
    }
  }
}
```

**Windows:** (use your actual path; escape backslashes in JSON as `\\`)

```json
{
  "mcpServers": {
    "hushh-consent": {
      "command": "python",
      "args": [
        "C:\\path\\to\\hushh-research\\consent-protocol\\mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "C:\\path\\to\\hushh-research\\consent-protocol"
      }
    }
  }
}
```

> **Important:** Replace `/path/to/hushh-research` (or the Windows path) with your actual directory location.

### 4. Restart Claude Desktop

1. **Fully quit** Claude Desktop (check system tray)
2. **Reopen** Claude Desktop
3. Look for the **🔧 tool icon** - this indicates connected MCP servers

## Available Tools

Once connected, Claude will have access to these tools:

| Tool                       | Description                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| `request_consent`          | Request user consent for a scope (e.g. world_model.read, attr.food.*) |
| `validate_token`           | Validate a consent token before use                               |
| `discover_user_domains`    | Discover which domains a user has and scope strings to request    |
| `list_scopes`              | List available consent scopes (static reference)                   |
| `check_consent_status`     | Poll pending consent until granted or denied                      |
| `get_food_preferences`     | Get food/dining data (requires consent)                           |
| `get_professional_profile` | Get professional data (requires consent)                          |
| `delegate_to_agent`        | Create TrustLink for A2A delegation                               |

Agents can read **`hushh://info/connector`** for full usage, tool list, recommended flow, and supported scopes.

### Recommended flow

1. **Discover domains** — `discover_user_domains(user_id)` to get domains and scope strings for the user.
2. **Request consent** — `request_consent(user_id, scope)` for each scope needed (e.g. `world_model.read` or `attr.food.*`).
3. **If pending** — Poll `check_consent_status(user_id, scope)` until granted or denied.
4. **Use data** — Use the returned consent token with `get_*` tools or world-model data APIs.

## Demo Script

### Step 1: Check Available Tools

```
Claude: "What Hushh tools do you have access to?"
```

### Step 2: Try Access Without Consent

```
Claude: "Get food preferences for user_demo_001"
→ Will be DENIED (no consent token)
```

### Step 3: Request Consent

```
Claude: "Request consent for food data for user_demo_001"
→ Returns a consent token (HCT:...)
```

### Step 4: Access with Consent

```
Claude: "Now get food preferences for user_demo_001 using that token"
→ SUCCESS - returns food preferences
```

### Step 5: Test Scope Isolation

```
Claude: "Get professional profile using the food token"
→ DENIED (wrong scope)
```

## Troubleshooting

| Issue                          | Solution                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| Server not found               | Check PYTHONPATH in config                                               |
| Import errors                  | Run `pip install -r requirements.txt`                                    |
| Claude doesn't see tools       | Fully restart Claude (check system tray)                                 |
| Token errors                   | Ensure `.env` has SECRET_KEY                                             |
| Consent request never appears  | User must have the Hushh app **consent/dashboard page open** so it can poll `GET /api/consent/pending` and show the request. Then SSE will notify the MCP when they approve or deny. |
| Scopes for a user              | Call `discover_user_domains(user_id)` first; scopes come from the world model, not a fixed list. |

## Protocol Compliance

This MCP server enforces the HushhMCP protocol:

- ✅ **Consent First**: No data access without valid token
- ✅ **Scoped Access**: Each data category requires separate consent
- ✅ **Cryptographic Signature**: Tokens signed with HMAC-SHA256
- ✅ **Time-Limited**: Tokens expire after 24 hours
- ✅ **TrustLinks**: Agent-to-agent delegation with proof

---

_Hushh - Your data, your consent, your control._ 🔐
