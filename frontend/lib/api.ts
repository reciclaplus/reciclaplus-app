import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

/** A non-2xx response from the backend, with its status and `detail` message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string | null,
  ) {
    super(`API error ${status}: ${detail ?? ""}`);
  }
}

/**
 * Fetch wrapper for calling the FastAPI backend from Client Components.
 *
 * Attaches the current Supabase access token as a Bearer header. All
 * application data flows through this — never through Next.js API routes.
 * Throws ApiError on a non-2xx response.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail: string | null = null;
    try {
      const body = await response.json();
      detail = typeof body?.detail === "string" ? body.detail : null;
    } catch {
      // Not JSON: keep the status only.
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/**
 * A message to show for a failed request. The backend's own message is used for
 * the errors it explains to users (bad request, conflict, invalid value), which
 * are written in Spanish; otherwise `fallback`.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if ([400, 409, 422].includes(error.status) && error.detail) return error.detail;
    if (error.status === 403) return strings.common.forbiddenAction;
  }
  return fallback;
}
