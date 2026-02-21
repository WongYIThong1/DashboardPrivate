import { NextResponse } from "next/server"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Allow common user-facing file names (including unicode letters/numbers and parentheses)
// while still blocking path separators and traversal via dedicated checks below.
const SAFE_FILE_NAME_REGEX = /^[\p{L}\p{N}._() -]+$/u
const PRIVATE_CIDR_REGEXES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^::1$/i,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
]

export function createRequestId(): string {
  return crypto.randomUUID()
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function sanitizeDownloadFilename(
  value: string | null | undefined,
  fallback = "download.bin"
): string {
  const raw = (value ?? "").trim()
  if (!raw) return fallback
  const cleaned = raw
    .replace(/[\\/\r\n"]/g, "_")
    .replace(/[^\w.\-() ]/g, "_")
    .slice(0, 120)
  return cleaned || fallback
}

export function isSafeTxtFilename(name: unknown): name is string {
  if (typeof name !== "string") return false
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 120) return false
  if (!trimmed.toLowerCase().endsWith(".txt")) return false
  if (!SAFE_FILE_NAME_REGEX.test(trimmed)) return false
  if (trimmed.includes("..")) return false
  return true
}

export function sameOriginWriteGuard(
  request: Request,
  requestId: string
): NextResponse | null {
  const method = request.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  const requestUrl = new URL(request.url)
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const secFetchSite = request.headers.get("sec-fetch-site")

  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "same-site" &&
    secFetchSite !== "none"
  ) {
    return errorResponse(403, "CSRF_BLOCKED", "Cross-site request blocked", requestId)
  }

  if (origin && origin !== requestUrl.origin) {
    return errorResponse(403, "CSRF_BLOCKED", "Invalid request origin", requestId)
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (refererOrigin !== requestUrl.origin) {
        return errorResponse(403, "CSRF_BLOCKED", "Invalid request referer", requestId)
      }
    } catch {
      return errorResponse(403, "CSRF_BLOCKED", "Malformed referer", requestId)
    }
  }

  return null
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      code,
      error: message,
      message,
      requestId,
      ...extra,
    },
    { status }
  )
}

export function internalErrorResponse(
  requestId: string,
  scope: string,
  error: unknown
) {
  console.error(`[${scope}]`, { requestId, error })
  return errorResponse(500, "INTERNAL_ERROR", "Internal server error", requestId)
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 10000
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_CIDR_REGEXES.some((regex) => regex.test(ip))
}

export function getAllowedHosts(...values: Array<string | undefined>): Set<string> {
  const hosts = new Set<string>()
  for (const value of values) {
    if (!value) continue
    for (const item of value.split(",")) {
      const trimmed = item.trim().toLowerCase()
      if (trimmed) hosts.add(trimmed)
    }
  }
  return hosts
}

export async function validateOutgoingUrl(
  rawUrl: string,
  allowedHosts: Set<string>,
  allowHttp = false
): Promise<URL | null> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }

  const protocolAllowed =
    parsed.protocol === "https:" || (allowHttp && parsed.protocol === "http:")
  if (!protocolAllowed) return null

  const host = parsed.hostname.toLowerCase()
  if (!host) return null

  if (isIP(host)) {
    if (isPrivateIp(host) && !allowedHosts.has(host)) return null
    if (!allowedHosts.has(host)) return null
    return parsed
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    if (!allowedHosts.has(host)) return null
    return parsed
  }

  let resolvedIp = ""
  try {
    const resolved = await lookup(host)
    resolvedIp = resolved.address
  } catch {
    return null
  }

  if (resolvedIp && isPrivateIp(resolvedIp) && !allowedHosts.has(host)) return null
  if (!allowedHosts.has(host)) return null

  return parsed
}
