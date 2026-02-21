import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  fetchWithTimeout,
  getAllowedHosts,
  internalErrorResponse,
  isUuid,
  sanitizeDownloadFilename,
  validateOutgoingUrl,
} from "@/lib/api/security"

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const parsed = new URL(url)
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop()
    return sanitizeDownloadFilename(lastSegment ? decodeURIComponent(lastSegment) : fallback, fallback)
  } catch {
    return fallback
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskid: string }> }
) {
  const requestId = createRequestId()

  try {
    const { taskid } = await params
    if (!isUuid(taskid)) {
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

    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskid)
      .eq("user_id", user.id)
      .single()

    if (!task) {
      return errorResponse(404, "NOT_FOUND", "Task not found", requestId)
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token || session.access_token.length < 20) {
      return errorResponse(401, "UNAUTHORIZED", "Missing or invalid bearer token", requestId)
    }

    const rawExternalApiDomain = process.env.EXTERNAL_API_DOMAIN ?? "http://localhost:8080"
    const externalBaseUrl = new URL(rawExternalApiDomain)
    const externalAllowedHosts = getAllowedHosts(
      process.env.EXTERNAL_API_ALLOWED_HOSTS,
      externalBaseUrl.hostname
    )
    const safeExternalBaseUrl = await validateOutgoingUrl(
      externalBaseUrl.toString(),
      externalAllowedHosts,
      externalBaseUrl.protocol === "http:"
    )

    if (!safeExternalBaseUrl) {
      return errorResponse(500, "SERVER_MISCONFIGURED", "External API host is not allowed", requestId)
    }

    const metaUrl = new URL(`/download/injection/${taskid}`, safeExternalBaseUrl)
    const metaResp = await fetchWithTimeout(
      metaUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
      10000
    )

    const meta = await metaResp.json().catch(() => null)
    const downloadUrl: string | undefined = meta?.downloadurl ?? meta?.download_url
    if (!metaResp.ok || !meta?.success || !downloadUrl) {
      const status = metaResp.status && metaResp.status >= 400 ? metaResp.status : 502
      return errorResponse(status, "UPSTREAM_ERROR", "Failed to create download URL", requestId)
    }

    const downloadAllowedHosts = getAllowedHosts(
      process.env.EXTERNAL_DOWNLOAD_ALLOWED_HOSTS,
      safeExternalBaseUrl.hostname,
      process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : ""
    )
    const allowHttpDownload = safeExternalBaseUrl.protocol === "http:"
    const safeDownloadUrl = await validateOutgoingUrl(
      downloadUrl,
      downloadAllowedHosts,
      allowHttpDownload
    )
    if (!safeDownloadUrl) {
      return errorResponse(502, "UPSTREAM_ERROR", "Upstream download URL is not allowed", requestId)
    }

    const fileResp = await fetchWithTimeout(
      safeDownloadUrl,
      { method: "GET", cache: "no-store" },
      20000
    )
    if (!fileResp.ok || !fileResp.body) {
      return errorResponse(502, "UPSTREAM_ERROR", "Failed to download file", requestId)
    }

    const contentType = fileResp.headers.get("content-type") || "application/octet-stream"
    const fallbackName = `${taskid}.csv`
    const fileName = filenameFromUrl(safeDownloadUrl.toString(), fallbackName)

    return new NextResponse(fileResp.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/download/injection", error)
  }
}
