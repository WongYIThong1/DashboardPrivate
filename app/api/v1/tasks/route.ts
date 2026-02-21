import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isUuid,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const GOOGLE_MODES = new Set(["google_lite", "google_fast", "google_deep"])

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
        google_mode,
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
        google_mode: typeof task.google_mode === "string" ? task.google_mode : "google_lite",
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
    return internalErrorResponse(requestId, "api/v1/tasks", error)
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
      .select("plan, globaltasks")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch user profile", requestId)
    }
    const planValue = String(profile.plan ?? "").trim().toLowerCase()

    const maxTasks = Math.max(0, Number(profile.globaltasks || 0))
    if (maxTasks <= 0) {
      return errorResponse(403, "TASKS_LIMIT_DISABLED", "Tasks quota is not enabled for this account.", requestId)
    }

    const { count: taskCount, error: countError } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to check task limit", requestId)
    }

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
    const requestedGoogleMode = typeof body.google_mode === "string" ? body.google_mode : "google_lite"
    if (!name || name.length > 120) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid task name", requestId)
    }
    if (!isUuid(fileId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file_id", requestId)
    }
    if (!GOOGLE_MODES.has(requestedGoogleMode)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid google mode", requestId)
    }

    let googleMode = requestedGoogleMode
    if (planValue === "starter") {
      googleMode = "google_lite"
    } else if (planValue === "pro" && googleMode === "google_deep") {
      return errorResponse(403, "PLAN_RESTRICTED_MODE", "Google Deep requires Pro+ plan.", requestId)
    } else if (planValue === "free" && googleMode !== "google_lite") {
      return errorResponse(403, "PLAN_RESTRICTED_MODE", "Google Fast and Google Deep require paid plans.", requestId)
    }

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
        google_mode: googleMode,
        ai_mode: true,
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
    return internalErrorResponse(requestId, "api/v1/tasks", error)
  }
}
