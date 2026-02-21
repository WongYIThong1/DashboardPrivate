import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isSafeTxtFilename,
  sameOriginWriteGuard,
} from "@/lib/api/security"

export async function PATCH(request: Request) {
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
    const oldName = typeof body?.oldName === "string" ? body.oldName.trim() : ""
    const newName = typeof body?.newName === "string" ? body.newName.trim() : ""

    if (!isSafeTxtFilename(oldName) || !isSafeTxtFilename(newName)) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Old and new file names must be safe .txt names",
        requestId
      )
    }

    const { data: existingFile } = await supabase
      .from("user_files")
      .select("id")
      .eq("user_id", user.id)
      .eq("filename", newName)
      .maybeSingle()

    if (existingFile) {
      return errorResponse(409, "CONFLICT", "A file with this name already exists", requestId)
    }

    const { data: oldFile, error: fileError } = await supabase
      .from("user_files")
      .select("id, file_path")
      .eq("user_id", user.id)
      .eq("filename", oldName)
      .single()

    if (fileError || !oldFile) {
      return errorResponse(404, "NOT_FOUND", "File not found", requestId)
    }

    const oldPath = oldFile.file_path
    const newPath = `${user.id}/${newName}`

    const { error: moveError } = await supabase.storage.from("user-files").move(oldPath, newPath)
    if (moveError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to rename file in storage", requestId)
    }

    const { error: updateError } = await supabase
      .from("user_files")
      .update({
        filename: newName,
        file_path: newPath,
      })
      .eq("id", oldFile.id)
      .eq("user_id", user.id)

    if (updateError) {
      await supabase.storage.from("user-files").move(newPath, oldPath)
      return errorResponse(500, "INTERNAL_ERROR", "Failed to update file record", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files/rename", error)
  }
}

