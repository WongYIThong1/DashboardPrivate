import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const BASE_PROFILE_COLUMNS =
  "username, email, plan, credits, system_notification, privacy_mode, avatar_url, avatar_hash, subscription_days, subscription_expires_at"
const EXTENDED_PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS}, max_tasks, globaltasks`

function normalizePlan(plan: unknown): "Free" | "Starter" | "Pro" | "Pro+" {
  const value = typeof plan === "string" ? plan.trim().toLowerCase() : ""
  if (value === "starter") return "Starter"
  if (value === "pro+" || value === "pro plus" || value === "pro_plus") return "Pro+"
  if (value === "pro") return "Pro"
  return "Free"
}

async function getProfileWithCompat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  let profileQuery = await supabase
    .from("user_profiles")
    .select(EXTENDED_PROFILE_COLUMNS)
    .eq("id", userId)
    .single()

  if (
    profileQuery.error &&
    /column .* does not exist/i.test(profileQuery.error.message || "")
  ) {
    profileQuery = await supabase
      .from("user_profiles")
      .select(BASE_PROFILE_COLUMNS)
      .eq("id", userId)
      .single()
  }

  return profileQuery
}

export async function GET() {
  const requestId = createRequestId()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    const { data: profile, error: profileError } = await getProfileWithCompat(supabase, user.id)

    if (profileError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch profile", requestId)
    }

    if (!profile) {
      return errorResponse(404, "NOT_FOUND", "Profile not found", requestId)
    }

    let daysRemaining: number | null = null
    let isExpired = false
    if (profile.subscription_expires_at) {
      const expiresAt = new Date(profile.subscription_expires_at)
      const now = new Date()
      const diffTime = expiresAt.getTime() - now.getTime()
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      isExpired = daysRemaining <= 0
    }

    return NextResponse.json({
      success: true,
      username: profile.username || "User",
      email: profile.email || user.email || "user@example.com",
      plan: normalizePlan(profile.plan),
      credits: profile.credits || 0,
      notification: profile.system_notification,
      privacy: profile.privacy_mode,
      avatarUrl: profile.avatar_url,
      avatarHash: profile.avatar_hash,
      max_tasks: Number((profile as { max_tasks?: unknown }).max_tasks ?? 0),
      global_tasks: Number((profile as { globaltasks?: unknown }).globaltasks ?? 0),
      subscription_days: profile.subscription_days || 0,
      subscription_expires_at: profile.subscription_expires_at,
      days_remaining: daysRemaining,
      is_expired: isExpired,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/settings", error)
  }
}

export async function PUT(request: Request) {
  const requestId = createRequestId()

  try {
    const csrfError = sameOriginWriteGuard(request, requestId)
    if (csrfError) return csrfError

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    const body = await request.json().catch(() => null)
    const notification = body?.notification
    const privacy = body?.privacy
    if (typeof notification !== "boolean" || typeof privacy !== "boolean") {
      return errorResponse(400, "VALIDATION_ERROR", "notification and privacy must be boolean", requestId)
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        system_notification: notification,
        privacy_mode: privacy,
      })
      .eq("id", user.id)

    if (updateError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to update settings", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/settings", error)
  }
}
