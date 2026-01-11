/**
 * ApiClient — single fetch wrapper for all service-layer HTTP calls.
 *
 * Rules:
 * - Pages/components should call services, not `fetch()` directly.
 * - Services should use this wrapper so error handling/logging is consistent.
 * - Uses ApiService.apiFetch() so routing stays platform-aware (Web vs Native).
 */

import { ApiService } from "@/lib/services/api-service";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await ApiService.apiFetch(path, options);

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const msg =
      (payload as any)?.error ||
      (payload as any)?.detail ||
      `Request failed: ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload as T;
}
