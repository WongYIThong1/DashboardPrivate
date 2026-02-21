import { createRequestId, internalErrorResponse } from "@/lib/api/security"
import { proxySseToExternalApi } from "@/lib/api/external-proxy"

export async function GET(request: Request) {
  const requestId = createRequestId()

  try {
    const { searchParams } = new URL(request.url)
    return await proxySseToExternalApi({
      requestId,
      path: "/sse/dashboard",
      query: {
        since: searchParams.get("since") || undefined,
      },
      timeoutMs: 60000,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/external/sse/dashboard", error)
  }
}

