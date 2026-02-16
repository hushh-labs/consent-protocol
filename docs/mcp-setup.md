# MCP Server Setup Guide

This guide explains how to connect the Hushh Consent MCP Server to Claude Desktop or other MCP hosts. The server uses the `mcp` Python SDK with stdio transport (JSON-RPC 2.0 over stdin/stdout).

## Prerequisites

- Python 3.13+
- Claude Desktop app installed (or another MCP host such as Cursor)
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

You should see output on stderr:

```
[HUSHH-MCP] INFO: ============================================================
[HUSHH-MCP] INFO: HUSHH MCP SERVER STARTING
[HUSHH-MCP] INFO: ============================================================
```

Press `Ctrl+C` to stop.

### 3. Configure Claude Desktop

You have two options: **automatic** (recommended) or **manual**.

#### Option A: Automatic Setup (recommended)

Run the setup script to auto-generate and install the Claude Desktop config:

```bash
python setup_mcp.py
```

The script will:

1. Detect the `consent-protocol` directory path
2. Generate `claude_desktop_config.generated.json` with correct absolute paths
3. Prompt you to install it directly into the Claude Desktop config location
4. Merge the `hushh-consent` server entry into any existing config

#### Option B: Manual Configuration

**Config file location:**

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Create or edit the file (replace paths with your actual directory locations):

**macOS / Linux:**

```json
{
  "mcpServers": {
    "hushh-consent": {
      "command": "python",
      "args": [
        "/path/to/consent-protocol/mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "/path/to/consent-protocol"
      }
    }
  }
}
```

**Windows:** (escape backslashes as `\\`)

```json
{
  "mcpServers": {
    "hushh-consent": {
      "command": "python",
      "args": [
        "C:\\path\\to\\consent-protocol\\mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "C:\\path\\to\\consent-protocol"
      }
    }
  }
}
```

> **Important:** Replace the placeholder paths with your actual directory location. The `PYTHONPATH` must point to the `consent-protocol` directory so that module imports resolve correctly.

### 4. Restart Claude Desktop

1. **Fully quit** Claude Desktop (check the system tray / menu bar)
2. **Reopen** Claude Desktop
3. Look for the **tool icon** in the input area -- this indicates connected MCP servers

## Available Tools (9 tools)

Once connected, the MCP host has access to these 9 tools:

| Tool                       | Description                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- |
| `request_consent`          | Request user consent for a scope (e.g. `world_model.read`, `attr.food.*`)       |
| `validate_token`           | Validate a consent token's signature, expiration, and scope before use          |
| `get_financial_profile`    | Get financial profile data (requires `attr.financial.*` or `world_model.read`)  |
| `get_food_preferences`     | Get food/dining preferences (requires `attr.food.*` or `world_model.read`)     |
| `get_professional_profile` | Get professional profile (requires `attr.professional.*` or `world_model.read`) |
| `delegate_to_agent`        | Create a TrustLink for agent-to-agent (A2A) delegation                          |
| `list_scopes`              | List available consent scope categories (static reference)                      |
| `discover_user_domains`    | Discover which domains a user has and the scope strings to request              |
| `check_consent_status`     | Check current status of a pending consent request                               |

## MCP Resources (3 resources)

The server also exposes three read-only MCP resources that agents can query for self-documentation:

| URI                        | Name                                | Description                                                           |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `hushh://info/server`      | Server Information                  | Server version, transport, tool count, and compliance checklist       |
| `hushh://info/protocol`    | Protocol Information                | HushhMCP protocol principles, token format, scope model, ZK details  |
| `hushh://info/connector`   | Connector usage and capabilities    | Full tool list, recommended flow, supported scopes, backend details   |

Agents can read `hushh://info/connector` for a machine-readable summary of every tool, the recommended flow, and the dynamic scope model.

## Recommended Flow

Scopes are **dynamic** -- they are derived from the world model registry (`world_model_index_v2.available_domains`) and vary per user. There is no fixed list. Always discover domains first.

1. **Discover domains** -- Call `discover_user_domains(user_id)` to get the user's available domains and the corresponding scope strings (e.g. `attr.financial.*`, `attr.food.*`).
2. **Request consent** -- Call `request_consent(user_id, scope)` for each scope you need. In production mode, this sends an FCM push notification to the user's Hushh app.
3. **Wait for approval** -- If the response status is `pending`, return control to the caller and wait for user action in the Hushh app. Re-check later using `check_consent_status(user_id, scope)`.
4. **Use data** -- Pass the returned consent token (`HCT:...`) to `get_financial_profile`, `get_food_preferences`, `get_professional_profile`, or other data tools.

### Scope model

