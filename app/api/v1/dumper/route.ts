import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isUuid,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const ALLOWED_RISK_FILTERS = new Set(["medium-high", "all", "high"])
const ALLOWED_AI_SENSITIVITY = new Set(["low", "medium", "high"])

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
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

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        name,
        status,
        found,
        target,
        started_at,
        user_files!tasks_file_id_fkey (
          filename
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (tasksError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch tasks", requestId)
    }

    const transformedTasks = (tasks || []).map((task) => {
      const joinedFile = Array.isArray(task.user_files) ? task.user_files[0] : task.user_files
      return {
      id: task.id,
      name: task.name,
      status: task.status,
      found: task.found,
      target: task.target || null,
      file: joinedFile?.filename || "Unknown",
      started_time: task.started_at || null,
      }
    })

    return NextResponse.json({
      success: true,
      tasks: transformedTasks,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/dumper", error)
  }
}

export async function POST(request: Request) {
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

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("plan, max_tasks")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch user profile", requestId)
    }

    const planValue = String(profile.plan ?? "").trim().toLowerCase()
    const isFreePlan = planValue === "free"
    const isStarterPlan = planValue === "starter"

    if (isFreePlan) {
      return errorResponse(
        403,
        "FREE_PLAN_LIMIT",
        "Free plan users cannot create tasks. Please upgrade to Starter, Pro, or Pro+.",
        requestId
      )
    }

    const { count: taskCount, error: countError } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to check task limit", requestId)
    }

    const maxTasks = profile.max_tasks || 0
    if (taskCount !== null && taskCount >= maxTasks) {
      return errorResponse(
        403,
        "TASK_LIMIT_REACHED",
        `Task limit reached. You have ${taskCount} of ${maxTasks} tasks.`,
        requestId
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON body", requestId)
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const fileId = typeof body.file_id === "string" ? body.file_id : ""
    if (!name || name.length > 120) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid task name", requestId)
    }
    if (!isUuid(fileId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file_id", requestId)
    }

    const parameterRiskFilter =
      typeof body.parameter_risk_filter === "string" && ALLOWED_RISK_FILTERS.has(body.parameter_risk_filter)
        ? body.parameter_risk_filter
        : "medium-high"
    const requestedAiSensitivity =
      typeof body.ai_sensitivity_level === "string" && ALLOWED_AI_SENSITIVITY.has(body.ai_sensitivity_level)
        ? body.ai_sensitivity_level
        : "medium"
    const aiSensitivity = isStarterPlan ? "low" : requestedAiSensitivity
    const preset =
      body.preset === null || body.preset === undefined
        ? null
        : typeof body.preset === "string" && body.preset.length <= 100
          ? body.preset
          : null

    const { data: file, error: fileError } = await supabase
      .from("user_files")
      .select("id")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .single()

    if (fileError || !file) {
      return errorResponse(404, "NOT_FOUND", "File not found or access denied", requestId)
    }

    const { data: task, error: createError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        file_id: fileId,
        name,
        status: "pending",
        found: 0,
        target: null,
        auto_dumper: parseBoolean(body.auto_dumper, false),
        preset,
        ai_mode: parseBoolean(body.ai_mode, true),
        parameter_risk_filter: parameterRiskFilter,
        ai_sensitivity_level: aiSensitivity,
        response_pattern_drift: isStarterPlan ? false : parseBoolean(body.response_pattern_drift, true),
        baseline_profiling: parseBoolean(body.baseline_profiling, true),
        structural_change_detection: parseBoolean(body.structural_change_detection, false),
        injection_union: parseBoolean(body.injection_union, true),
        injection_error: parseBoolean(body.injection_error, true),
        injection_boolean: parseBoolean(body.injection_boolean, false),
        injection_timebased: parseBoolean(body.injection_timebased, false),
      })
      .select()
      .single()

    if (createError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to create task", requestId)
    }

    return NextResponse.json({
      success: true,
      task,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/dumper", error)
  }
}
