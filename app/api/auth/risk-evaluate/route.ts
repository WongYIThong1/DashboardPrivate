import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  sameOriginWriteGuard,
} from "@/lib/api/security"
import type {
  AuthCaptchaState,
  AuthRiskAction,
  AuthRiskClientSignals,
  AuthRiskDecision,
  AuthRiskEvaluateRequest,
  AuthRiskLevel,
} from "@/lib/auth-risk"

type RateLimitResult = {
  allowed: boolean
  remainingMinutes: number | null
  degraded: boolean
}

const RATE_LIMIT_CONFIG: Record<AuthRiskAction, { maxAttempts: number; windowMinutes: number }> = {
  login: { maxAttempts: 40, windowMinutes: 5 },
  register: { maxAttempts: 15, windowMinutes: 15 },
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp.trim()
  const forwarded = request.headers.get("x-forwarded-for")
  if (!forwarded) return "unknown"
  const first = forwarded.split(",")[0]
  return (first || "unknown").trim()
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function normalizeCaptchaState(value: unknown): AuthCaptchaState {
  if (value === "slider_passed" || value === "slider_failed") return value
  return "none"
}

function normalizeAction(value: unknown): AuthRiskAction | null {
  if (value === "login" || value === "register") return value
  return null
}

function normalizeSignals(raw: unknown): AuthRiskClientSignals {
  const input = (raw || {}) as Partial<AuthRiskClientSignals>
  const sliderInput = input.slider
  const slider =
    sliderInput && typeof sliderInput === "object"
      ? (() => {
          const pointerType: "mouse" | "touch" | "pen" | "unknown" =
            sliderInput.pointerType === "mouse" ||
            sliderInput.pointerType === "touch" ||
            sliderInput.pointerType === "pen"
              ? sliderInput.pointerType
              : "unknown"
          return {
          verified: sliderInput.verified === true,
          qualityScore: clampNumber(sliderInput.qualityScore, 0, 100, 0),
          attempts: clampNumber(sliderInput.attempts, 0, 10, 0),
          pointerType,
          dragDurationMs: clampNumber(sliderInput.dragDurationMs, 0, 30_000, 0),
          reachedEnd: sliderInput.reachedEnd === true,
          }
        })()
      : null

  return {
    elapsedMs: clampNumber(input.elapsedMs, 0, 300_000, 0),
    antiBotScore: clampNumber(input.antiBotScore, 0, 100, 0),
    inputSwitchCount: clampNumber(input.inputSwitchCount, 0, 100, 0),
    hasMouseMovement: input.hasMouseMovement === true,
    hasNaturalMousePath: input.hasNaturalMousePath === true,
    hasNaturalInputPattern: input.hasNaturalInputPattern === true,
    hasFocusActivity: input.hasFocusActivity === true,
    slider,
  }
}

async function checkRateLimitWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  identifier: string,
  action: AuthRiskAction
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[action]

  const { data: v2Data, error: v2Error } = await supabase.rpc("check_rate_limit_v2", {
    p_identifier: identifier,
    p_action: action,
    p_max_attempts: config.maxAttempts,
    p_window_minutes: config.windowMinutes,
  })

  if (!v2Error && v2Data) {
    return {
      allowed: Boolean(v2Data.allowed),
      remainingMinutes:
        typeof v2Data.remaining_minutes === "number" ? Math.max(0, v2Data.remaining_minutes) : null,
      degraded: v2Data.degraded_mode === true,
    }
  }

  const { data: v1Data, error: v1Error } = await supabase.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_action: action,
    p_max_attempts: config.maxAttempts,
    p_window_minutes: config.windowMinutes,
  })

  if (!v1Error && v1Data) {
    return {
      allowed: Boolean(v1Data.allowed),
      remainingMinutes:
        typeof v1Data.remaining_minutes === "number" ? Math.max(0, v1Data.remaining_minutes) : null,
      degraded: true,
    }
  }

  return {
    allowed: true,
    remainingMinutes: null,
    degraded: true,
  }
}

