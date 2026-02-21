import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isSafeTxtFilename,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const MAX_BATCH_DELETE = 100

export async function DELETE(request: Request) {
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
    const fileNames = Array.isArray(body?.fileNames) ? body.fileNames : null
    if (!fileNames || fileNames.length === 0) {
      return errorResponse(400, "VALIDATION_ERROR", "File names array is required", requestId)
    }
    if (fileNames.length > MAX_BATCH_DELETE) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        `Maximum ${MAX_BATCH_DELETE} files can be deleted per request`,
        requestId
      )
    }

    let successCount = 0
    let failedCount = 0

    for (const rawName of fileNames) {
      const fileName = typeof rawName === "string" ? rawName.trim() : ""
      if (!isSafeTxtFilename(fileName)) {
        failedCount += 1
        continue
      }

      try {
        const { data: file, error: fileError } = await supabase
          .from("user_files")
          .select("id, file_path")
          .eq("user_id", user.id)
          .eq("filename", fileName)
          .single()

        if (fileError || !file) {
          failedCount += 1
          continue
        }

        const { error: storageError } = await supabase.storage.from("user-files").remove([file.file_path])
        if (storageError) {
          failedCount += 1
          continue
        }

        const { error: dbError } = await supabase
          .from("user_files")
          .delete()
          .eq("id", file.id)
          .eq("user_id", user.id)

        if (dbError) {
          failedCount += 1
          continue
        }

        successCount += 1
      } catch {
        failedCount += 1
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      total: fileNames.length,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files/batch-delete", error)
  }
}

