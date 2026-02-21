import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isUuid,
} from "@/lib/api/security"

const VALID_SIZES = [64, 128, 256] as const
type ValidSize = (typeof VALID_SIZES)[number]

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Type": "image/webp",
}

function isValidSize(value: number): value is ValidSize {
  return VALID_SIZES.includes(value as ValidSize)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; size: string }> }
) {
  const requestId = createRequestId()

  try {
    const resolvedParams = await params
    const userId = resolvedParams.userId
    const size = parseInt(resolvedParams.size, 10)

    if (!isUuid(userId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid user id", requestId)
    }
    if (!isValidSize(size)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid size. Must be 64, 128, or 256", requestId)
    }

    const supabase = await createClient()
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("avatar_url, avatar_hash")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      return errorResponse(404, "NOT_FOUND", "User not found", requestId)
    }
    if (!profile.avatar_url) {
      return errorResponse(404, "NOT_FOUND", "No avatar found", requestId)
    }

    const filePath = profile.avatar_url.split("/avatars/")[1]
    if (!filePath) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid avatar URL", requestId)
    }

    const etag = `"${profile.avatar_hash ?? "none"}-${size}"`
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: CACHE_HEADERS,
      })
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("avatars")
      .download(filePath)
    if (downloadError || !fileData) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to download avatar", requestId)
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const sharpModule = await import("sharp")
    const sharp = sharpModule.default
    const processedImage = await sharp(buffer)
      .resize(size, size, { fit: "cover", position: "center" })
      .webp({ quality: 85, effort: 4 })
      .toBuffer()

    return new NextResponse(new Uint8Array(processedImage), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        ETag: etag,
        "Accept-Ranges": "bytes",
      },
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/avatar/proxy", error)
  }
}
