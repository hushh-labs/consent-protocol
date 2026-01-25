# Contributing to Hushh Research

Thank you for your interest in contributing to Hushh! We are building the future of **Consent-First Personal Data Agents** at [hushh.ai](https://hushh.ai), and we need your help to make it robust, secure, and user-centric.

## 🛑 Critical Architecture Rules

Before you write a single line of code, understand our three non-negotiable rules. Violating these will result in your PR being rejected.

### 1. The Tri-Flow Rule (Web + iOS + Android)

Hushh is a cross-platform application. **Every feature** that touches backend data or device capabilities must be implemented in three layers:

1.  **Web**: Next.js proxy route (`app/api/...`)
2.  **iOS**: Swift Capacitor Plugin (`ios/App/App/Plugins/...`)
3.  **Android**: Kotlin Capacitor Plugin (`android/app/.../plugins/...`)

**Why?** The native apps do _not_ run the Next.js server locally. They need native plugins to talk to the Python backend. If you only implement the Web flow, the feature will break on mobile.

### 2. Consent-First

- **No Implicit Access**: Even the vault owner needs a token (`VAULT_OWNER` scope).
- **No Backdoors**: Never bypass token validation "just for testing".
- **Validate Early**: Check consent tokens at the API entry point.

### 3. Zero-Knowledge (BYOK)

- **Client-Side Keys**: The vault key never leaves the user's device.
- **Ciphertext Only**: The server only stores encrypted data.
- **Memory-Only**: In the web app, keys live in React Context, not `localStorage`.

---

## 🚀 Getting Started

Please read our [Getting Started Guide](GETTING_STARTED.md) to set up your development environment.

You will need:

- Node.js v20+
- Python 3.11+
- PostgreSQL
- Xcode (for iOS)
- Android Studio (for Android)

---

## 🛠 How to Contribute

1.  **Find an Issue**: Look for issues tagged `good-first-issue` or `help-wanted`.
2.  **Fork the Repo**: Create your own fork on GitHub.
3.  **Create a Branch**: Use a descriptive name:
    - `feat/add-movie-agent`
    - `fix/vault-unlock-race-condition`
    - `docs/update-readme`
4.  **Implement the Tri-Flow**: Ensure your change works on Web, iOS, and Android.
5.  **Test Locally**: Verify the change on all supported platforms (simulators/emulators).
6.  **Submit a Pull Request**: targeted at the `main` branch.
    - `main` is protected: PRs require approval and CI checks.
    - `deploy-production` is protected: Only deployed via authorized workflows.

---

## ✅ Pull Request Guidelines

When you open a PR, please use this template:

### Description

Briefly explain what you changed and why.

### Tri-Flow Checklist

- [ ] Web Implementation (Next.js route)
- [ ] iOS Implementation (Swift Plugin)
- [ ] Android Implementation (Kotlin Plugin)
- [ ] Service Layer (Platform detection logic)
- [ ] TypeScript Interface (`lib/capacitor/index.ts`)

### Testing

- [ ] Tested on Web (Chrome/Safari)
- [ ] Tested on iOS Simulator
- [ ] Tested on Android Emulator

### Screenshots/Video

Attach a screen recording or screenshot of the feature in action.

---

## 🧩 Directory Structure

- `consent-protocol/`: Python Backend & MCP Server
- `hushh-webapp/`: Next.js Frontend
- `hushh-webapp/ios/`: Native iOS Code
- `hushh-webapp/android/`: Native Android Code
- `docs/`: Documentation (Single Source of Truth)

---

## 🤝 Community

- **Discord**: [Join our Discord](https://discord.gg/fd38enfsH5)

## 📄 License

By contributing to Hushh, you agree that your contributions will be licensed under the MIT License.

---

Thank you for building with us!
