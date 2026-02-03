"use client";

/**
 * Developer API Documentation
 * Standalone route at /api-docs with VSCode-style syntax highlighting
 */

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, Button } from "@/lib/morphy-ux/morphy";
import {
  Code,
  Lock,
  Shield,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { Navbar } from "@/components/navbar";

// VSCode-style syntax highlighting for JSON
function SyntaxHighlightedJSON({ code }: { code: string }) {
  const highlightJSON = (json: string) => {
    // Simple regex-based syntax highlighting
    return json
      .replace(
        /"([^"]+)":/g,
        '<span class="text-purple-600 dark:text-purple-400">"$1"</span>:'
      ) // keys
      .replace(
        /: "([^"]+)"/g,
        ': <span class="text-green-600 dark:text-green-400">"$1"</span>'
      ) // string values
      .replace(
        /: (\d+)/g,
        ': <span class="text-orange-600 dark:text-orange-400">$1</span>'
      ) // numbers
      .replace(
        /\|/g,
        '<span class="text-gray-400 dark:text-gray-500">|</span>'
      ); // pipe
  };

  return (
    <code
      className="block"
      dangerouslySetInnerHTML={{ __html: highlightJSON(code) }}
    />
  );
}

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
      className="absolute top-2 right-2 p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
      )}
    </button>
  );
}

function CodeBlock({
  code,
  language = "json",
}: {
  code: string;
  language?: string;
}) {
  const isJSON = language === "json";

  return (
    <div className="relative group">
      {/* Language tag */}
      <div className="absolute top-0 left-0 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded-br-lg">
        {language}
      </div>
      <pre className="p-4 pt-8 rounded-lg bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 text-sm overflow-x-auto font-mono border border-zinc-200 dark:border-zinc-800">
        {isJSON ? <SyntaxHighlightedJSON code={code} /> : <code>{code}</code>}
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl px-4 py-4 flex items-center gap-4">
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold">Developer API</h1>
          </div>
          <div className="ml-auto">
            <a
              href={`${
                process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
              }/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <Button
                variant="none"
                size="sm"
                className="border cursor-pointer"
              >
                Swagger <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-12">
        {/* Intro */}
        <div className="space-y-2">
          <p className="text-lg text-muted-foreground">
            Access user data securely through the Hushh Consent Protocol.
          </p>
        </div>

        {/* Consent Flow */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            Consent Flow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: "Request Consent",
                desc: "POST /api/v1/request-consent",
              },
              {
                step: 2,
                title: "User Approves",
                desc: "Token issued on approval",
              },
              {
                step: 3,
                title: "Access Data",
                desc: "Use token to fetch data",
              },
            ].map((item) => (
              <Card
                key={item.step}
                variant="none"
                effect="glass"
                className="p-4"
              >
                <div className="text-2xl font-bold text-blue-500 mb-1">
                  {item.step}
                </div>
                <h4 className="font-semibold">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Request Consent Endpoint */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              POST
            </span>
            <code className="text-lg font-mono">/api/v1/request-consent</code>
            <Lock className="h-4 w-4 text-yellow-500 ml-auto" />
          </div>

          <Card variant="none" effect="glass" className="p-6 space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Request Body</h4>
              <CodeBlock
                language="json"
                code={`{
  "user_id": "string (required)",
  "developer_token": "string (required)",
  "scope": "vault_read_finance | vault.owner",
  "expiry_hours": 24
}`}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-3">Response</h4>
              <CodeBlock
                language="json"
                code={`{
  "status": "granted",
  "message": "Consent granted. Token expires in 24 hours.",
  "consent_token": "HCT:dXNlcl8xMjN8ZGV2L...",
  "expires_at": 1734192000000
}`}
              />
            </div>
          </Card>
        </section>

        {/* Available Scopes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Available Scopes</h2>
          <Card variant="none" effect="glass" className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Scope</th>
                  <th className="text-left py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { scope: "vault_read_finance", desc: "Read financial data" },
                  { scope: "vault_write_finance", desc: "Write financial data" },
                  { scope: "vault.owner", desc: "Vault owner (full access)" },
                ].map((item) => (
                  <tr key={item.scope} className="border-b last:border-0">
                    <td className="py-3">
                      <code className="px-2 py-1 rounded bg-muted text-xs font-mono">
                        {item.scope}
                      </code>
                    </td>
                    <td className="py-3 text-muted-foreground">{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {/* Errors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Error Codes
          </h2>
          <Card variant="none" effect="glass" className="p-6">
            <ul className="space-y-3 text-sm">
              {[
                { code: "401", msg: "Invalid developer token" },
                { code: "403", msg: "Consent denied or token expired" },
                { code: "404", msg: "No data found for user" },
              ].map((err) => (
                <li key={err.code} className="flex items-center gap-3">
                  <code className="px-2 py-1 rounded bg-red-500/10 text-red-600 text-xs font-mono">
                    {err.code}
                  </code>
                  <span className="text-muted-foreground">{err.msg}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Best Practices */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Best Practices</h2>
          <Card variant="none" effect="glass" className="p-6">
            <ul className="space-y-3">
              {[
                "Minimize scope — Only request the data you need",
                "Short expiry — Use shorter token expiry when possible",
                "Handle denials — Gracefully handle consent denials",
                "Secure tokens — Never expose tokens in client-side code",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-3 text-sm">
                  <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>

      <Navbar />
    </div>
  );
}
