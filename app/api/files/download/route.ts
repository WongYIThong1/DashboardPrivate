import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isSafeTxtFilename,
  sanitizeDownloadFilename,
} from "@/lib/api/security"

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("name")?.trim() ?? ""
    if (!isSafeTxtFilename(filename)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid filename", requestId)
    }

    const { data: file, error: fileError } = await supabase
      .from("user_files")
      .select("filename, file_path, mime_type")
      .eq("user_id", user.id)
      .eq("filename", filename)
      .single()

    if (fileError || !file) {
      return errorResponse(404, "NOT_FOUND", "File not found", requestId)
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("user-files")
      .download(file.file_path)

    if (downloadError || !fileData) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to download file", requestId)
    }

    const safeName = sanitizeDownloadFilename(file.filename, "download.txt")
    return new NextResponse(fileData, {
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files/download", error)
  }
}

