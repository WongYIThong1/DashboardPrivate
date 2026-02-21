import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{16,128}$/i.test(value)
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

    const formData = await request.formData()
    const file = formData.get("avatar")
    const hash = formData.get("hash")

    if (!(file instanceof File)) {
      return errorResponse(400, "VALIDATION_ERROR", "No avatar file provided", requestId)
    }
    if (!isValidHash(hash)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid hash", requestId)
    }
    if (!(file.type in AVATAR_MIME_TO_EXT)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file type", requestId)
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return errorResponse(400, "VALIDATION_ERROR", "File too large", requestId)
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single()

    if (profile?.avatar_url) {
      const oldPath = profile.avatar_url.split("/avatars/")[1]
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath])
      }
    }

    const fileExt = AVATAR_MIME_TO_EXT[file.type]
    const filePath = `${user.id}/${hash}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
      contentType: file.type,
    })

    if (uploadError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to upload avatar", requestId)
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath)
    if (!urlData.publicUrl) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to get avatar URL", requestId)
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        avatar_url: urlData.publicUrl,
        avatar_hash: hash,
        avatar_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to update profile", requestId)
    }

    return NextResponse.json({
      success: true,
      avatarUrl: urlData.publicUrl,
      hash,
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/avatar/upload", error)
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

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single()

    if (profile?.avatar_url) {
      const filePath = profile.avatar_url.split("/avatars/")[1]
      if (filePath) {
        await supabase.storage.from("avatars").remove([filePath])
      }
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        avatar_url: null,
        avatar_hash: null,
        avatar_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to remove avatar", requestId)
    }

    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/avatar/upload", error)
  }
}

