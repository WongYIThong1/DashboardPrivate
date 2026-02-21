import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isUuid,
  sameOriginWriteGuard,
} from "@/lib/api/security"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId()
  try {
    const { id: taskId } = await params
    if (!isUuid(taskId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid task id format", requestId)
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .select("id, name, status, found, target, file_id, google_mode, created_at, updated_at, started_at")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .single()

    if (error || !task) {
      return errorResponse(404, "NOT_FOUND", "Task not found", requestId)
    }

    return NextResponse.json({ success: true, data: task, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/tasks/[id]", error)
  }
}

export async function PATCH() {
  const requestId = createRequestId()
  return NextResponse.json(
    {
      success: false,
      code: "NOT_IMPLEMENTED",
      message: "Tasks patch endpoint is not implemented yet.",
      requestId,
    },
    { status: 501 }
  )
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId()
  try {
    const csrfError = sameOriginWriteGuard(request, requestId)
    if (csrfError) return csrfError

    const { id: taskId } = await params
    if (!isUuid(taskId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid task id format", requestId)
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", user.id)

    if (error) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to delete task", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/tasks/[id]", error)
  }
}
