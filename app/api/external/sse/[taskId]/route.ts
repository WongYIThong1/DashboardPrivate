import { createRequestId, internalErrorResponse } from "@/lib/api/security"
import { proxySseToExternalApi } from "@/lib/api/external-proxy"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const requestId = createRequestId()

  try {
    const { taskId } = await params
    const { searchParams } = new URL(request.url)
    return await proxySseToExternalApi({
      requestId,
      path: `/sse/${encodeURIComponent(taskId)}`,
      query: {
        since: searchParams.get("since") || undefined,
      },
      timeoutMs: 60000,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/external/sse/[taskId]", error)
  }
}