function evaluateRisk(
  action: AuthRiskAction,
  captchaState: AuthCaptchaState,
  signals: AuthRiskClientSignals,
  rateLimit: RateLimitResult
): {
  riskScore: number
  riskLevel: AuthRiskLevel
  decision: AuthRiskDecision
  cooldownSec: number
  reasonCodes: string[]
} {
  let riskScore = action === "register" ? 8 : 0
  const reasonCodes: string[] = []

  if (signals.elapsedMs < 1200) {
    riskScore += 25
    reasonCodes.push("too_fast")
  } else if (signals.elapsedMs < 2200) {
    riskScore += 10
    reasonCodes.push("fast_submit")
  }

  if (signals.antiBotScore < 30) {
    riskScore += 30
    reasonCodes.push("low_behavior_score")
  } else if (signals.antiBotScore < 50) {
    riskScore += 18
    reasonCodes.push("weak_behavior_score")
  } else if (signals.antiBotScore > 85) {
    riskScore -= 8
  }

  if (signals.inputSwitchCount <= 1) {
    riskScore += 12
    reasonCodes.push("low_input_switch")
  }
  if (!signals.hasMouseMovement) {
    riskScore += 10
    reasonCodes.push("no_mouse_activity")
  }
  if (!signals.hasNaturalMousePath) {
    riskScore += 8
    reasonCodes.push("unnatural_mouse_path")
  }
  if (!signals.hasNaturalInputPattern) {
    riskScore += 10
    reasonCodes.push("unnatural_input")
  }
  if (!signals.hasFocusActivity) {
    riskScore += 6
    reasonCodes.push("no_focus_activity")
  }

  if (signals.slider) {
    if (signals.slider.dragDurationMs > 0 && signals.slider.dragDurationMs < 120) {
      riskScore += 16
      reasonCodes.push("drag_too_fast")
    }
    if (signals.slider.qualityScore < 30) {
      riskScore += 20
      reasonCodes.push("low_slider_quality")
    } else if (signals.slider.qualityScore < 45) {
      riskScore += 10
      reasonCodes.push("medium_slider_quality")
    }
    if (!signals.slider.reachedEnd && signals.slider.attempts > 0) {
      riskScore += 6
      reasonCodes.push("incomplete_drag")
    }
  }

  if (captchaState === "slider_failed") {
    riskScore += 25
    reasonCodes.push("challenge_failed")
  } else if (captchaState === "slider_passed") {
    riskScore -= 20
    reasonCodes.push("challenge_passed")
  }

  if (rateLimit.degraded) {
    riskScore += 5
    reasonCodes.push("rate_limit_degraded")
  }

  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)))

  const riskLevel: AuthRiskLevel =
    riskScore <= 24 ? "low" : riskScore <= 49 ? "medium" : riskScore <= 74 ? "high" : "critical"

  if (!rateLimit.allowed) {
    const cooldownSec = 15
    reasonCodes.push("rate_limited")
    return {
      riskScore,
      riskLevel,
      decision: "challenge",
      cooldownSec,
      reasonCodes,
    }
  }

  if (riskLevel === "low") {
    return { riskScore, riskLevel, decision: "allow", cooldownSec: 0, reasonCodes }
  }

  const sliderAttempts = signals.slider?.attempts || 0
  const sliderQuality = signals.slider?.qualityScore || 0
  const challengePassed = captchaState === "slider_passed" && signals.slider?.verified === true

  if (riskLevel === "medium") {
    return {
      riskScore,
      riskLevel,
      decision: challengePassed ? "allow" : "challenge",
      cooldownSec: 0,
      reasonCodes,
    }
  }

  if (riskLevel === "high") {
    if (challengePassed && signals.antiBotScore >= 30) {
      return { riskScore, riskLevel, decision: "allow", cooldownSec: 0, reasonCodes }
    }
    if (captchaState === "slider_failed" && sliderAttempts >= 2) {
      return { riskScore, riskLevel, decision: "throttle", cooldownSec: 45, reasonCodes }
    }
    return { riskScore, riskLevel, decision: "challenge", cooldownSec: 15, reasonCodes }
  }

  if (challengePassed && signals.antiBotScore >= 65 && sliderQuality >= 60) {
    return { riskScore, riskLevel, decision: "allow", cooldownSec: 0, reasonCodes }
  }
  if (captchaState === "slider_failed" && sliderAttempts >= 2) {
    return { riskScore, riskLevel, decision: "deny", cooldownSec: 120, reasonCodes }
  }
  return { riskScore, riskLevel, decision: "challenge", cooldownSec: 30, reasonCodes }
}

async function recordRiskEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    action: AuthRiskAction
    decision: AuthRiskDecision
    riskLevel: AuthRiskLevel
    cooldownSec: number
    fingerprintHash: string
    ipHash: string
    signals: AuthRiskClientSignals
    reasonCodes: string[]
  }
) {
  const { error } = await supabase.rpc("record_risk_event", {
    p_action: payload.action,
    p_decision: payload.decision,
    p_risk_level: payload.riskLevel,
    p_cooldown_sec: payload.cooldownSec,
    p_client_fingerprint_hash: payload.fingerprintHash,
    p_ip_hash: payload.ipHash,
    p_signals: payload.signals,
    p_reason_codes: payload.reasonCodes,
  })

  if (error) {
    console.warn("[api/auth/risk-evaluate] record_risk_event failed", { error: error.message })
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId()

  try {
    const csrfError = sameOriginWriteGuard(request, requestId)
    if (csrfError) return csrfError

    const body = (await request.json().catch(() => null)) as AuthRiskEvaluateRequest | null
    const action = normalizeAction(body?.action)
    if (!action) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid action", requestId)
    }

    const captchaState = normalizeCaptchaState(body?.captchaState)
    const clientSignals = normalizeSignals(body?.clientSignals)

    const ip = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const identifier = `auth:${action}:${sha256(`${ip}|${userAgent}`).slice(0, 32)}`

    const supabase = await createClient()
    const rateLimit = await checkRateLimitWithFallback(supabase, identifier, action)
    const evaluated = evaluateRisk(action, captchaState, clientSignals, rateLimit)

    const ipHash = sha256(ip)
    const fingerprintHash = sha256(
      [
        userAgent,
        String(clientSignals.elapsedMs),
        String(clientSignals.antiBotScore),
        String(clientSignals.inputSwitchCount),
        captchaState,
      ].join("|")
    )

    await recordRiskEvent(supabase, {
      action,
      decision: evaluated.decision,
      riskLevel: evaluated.riskLevel,
      cooldownSec: evaluated.cooldownSec,
      fingerprintHash,
      ipHash,
      signals: clientSignals,
      reasonCodes: evaluated.reasonCodes,
    })

    return NextResponse.json({
      success: true,
      riskLevel: evaluated.riskLevel,
      decision: evaluated.decision,
      challengeType: evaluated.decision === "allow" ? "none" : "slider_v2",
      cooldownSec: evaluated.cooldownSec,
      reasonCodes: evaluated.reasonCodes,
      degradedRateLimit: rateLimit.degraded,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/auth/risk-evaluate", error)
  }
}
