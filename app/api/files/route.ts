import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isSafeTxtFilename,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const ALLOWED_FILE_TYPES = new Set(["data", "urls", "dorks", "keywords", "parameter", "parameters"])

function isSafeUserStoragePath(path: string, userId: string): boolean {
  if (!path || path.length > 1024) return false
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) return false
  return path.startsWith(`${userId}/`)
}

async function listUserStorageFiles(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const queue: string[] = [userId]
  const files: Array<{ id: string; name: string; metadata: { size?: number }; updated_at: string }> = []
  let scannedNodes = 0
  const MAX_NODES = 5000

  while (queue.length > 0 && scannedNodes < MAX_NODES) {
    const currentPath = queue.shift() as string
    const { data, error } = await supabase.storage.from("user-files").list(currentPath, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "updated_at", order: "desc" },
    })

    if (error) throw error

    for (const entry of data || []) {
      scannedNodes += 1
      if (!entry.id) {
        queue.push(`${currentPath}/${entry.name}`)
        continue
      }
      files.push({
        id: String(entry.id),
        name: `${currentPath}/${entry.name}`,
        metadata: (entry.metadata || {}) as { size?: number },
        updated_at: entry.updated_at || entry.created_at || new Date().toISOString(),
      })
    }
  }

  return files
}

export async function GET(request: Request) {
  const requestId = createRequestId()

  try {
    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get("type")
    const minimal = searchParams.get("minimal") === "1"

    if (typeFilter && !ALLOWED_FILE_TYPES.has(typeFilter)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file type filter", requestId)
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized", requestId)
    }

    let filesQuery = supabase
      .from("user_files")
      .select("id, filename, file_path, file_type, updated_at, file_size, line_count")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (typeFilter) {
      filesQuery = filesQuery.eq("file_type", typeFilter)
    }

    const { data: files, error: filesError } = await filesQuery
    if (filesError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch files", requestId)
    }

    const dbFiles = files || []
    const dbPathSet = new Set(dbFiles.map((f) => f.file_path))
    let extraStorageFiles: Array<{
      id: string
      name: string
      file_path: string
      size: number
      type: string
      lines: number | null
      modified: string
    }> = []
    try {
      const storageObjects = await listUserStorageFiles(supabase, user.id)
      extraStorageFiles = storageObjects
        .filter((obj) => !dbPathSet.has(obj.name))
        .map((obj) => {
          const filename = obj.name.split("/").pop() || obj.name
          const isTxtFile = filename.toLowerCase().endsWith(".txt")
          const inferredType = isTxtFile ? "data" : "results"
          return {
            id: String(obj.id),
            name: filename,
            file_path: obj.name,
            size: Number(obj.metadata?.size || 0),
            type: inferredType,
            lines: null as number | null,
            modified: obj.updated_at,
          }
        })
    } catch (storageListError) {
      console.error("[api/files] storage list failed:", storageListError)
      extraStorageFiles = []
    }

    if (minimal) {
      return NextResponse.json({
        success: true,
        files: dbFiles.map((file) => ({
          id: file.id,
          name: file.filename,
          file_path: file.file_path,
          type: file.file_type,
          modified: file.updated_at,
        })),
        requestId,
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("storage_used, storage_limit")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch storage info", requestId)
    }

    return NextResponse.json({
      success: true,
      files: [
        ...dbFiles.map((file) => ({
          id: file.id,
          name: file.filename,
          file_path: file.file_path,
          size: file.file_size,
          type: file.file_type,
          lines: file.line_count,
          modified: file.updated_at,
        })),
        ...extraStorageFiles,
      ],
      storage_used: profile?.storage_used || 0,
      storage_max: profile?.storage_limit || 0,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files", error)
  }
}

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

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")?.trim() ?? ""
    if (path) {
      if (!isSafeUserStoragePath(path, user.id)) {
        return errorResponse(400, "VALIDATION_ERROR", "Invalid file path", requestId)
      }

      const { error: storageError } = await supabase.storage.from("user-files").remove([path])
      if (storageError) {
        return errorResponse(500, "INTERNAL_ERROR", "Failed to delete file from storage", requestId)
      }

      await supabase
        .from("user_files")
        .delete()
        .eq("user_id", user.id)
        .eq("file_path", path)

      return NextResponse.json({ success: true, requestId })
    }

    const filename = searchParams.get("name")?.trim() ?? ""
    if (!isSafeTxtFilename(filename)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid filename", requestId)
    }

    const { data: file, error: fileError } = await supabase
      .from("user_files")
      .select("id, file_path")
      .eq("user_id", user.id)
      .eq("filename", filename)
      .single()

    if (fileError || !file) {
      return errorResponse(404, "NOT_FOUND", "File not found", requestId)
    }

    const { error: storageError } = await supabase.storage.from("user-files").remove([file.file_path])
    if (storageError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to delete file from storage", requestId)
    }

    const { error: dbError } = await supabase
      .from("user_files")
      .delete()
      .eq("id", file.id)
      .eq("user_id", user.id)

    if (dbError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to delete file record", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/files", error)
  }
}
