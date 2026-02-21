import { NextResponse } from "next/server"
import { createRequestId, internalErrorResponse } from "@/lib/api/security"
import { proxyJsonToExternalApi } from "@/lib/api/external-proxy"

function clamp(value: string | null, min: number, max: number, fallback: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(fallback)
  return String(Math.max(min, Math.min(max, Math.trunc(n))))
}

export async function GET(request: Request) {
  const requestId = createRequestId()

  try {
    const { searchParams } = new URL(request.url)
    const upstream = await proxyJsonToExternalApi({
      requestId,
      path: "/history",
      query: {
        page: clamp(searchParams.get("page"), 1, 1_000_000, 1),
        limit: clamp(searchParams.get("limit"), 1, 1000, 100),
      },
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
    return internalErrorResponse(requestId, "api/external/history", error)
  }
}

