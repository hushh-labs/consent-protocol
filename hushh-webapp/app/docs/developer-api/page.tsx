"use client";

/**
 * Developer API Documentation
 *
 * Matches the format of https://www.hushh.ai/developer-Api/rootEndpoints
 * with our Morphy design system.
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/lib/morphy-ux/morphy";
import {
  Code,
  Lock,
  Key,
  Shield,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/morphy";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

function CodeBlock({
  code,
  language = "bash",
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="relative">
      <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 text-sm overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

export default function DeveloperApiPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Root Endpoints</h1>
        <p className="text-lg text-muted-foreground">
          Secure way of accessing personal information via the Hushh Consent
          Protocol.
        </p>
      </div>

      {/* Consent Flow Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-500" />
          Consent Flow
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground">
              Hushh places user consent at the heart of data sharing. Even if a
              user's data exists in Hushh, your application must explicitly
              request user permission to access it. This ensures privacy,
              transparency, and compliance with regulations like GDPR.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-2xl font-bold text-blue-500 mb-2">1</div>
                <h4 className="font-semibold">Request Consent</h4>
                <p className="text-sm text-muted-foreground">
                  Call request-consent with scope
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-2xl font-bold text-blue-500 mb-2">2</div>
                <h4 className="font-semibold">User Approves</h4>
                <p className="text-sm text-muted-foreground">
                  User grants or denies access
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-2xl font-bold text-blue-500 mb-2">3</div>
                <h4 className="font-semibold">Access Data</h4>
                <p className="text-sm text-muted-foreground">
                  Use consent token to fetch data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Cards & Consents Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Cards & Consents</h2>

        {/* Request Consent */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                POST
              </span>
              <code className="text-base font-mono">
                /api/v1/request-consent
              </code>
              <Lock className="h-4 w-4 text-yellow-500 ml-auto" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-muted-foreground">
                When a user's consent is required for data access (e.g., food
                preferences, professional profile), call this endpoint to
                request user permission. The user is notified about the request
                with details of the developer and scope.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Request Body (JSON)</h4>
              <CodeBlock
                code={`{
  "user_id": "string (required)",
  "developer_token": "string (required)",
  "scope": "vault_read_food | vault_read_professional",
  "expiry_hours": 24
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sample Request</h4>
              <CodeBlock
                code={`POST /api/v1/request-consent
Content-Type: application/json

{
  "user_id": "user_123",
  "developer_token": "dev-partner-001",
  "scope": "vault_read_food",
  "expiry_hours": 24
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sample Response</h4>
              <CodeBlock
                code={`{
  "status": "granted",
  "message": "Consent granted. Token expires in 24 hours.",
  "consent_token": "HCT:dXNlcl8xMjN8ZGV2L...",
  "expires_at": 1734192000000
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Common Errors
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    401 Unauthorized
                  </code>
                  <span className="text-muted-foreground">
                    Invalid developer token
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    403 Forbidden
                  </code>
                  <span className="text-muted-foreground">
                    Scope not approved for this developer
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    422 Validation Error
                  </code>
                  <span className="text-muted-foreground">
                    Missing or invalid fields
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Food Data Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Food & Dining</h2>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                POST
              </span>
              <code className="text-base font-mono">/api/v1/food-data</code>
              <Lock className="h-4 w-4 text-yellow-500 ml-auto" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-muted-foreground">
                Retrieves any stored food-related information for the user,
                including dietary preferences, favorite cuisines, and monthly
                budget. Requires valid consent token with{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-xs">
                  vault_read_food
                </code>{" "}
                scope.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Request Body</h4>
              <CodeBlock
                code={`{
  "user_id": "string (required)",
  "consent_token": "string (required)"
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sample Request</h4>
              <CodeBlock
                code={`POST /api/v1/food-data
Content-Type: application/json

{
  "user_id": "user_123",
  "consent_token": "HCT:dXNlcl8xMjN8ZGV2L..."
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sample Response</h4>
              <CodeBlock
                code={`{
  "status_code": 200,
  "data": {
    "dietary_preferences": ["Vegetarian", "Gluten-Free"],
    "favorite_cuisines": ["Italian", "Mexican", "Thai"],
    "monthly_budget": 500
  }
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Common Errors
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    403 Forbidden
                  </code>
                  <span className="text-muted-foreground">
                    User has not consented to share food data
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    404 Not Found
                  </code>
                  <span className="text-muted-foreground">
                    No food data found for this user
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Professional Data Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Professional Profile</h2>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                POST
              </span>
              <code className="text-base font-mono">
                /api/v1/professional-data
              </code>
              <Lock className="h-4 w-4 text-yellow-500 ml-auto" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-muted-foreground">
                Retrieves the user's professional profile including title,
                skills, experience level, and job preferences. Requires valid
                consent token with{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-xs">
                  vault_read_professional
                </code>{" "}
                scope.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sample Response</h4>
              <CodeBlock
                code={`{
  "status_code": 200,
  "data": {
    "title": "Senior Software Engineer",
    "skills": ["Python", "React", "AWS"],
    "experience_level": "Senior (5-8 years)",
    "job_preferences": ["Full-time", "Remote"]
  }
}`}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Available Scopes */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Available Scopes</h2>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded text-xs font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                GET
              </span>
              <code className="text-base font-mono">/api/v1/list-scopes</code>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Scope</th>
                  <th className="text-left py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                      vault_read_food
                    </code>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    Read food preferences (dietary, cuisines, budget)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                      vault_read_professional
                    </code>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    Read professional profile (title, skills, experience)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                      vault_read_finance
                    </code>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    Read financial data
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                      vault_write_food
                    </code>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    Write food preferences
                  </td>
                </tr>
                <tr>
                  <td className="py-3">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                      vault_write_professional
                    </code>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    Write professional profile
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Best Practices</h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <ChevronRight className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Minimize scope</strong> — Only request the data you
                  truly need
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ChevronRight className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Short expiry</strong> — Use shorter token expiry times
                  when possible
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ChevronRight className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Handle denials</strong> — Gracefully handle when users
                  deny consent
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ChevronRight className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Secure tokens</strong> — Never expose consent tokens
                  to client-side code
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Swagger Link */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Interactive API Docs</h3>
            <p className="text-sm text-muted-foreground">
              Explore and test the API with Swagger UI
            </p>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="gradient">
              Open Swagger <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
