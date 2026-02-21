import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isSafeTxtFilename,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024 // 512MB
const MAX_URL_FILE_SCAN_BYTES = 20 * 1024 * 1024 // 20MB
const MAX_URL_FILE_LINES = 10000
const ALLOWED_FILE_TYPES = new Set(["data", "urls", "dorks", "keywords", "parameter", "parameters"])

async function countLinesInTextFile(file: File, maxBytes: number) {
  const reader = file.stream().getReader()
  let lineCount = 0
  let bytesRead = 0
  let hasContent = false
  let lastByte = 10

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    bytesRead += value.byteLength
    if (bytesRead > maxBytes) {
      throw new Error("FILE_SCAN_LIMIT_EXCEEDED")
    }

    for (const byte of value) {
      if (byte === 10) {
        lineCount += 1
      } else if (byte !== 13) {
        hasContent = true
      }
      lastByte = byte
    }

    if (lineCount > MAX_URL_FILE_LINES) {
      throw new Error("LINE_LIMIT_EXCEEDED")
    }
  }

  if (hasContent && lastByte !== 10 && lastByte !== 13) {
    lineCount += 1
  }

  // Re-check after counting the trailing line (file may not end with newline).
  if (lineCount > MAX_URL_FILE_LINES) {
    throw new Error("LINE_LIMIT_EXCEEDED")
  }

  return lineCount
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
      .select("storage_used, storage_limit, plan")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch user profile", requestId)
    }

    if (profile.plan === "Free") {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Free plan users cannot upload files. Please upgrade your plan.",
        requestId
      )
    }

    if (profile.storage_limit === 0) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Storage quota is not set. Please contact support.",
        requestId
      )
    }

    const formData = await request.formData()
    const uploaded = formData.get("file")
    const fileType = formData.get("type")

    if (!(uploaded instanceof File)) {
      return errorResponse(400, "VALIDATION_ERROR", "No file provided", requestId)
    }
    if (typeof fileType !== "string" || !ALLOWED_FILE_TYPES.has(fileType)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file type", requestId)
    }
    if (!isSafeTxtFilename(uploaded.name)) {
      return errorResponse(400, "VALIDATION_ERROR", "Only safe .txt file names are allowed", requestId)
    }
    if (uploaded.size <= 0) {
      return errorResponse(400, "VALIDATION_ERROR", "Uploaded file is empty", requestId)
    }
    if (uploaded.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse(413, "PAYLOAD_TOO_LARGE", "File too large. Maximum size is 512MB.", requestId)
    }
    if (profile.storage_used + uploaded.size > profile.storage_limit) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Storage quota exceeded. Please delete some files or upgrade your plan.",
        requestId
      )
    }

    let lineCount: number | null = null
    if (fileType === "urls") {
      try {
        lineCount = await countLinesInTextFile(uploaded, MAX_URL_FILE_SCAN_BYTES)
      } catch (error) {
        if (error instanceof Error && error.message === "LINE_LIMIT_EXCEEDED") {
          return errorResponse(
            400,
            "VALIDATION_ERROR",
            "Vuln files are limited to 10,000 lines maximum.",
            requestId
          )
        }
        if (error instanceof Error && error.message === "FILE_SCAN_LIMIT_EXCEEDED") {
          return errorResponse(
            400,
            "VALIDATION_ERROR",
            "Vuln files larger than 20MB are not supported.",
            requestId
          )
        }
        return errorResponse(400, "VALIDATION_ERROR", "Failed to process Vuln file", requestId)
      }
    } else {
      // For non-Vuln file types, we still compute line count for UI display,
      // but we do not enforce any line-limit validation.
      const text = await uploaded.text()
      if (text.length === 0) {
        lineCount = 0
      } else {
        lineCount = text.split(/\r?\n/).length
      }
    }

    const filePath = `${user.id}/${uploaded.name}`
    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(filePath, uploaded, {
        cacheControl: "3600",
        upsert: false,
        contentType: "text/plain; charset=utf-8",
      })

    if (uploadError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to upload file", requestId)
    }

    const { error: dbError } = await supabase.from("user_files").insert({
      user_id: user.id,
      filename: uploaded.name.trim(),
      file_path: filePath,
      file_size: uploaded.size,
      mime_type: uploaded.type || "text/plain",
      file_type: fileType,
      line_count: lineCount,
    })

    if (dbError) {
      await supabase.storage.from("user-files").remove([filePath])
      return errorResponse(500, "INTERNAL_ERROR", "Failed to save file record", requestId)
    }

    return NextResponse.json({
      success: true,
      filename: uploaded.name,
      size: uploaded.size,
      lines: lineCount,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files/upload", error)
  }
}

