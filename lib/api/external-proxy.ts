import { createClient } from "@/lib/supabase/server"
import { createRequestId, errorResponse, fetchWithTimeout } from "@/lib/api/security"

function getExternalApiBaseUrl(): URL {
  const raw =
    process.env.EXTERNAL_API_DOMAIN ??
    process.env.NEXT_PUBLIC_EXTERNAL_API_DOMAIN ??
    "http://localhost:8080"
  return new URL(raw)
}

export async function requireExternalApiAuth(requestId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      response: errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId),
    }
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    return {
      ok: false as const,
      response: errorResponse(401, "UNAUTHORIZED", "No active session", requestId),
    }
  }

  return {
    ok: true as const,
    accessToken: session.access_token,
  }
}

export async function proxyJsonToExternalApi(args: {
  requestId?: string
  method?: "GET" | "POST"
  path: string
  query?: Record<string, string | undefined>
  body?: unknown
  timeoutMs?: number
}) {
  const requestId = args.requestId ?? createRequestId()
  const auth = await requireExternalApiAuth(requestId)
  if (!auth.ok) return auth.response

  const base = getExternalApiBaseUrl()
  const url = new URL(args.path, base)
  for (const [key, value] of Object.entries(args.query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value)
    }
  }

  const method = args.method ?? "GET"
  const upstream = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "GET" && args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
      cache: "no-store",
    },
    args.timeoutMs ?? 15000
  )

  return upstream
}

export async function proxySseToExternalApi(args: {
  requestId?: string
  path: string
  query?: Record<string, string | undefined>
  timeoutMs?: number
}) {
  const requestId = args.requestId ?? createRequestId()
  const auth = await requireExternalApiAuth(requestId)
  if (!auth.ok) return auth.response

  const base = getExternalApiBaseUrl()
  const url = new URL(args.path, base)
  for (const [key, value] of Object.entries(args.query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value)
    }
  }

  const upstream = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "text/event-stream",
      },
      cache: "no-store",
    },
    args.timeoutMs ?? 60000
  )

  if (!upstream.ok || !upstream.body) {
    return errorResponse(502, "UPSTREAM_ERROR", "Failed to connect stream", requestId)
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  })
}

