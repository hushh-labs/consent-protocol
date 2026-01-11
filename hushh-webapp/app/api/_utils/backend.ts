// hushh-webapp/app/api/_utils/backend.ts
//
// Single source of truth for where Next.js API routes proxy to.
//
// Requirements:
// - Local dev should hit local FastAPI by default (http://localhost:8000)
// - Production should default to Cloud Run unless explicitly overridden

const PROD_DEFAULT =
  "https://consent-protocol-1006304528804.us-central1.run.app";
const DEV_DEFAULT = "http://localhost:8000";

export function getPythonApiUrl(): string {
  return (
    process.env.PYTHON_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.NODE_ENV === "production" ? PROD_DEFAULT : DEV_DEFAULT)
  );
}
