import { NextResponse } from "next/server"
import {
  createRequestId,
  errorResponse,
  fetchWithTimeout,
  internalErrorResponse,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const ALLOWED_ACTIONS = new Set(["login", "register"])

type TurnstileVerifyResponse = {
  success?: boolean
  action?: string
  "error-codes"?: string[]
}

function getClientIp(request: Request): string | undefined {
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp

  const forwarded = request.headers.get("x-forwarded-for")
  if (!forwarded) return undefined
  const first = forwarded.split(",")[0]?.trim()
  return first || undefined
}

export async function POST(request: Request) {
  const requestId = createRequestId()

  try {
    const csrfError = sameOriginWriteGuard(request, requestId)
    if (csrfError) return csrfError

    const body = (await request.json().catch(() => null)) as
      | { token?: unknown; action?: unknown }
      | null
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    const expectedAction = typeof body?.action === "string" ? body.action.trim() : ""

    if (!token) {
      return errorResponse(400, "VALIDATION_ERROR", "Missing verification token", requestId)
    }

    if (expectedAction && !ALLOWED_ACTIONS.has(expectedAction)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid verification action", requestId)
    }

    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
      return errorResponse(500, "CONFIG_ERROR", "Turnstile is not configured", requestId)
    }

    const payload = new URLSearchParams()
    payload.set("secret", secret)
    payload.set("response", token)
    const remoteIp = getClientIp(request)
    if (remoteIp) payload.set("remoteip", remoteIp)

    const verifyResponse = await fetchWithTimeout(
      TURNSTILE_VERIFY_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
      },
      10_000
    )

    if (!verifyResponse.ok) {
      return errorResponse(502, "TURNSTILE_UPSTREAM_ERROR", "Verification service unavailable", requestId)
    }

    const verifyData = (await verifyResponse.json().catch(() => null)) as TurnstileVerifyResponse | null
    if (!verifyData?.success) {
      return errorResponse(400, "TURNSTILE_FAILED", "Please complete verification", requestId, {
        errorCodes: Array.isArray(verifyData?.["error-codes"]) ? verifyData?.["error-codes"] : [],
      })
    }

    if (expectedAction && verifyData.action && verifyData.action !== expectedAction) {
      return errorResponse(400, "TURNSTILE_ACTION_MISMATCH", "Invalid verification context", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/turnstile/verify", error)
  }
}
