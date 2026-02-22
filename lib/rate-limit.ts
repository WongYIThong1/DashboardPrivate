import { createClient } from "@/lib/supabase/client"

const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMinutes: 15,
  },
  register: {
    maxAttempts: 3,
    windowMinutes: 60,
  },
} as const

type RateLimitResult = { allowed: boolean; remainingTime?: number; degraded?: boolean }

const localFallbackAttempts = new Map<string, number[]>()

function getClientIdentifier(): string {
  if (typeof window === "undefined") return "server"

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join("|")

  let hash = 0
  for (let i = 0; i < fingerprint.length; i += 1) {
    const char = fingerprint.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }

  return `client_${Math.abs(hash).toString(36)}`
}

function evaluateLocalFallback(
  identifier: string,
  action: "login" | "register"
): { allowed: boolean; remainingMinutes: number } {
  const config = RATE_LIMITS[action]
  const key = `${action}:${identifier}`
  const now = Date.now()
  const windowMs = config.windowMinutes * 60 * 1000
  const windowStart = now - windowMs
  const existing = localFallbackAttempts.get(key) || []
  const recent = existing.filter((ts) => ts > windowStart)
  recent.push(now)
  localFallbackAttempts.set(key, recent)

  if (recent.length > config.maxAttempts) {
    const oldest = recent[0]
    const remaining = Math.max(1, Math.ceil((oldest + windowMs - now) / 60000))
    return { allowed: false, remainingMinutes: remaining }
  }

  return { allowed: true, remainingMinutes: 0 }
}

export async function checkRateLimit(
  action: "login" | "register"
): Promise<RateLimitResult> {
  try {
    const supabase = createClient()
    const config = RATE_LIMITS[action]
    const identifier = getClientIdentifier()

    const { data: v2Data, error: v2Error } = await supabase.rpc("check_rate_limit_v2", {
      p_identifier: identifier,
      p_action: action,
      p_max_attempts: config.maxAttempts,
      p_window_minutes: config.windowMinutes,
    })

    if (!v2Error && v2Data) {
      return {
        allowed: Boolean(v2Data.allowed),
        remainingTime:
          typeof v2Data.remaining_minutes === "number" ? v2Data.remaining_minutes : 1,
        degraded: v2Data.degraded_mode === true,
      }
    }

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_identifier: identifier,
      p_action: action,
      p_max_attempts: config.maxAttempts,
      p_window_minutes: config.windowMinutes,
    })

    if (error || !data) {
      console.error("Rate limit check error:", v2Error || error)
      const local = evaluateLocalFallback(identifier, action)
      return {
        allowed: local.allowed,
        remainingTime: local.remainingMinutes || 1,
        degraded: true,
      }
    }

    return {
      allowed: Boolean(data.allowed),
      remainingTime:
        typeof data.remaining_minutes === "number" ? data.remaining_minutes : 1,
      degraded: true,
    }
  } catch (error) {
    console.error("Rate limit check error:", error)
    const identifier = getClientIdentifier()
    const local = evaluateLocalFallback(identifier, action)
    return {
      allowed: local.allowed,
      remainingTime: local.remainingMinutes || 1,
      degraded: true,
    }
  }
}

export async function recordAttempt(
  _action: "login" | "register"
): Promise<void> {
  void _action
  return Promise.resolve()
}

export async function resetRateLimit(
  _action: "login" | "register"
): Promise<void> {
  void _action
  return Promise.resolve()
}
