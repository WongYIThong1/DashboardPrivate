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

export async function checkRateLimit(
  action: "login" | "register"
): Promise<{ allowed: boolean; remainingTime?: number }> {
  try {
    const supabase = createClient()
    const config = RATE_LIMITS[action]
    const identifier = getClientIdentifier()

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_identifier: identifier,
      p_action: action,
      p_max_attempts: config.maxAttempts,
      p_window_minutes: config.windowMinutes,
    })

    if (error || !data) {
      console.error("Rate limit check error:", error)
      return { allowed: false, remainingTime: 1 }
    }

    return {
      allowed: Boolean(data.allowed),
      remainingTime:
        typeof data.remaining_minutes === "number" ? data.remaining_minutes : 1,
    }
  } catch (error) {
    console.error("Rate limit check error:", error)
    return { allowed: false, remainingTime: 1 }
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