- `world_model.read` -- Full world model (all domains for the user)
- `world_model.write` -- Write to world model
- `attr.{domain}.*` -- A single domain, where `{domain}` is a key returned by `discover_user_domains` (e.g. `attr.financial.*`, `attr.food.*`, `attr.health.*`, `attr.professional.*`)

Scopes follow the `attr.{domain}.*` pattern and are resolved dynamically. Any well-formed domain key from the world model registry is valid.

## Zero-Knowledge Export

Data returned by `get_*` tools is fetched from an encrypted vault export. The backend encrypts with an export key (`K_export`), and the MCP server decrypts using AES-GCM on the client side. The server never stores plaintext user data at rest.

## Production Mode

When `PRODUCTION_MODE=true` (the default), consent requests require real user approval:

- The user must have the Hushh app installed.
- `request_consent` sends an FCM push notification to the user's device.
- The user reviews and approves (or denies) the request in the Hushh app consent dashboard.
- Consent delivery is FCM-first in production; consent SSE/poll endpoints are disabled for this flow.

Set `PRODUCTION_MODE=false` only for local development without a real user device.

## Environment Variables

| Variable                       | Default                  | Description                                          |
| ------------------------------ | ------------------------ | ---------------------------------------------------- |
| `CONSENT_API_URL`              | `http://localhost:8000`  | FastAPI backend URL for consent API calls             |
| `FRONTEND_URL`                 | `http://localhost:3000`  | Frontend URL for user-facing links                    |
| `PRODUCTION_MODE`              | `true`                   | Require real user approval via Hushh app              |
| `MCP_DEVELOPER_TOKEN`          | `mcp_dev_claude_desktop` | Developer token registered in FastAPI                 |
| `CONSENT_TIMEOUT_SECONDS`      | `120`                    | Max wait time for user to approve consent             |

## Demo Script

### Step 1: Check Available Tools

```
You: "What Hushh tools do you have access to?"
```

The agent should list all 9 tools and 3 resources.

### Step 2: Discover User Domains

```
You: "Discover what data domains are available for user@example.com"
-> Calls discover_user_domains("user@example.com")
-> Returns domains like: financial, food, professional, health
-> Returns scope strings like: attr.financial.*, attr.food.*, etc.
```

### Step 3: Request Consent

```
You: "Request consent to access financial data for user@example.com"
-> Calls request_consent("user@example.com", "attr.financial.*")
-> In production: sends push notification to user's Hushh app
-> Returns status: "pending" (or "granted" if auto-approved in dev mode)
```

### Step 4: Re-check Status Later (production mode)

```
-> Agent checks check_consent_status("user@example.com", "attr.financial.*")
-> User approves in Hushh app dashboard
-> Returns consent token (HCT:...)
```

### Step 5: Access Data with Consent

```
You: "Get the financial profile for user@example.com using that token"
-> Calls get_financial_profile with the consent token
-> SUCCESS: returns decrypted financial data (zero-knowledge export)
```

### Step 6: Test Scope Isolation

```
You: "Get professional profile using the financial token"
-> DENIED: the financial-scoped token cannot access professional data
-> Agent must request separate consent for attr.professional.*
```

## Troubleshooting

| Issue                          | Solution                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| Server not found               | Check `PYTHONPATH` in config points to `consent-protocol` directory      |
| Import errors                  | Run `pip install -r requirements.txt`                                    |
| Claude doesn't see tools       | Fully restart Claude Desktop (check system tray / menu bar)              |
| Tools count mismatch           | Ensure you have the latest `mcp_server.py`; there should be 9 tools     |
| Consent request never appears  | User must have the Hushh app installed; FCM push notifications deliver consent requests |
| Consent times out              | Default timeout is 120s; check `CONSENT_TIMEOUT_SECONDS` env var        |
| Scopes for a user              | Call `discover_user_domains(user_id)` first; scopes come from the world model, not a fixed list |
| Token errors                   | Ensure `.env` has `SECRET_KEY`; check token expiration (24h default)     |
| Auto-setup fails               | Run `python setup_mcp.py` and copy the generated config manually        |

## Protocol Compliance

This MCP server enforces the HushhMCP protocol:

- **Consent First**: No data access without a valid consent token
- **Scoped Access**: Each data category requires separate consent; tokens are scope-isolated
- **Dynamic Scopes**: Scope strings derived from the world model registry, not a hard-coded list
- **Cryptographic Signatures**: Tokens signed with HMAC-SHA256
- **Time-Limited**: Tokens expire after 24 hours by default
- **Zero Knowledge**: Data is encrypted with an export key; MCP server decrypts client-side via AES-GCM
- **TrustLinks**: Agent-to-agent delegation with cryptographic proof of authorization
- **Production Approval**: Real user approval via Hushh app dashboard with FCM push delivery

---

_Hushh -- Your data, your consent, your control._
