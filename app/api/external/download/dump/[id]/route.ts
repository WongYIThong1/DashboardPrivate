import { NextResponse } from "next/server"
import { createRequestId, internalErrorResponse } from "@/lib/api/security"
import { proxyJsonToExternalApi } from "@/lib/api/external-proxy"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId()

  try {
    const { id } = await params
    const upstream = await proxyJsonToExternalApi({
      requestId,
      method: "POST",
      path: `/download/dump/${encodeURIComponent(id)}`,
      timeoutMs: 15000,
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
    return internalErrorResponse(requestId, "api/external/download/dump/[id]", error)
  }
}

