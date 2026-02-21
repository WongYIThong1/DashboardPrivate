import { NextResponse } from "next/server"
import { createRequestId } from "@/lib/api/security"

function deprecatedTasksResponse() {
  const requestId = createRequestId()
  return NextResponse.json(
    {
      success: false,
      code: "DEPRECATED_ENDPOINT",
      message: "api/v1/tasks is disabled. Please use /api/v1/dumper instead.",
      requestId,
    },
    { status: 410 }
  )
}

export async function POST() {
  return deprecatedTasksResponse()
}
