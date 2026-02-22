export type AuthRiskAction = "login" | "register"
export type AuthRiskLevel = "low" | "medium" | "high" | "critical"
export type AuthRiskDecision = "allow" | "challenge" | "throttle" | "deny"
export type AuthCaptchaState = "none" | "slider_passed" | "slider_failed"

export interface SliderSignal {
  verified: boolean
  qualityScore: number
  attempts: number
  pointerType: "mouse" | "touch" | "pen" | "unknown"
  dragDurationMs: number
  reachedEnd: boolean
}

export interface AuthRiskClientSignals {
  elapsedMs: number
  antiBotScore: number
  inputSwitchCount: number
  hasMouseMovement: boolean
  hasNaturalMousePath: boolean
  hasNaturalInputPattern: boolean
  hasFocusActivity: boolean
  slider?: SliderSignal | null
}

export interface AuthRiskEvaluateRequest {
  action: AuthRiskAction
  captchaState: AuthCaptchaState
  clientSignals: AuthRiskClientSignals
}

export interface AuthRiskEvaluateResponse {
  success: boolean
  riskLevel: AuthRiskLevel
  decision: AuthRiskDecision
  challengeType: "none" | "slider_v2"
  cooldownSec: number
  reasonCodes: string[]
  degradedRateLimit: boolean
  requestId?: string
  error?: string
}

function defaultRiskResponse(): AuthRiskEvaluateResponse {
  return {
    success: false,
    riskLevel: "medium",
    decision: "challenge",
    challengeType: "slider_v2",
    cooldownSec: 0,
    reasonCodes: ["risk_service_error"],
    degradedRateLimit: true,
    error: "Risk evaluation service unavailable",
  }
}

export async function evaluateAuthRisk(
  payload: AuthRiskEvaluateRequest
): Promise<AuthRiskEvaluateResponse> {
  try {
    const response = await fetch("/api/auth/risk-evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => null)) as
      | Partial<AuthRiskEvaluateResponse>
      | null

    if (!response.ok || !data) {
      return {
        ...defaultRiskResponse(),
        error:
          (data && typeof data.error === "string" ? data.error : null) ||
          "Risk evaluation failed",
      }
    }

    return {
      success: true,
      riskLevel:
        data.riskLevel === "low" ||
        data.riskLevel === "medium" ||
        data.riskLevel === "high" ||
        data.riskLevel === "critical"
          ? data.riskLevel
          : "medium",
      decision:
        data.decision === "allow" ||
        data.decision === "challenge" ||
        data.decision === "throttle" ||
        data.decision === "deny"
          ? data.decision
          : "challenge",
      challengeType: data.challengeType === "none" ? "none" : "slider_v2",
      cooldownSec: typeof data.cooldownSec === "number" ? Math.max(0, data.cooldownSec) : 0,
      reasonCodes: Array.isArray(data.reasonCodes)
        ? data.reasonCodes.filter((item): item is string => typeof item === "string").slice(0, 12)
        : [],
      degradedRateLimit: data.degradedRateLimit === true,
      requestId: typeof data.requestId === "string" ? data.requestId : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
    }
  } catch {
    return defaultRiskResponse()
  }
}
