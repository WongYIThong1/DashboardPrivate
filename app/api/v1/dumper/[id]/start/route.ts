import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  fetchWithTimeout,
  getAllowedHosts,
  internalErrorResponse,
  isUuid,
  sameOriginWriteGuard,
  validateOutgoingUrl,
} from "@/lib/api/security"

type RiskFilter = "High" | "High-Med" | "All"
type AiSensitivity = "Low" | "Medium" | "High"

function mapRiskFilter(value: string): RiskFilter {
  if (value === "all") return "All"
  if (value === "medium-high") return "High-Med"
  return "High"
}

function mapAiSensitivity(value: string): AiSensitivity {
  if (value === "low") return "Low"
  if (value === "high") return "High"
  return "Medium"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId()
  const startedAt = Date.now()

  try {
    const csrfError = sameOriginWriteGuard(request, requestId)
    if (csrfError) {
      console.warn("[api/v1/dumper/[id]/start] blocked by sameOriginWriteGuard", { requestId })
      return csrfError
    }

    const { id: taskId } = await params
    console.log("[api/v1/dumper/[id]/start] request", {
      requestId,
      taskId,
      referer: request.headers.get("referer") || "-",
      secFetchSite: request.headers.get("sec-fetch-site") || "-",
    })
    if (!isUuid(taskId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid task id format", requestId)
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn("[api/v1/dumper/[id]/start] unauthorized user", { requestId, taskId })
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      console.warn("[api/v1/dumper/[id]/start] no active session", { requestId, taskId, userId: user.id })
      return errorResponse(401, "UNAUTHORIZED", "No active session", requestId)
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("plan, credits")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.warn("[api/v1/dumper/[id]/start] profile not found", { requestId, taskId, userId: user.id })
      return errorResponse(404, "NOT_FOUND", "User profile not found", requestId)
    }

    const planValue = String(profile.plan ?? "").trim().toLowerCase()
    const isFreePlan = planValue === "free"
    const isStarterPlan = planValue === "starter"

    if (isFreePlan) {
      console.warn("[api/v1/dumper/[id]/start] rejected by plan", {
        requestId,
        taskId,
        userId: user.id,
        plan: profile.plan,
      })
      return errorResponse(
        403,
        "FREE_PLAN_LIMIT",
        "Free plan users cannot start tasks. Please upgrade to Starter, Pro, or Pro+.",
        requestId
      )
    }

    if (profile.credits < 1) {
      console.warn("[api/v1/dumper/[id]/start] rejected by credits", {
        requestId,
        taskId,
        userId: user.id,
        credits: profile.credits,
      })
      return errorResponse(
        403,
        "INSUFFICIENT_CREDITS",
        "Insufficient credits. Please purchase more credits.",
        requestId
      )
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        name,
        status,
        file_id,
        auto_dumper,
        preset,
        parameter_risk_filter,
        ai_sensitivity_level
      `
      )
      .eq("id", taskId)
      .eq("user_id", user.id)
      .single()

    if (taskError || !task) {
      console.warn("[api/v1/dumper/[id]/start] task not found or denied", { requestId, taskId, userId: user.id })
      return errorResponse(404, "NOT_FOUND", "Task not found or access denied", requestId)
    }

    if (task.status === "running" || task.status === "running_recon") {
      console.warn("[api/v1/dumper/[id]/start] task already running", {
        requestId,
        taskId,
        status: task.status,
      })
      return errorResponse(409, "CONFLICT", "Task is already running", requestId)
    }

    const { data: file, error: fileError } = await supabase
      .from("user_files")
      .select("file_path")
      .eq("id", task.file_id)
      .eq("user_id", user.id)
      .single()

    if (fileError || !file) {
      console.warn("[api/v1/dumper/[id]/start] file not found", { requestId, taskId, fileId: task.file_id })
      return errorResponse(404, "NOT_FOUND", "File not found", requestId)
    }

    const { data: urlData } = await supabase.storage
      .from("user-files")
      .createSignedUrl(file.file_path, 3600 * 24 * 7)

    if (!urlData?.signedUrl) {
      console.error("[api/v1/dumper/[id]/start] failed to generate signed URL", { requestId, taskId })
      return errorResponse(500, "INTERNAL_ERROR", "Failed to generate download URL", requestId)
    }

    const rawExternalApiDomain = process.env.EXTERNAL_API_DOMAIN ?? "http://localhost:8080"
    const externalBaseUrl = new URL(rawExternalApiDomain)
    const allowedHosts = getAllowedHosts(
      process.env.EXTERNAL_API_ALLOWED_HOSTS,
      externalBaseUrl.hostname
    )
    const safeExternalBaseUrl = await validateOutgoingUrl(
      externalBaseUrl.toString(),
      allowedHosts,
      externalBaseUrl.protocol === "http:"
    )

    if (!safeExternalBaseUrl) {
      console.error("[api/v1/dumper/[id]/start] external host not allowed", { requestId, taskId })
      return errorResponse(500, "SERVER_MISCONFIGURED", "External API host is not allowed", requestId)
    }

    const externalApiData = {
      taskname: task.name,
      download_url: urlData.signedUrl,
      autodumper: task.auto_dumper || false,
      preset: task.preset || "",
      RiskFiltere: mapRiskFilter(task.parameter_risk_filter),
      AISensitivity: isStarterPlan ? "Low" : mapAiSensitivity(task.ai_sensitivity_level),
      EvasionEngine: false,
      accesstoken: `Bearer ${session.access_token}`,
    }

    const externalStartUrl = new URL(`/start/${taskId}`, safeExternalBaseUrl)
    const externalResponse = await fetchWithTimeout(
      externalStartUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(externalApiData),
      },
      15000
    )

    const externalData = await externalResponse.json().catch(() => null)
    if (!externalResponse.ok) {
      console.error("[api/v1/dumper/[id]/start] upstream start failed", {
        requestId,
        taskId,
        upstreamStatus: externalResponse.status,
      })
      return errorResponse(502, "UPSTREAM_ERROR", "Failed to start task on external server", requestId, {
        upstreamStatus: externalResponse.status,
      })
    }

    return NextResponse.json({
      success: true,
      message: "success",
      taskid: taskId,
      requestId,
      upstream: externalData?.success === true ? "ok" : "unknown",
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/dumper/[id]/start", error)
  } finally {
    console.log("[api/v1/dumper/[id]/start] completed", {
      requestId,
      durationMs: Date.now() - startedAt,
    })
  }
}
