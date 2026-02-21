import { NextResponse } from "next/server"
import { createRequestId, internalErrorResponse } from "@/lib/api/security"
import { proxyJsonToExternalApi } from "@/lib/api/external-proxy"

export async function GET() {
  const requestId = createRequestId()

  try {
    const upstream = await proxyJsonToExternalApi({
      requestId,
      path: "/announcement",
      timeoutMs: 10000,
    })

    if (upstream instanceof Response) {
      const payload = await upstream.text()
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      })
    }

    return upstream
  } catch (error) {
    return internalErrorResponse(requestId, "api/external/announcement", error)
  }
}

