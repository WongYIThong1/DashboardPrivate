import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createRequestId,
  errorResponse,
  internalErrorResponse,
  isUuid,
  sameOriginWriteGuard,
} from "@/lib/api/security"

const ALLOWED_MODULES = new Set(["scraper", "keyword_scraper", "vulnerability_scanner"])
const ALLOWED_ENGINES = ["google_lite", "google_fast", "google_deep"] as const
const ALLOWED_ENGINES_SET = new Set<string>(ALLOWED_ENGINES)

type GlobalTaskSettings = {
  module: "scraper" | "keyword_scraper" | "vulnerability_scanner"
  file_id: string | null
  google_mode: "google_lite" | "google_fast" | "google_deep"
  country_target_enabled: boolean
  countries: string[]
  engines: string[]
  filter_redirect_links: boolean
  filter_blacklist_domains: boolean
  antipublic: boolean
}

const DEFAULT_SETTINGS: GlobalTaskSettings = {
  module: "scraper",
  file_id: null,
  google_mode: "google_lite",
  country_target_enabled: false,
  countries: [],
  engines: [...ALLOWED_ENGINES],
  filter_redirect_links: true,
  filter_blacklist_domains: true,
  antipublic: false,
}

function sanitizeCountries(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 80)
    .slice(0, 3)
}

function sanitizeEngines(value: unknown): string[] {
  if (!Array.isArray(value)) return [...ALLOWED_ENGINES]
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => ALLOWED_ENGINES_SET.has(item))
  const unique = Array.from(new Set(cleaned))
  return unique.length > 0 ? unique : [...ALLOWED_ENGINES]
}

export async function GET() {
  const requestId = createRequestId()
  try {
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
      .select("plan")
      .eq("id", user.id)
      .maybeSingle()
    const isStarterPlan = String(profile?.plan ?? "").trim().toLowerCase() === "starter"

    const { data, error } = await supabase
      .from("global_tasks")
      .select("module, file_id, google_mode, country_target_enabled, countries, engines, filter_redirect_links, filter_blacklist_domains, antipublic")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch global task settings", requestId)
    }

    if (!data) {
      return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS, requestId })
    }

    const settings: GlobalTaskSettings = {
      module: ALLOWED_MODULES.has(data.module) ? (data.module as GlobalTaskSettings["module"]) : "scraper",
      file_id: typeof data.file_id === "string" ? data.file_id : null,
      google_mode:
        data.google_mode === "google_fast" || data.google_mode === "google_deep" ? data.google_mode : "google_lite",
      country_target_enabled: isStarterPlan ? false : data.country_target_enabled === true,
      countries: isStarterPlan ? [] : sanitizeCountries(data.countries),
      engines: sanitizeEngines(data.engines),
      filter_redirect_links: data.filter_redirect_links !== false,
      filter_blacklist_domains: data.filter_blacklist_domains !== false,
      antipublic: false,
    }

    return NextResponse.json({ success: true, settings, requestId })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/tasks/settings", error)
  }
}

export async function PUT(request: Request) {
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
      .select("plan")
      .eq("id", user.id)
      .maybeSingle()
    const isStarterPlan = String(profile?.plan ?? "").trim().toLowerCase() === "starter"

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON body", requestId)
    }

    const moduleValue = typeof body.module === "string" ? body.module : DEFAULT_SETTINGS.module
    if (!ALLOWED_MODULES.has(moduleValue)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid module", requestId)
    }
    const googleModeRaw = typeof body.google_mode === "string" ? body.google_mode : "google_lite"
    const googleMode =
      googleModeRaw === "google_fast" || googleModeRaw === "google_deep" ? googleModeRaw : "google_lite"

    const countries = sanitizeCountries(body.countries)
    if (Array.isArray(body.countries) && body.countries.length > 3) {
      return errorResponse(400, "VALIDATION_ERROR", "You can select up to 3 countries", requestId)
    }
    const countryTargetEnabled = isStarterPlan ? false : body.country_target_enabled === true
    const engines = sanitizeEngines(body.engines)

    const rawFileId = typeof body.file_id === "string" ? body.file_id.trim() : ""
    const fileId = rawFileId.length > 0 ? rawFileId : null
    if (fileId !== null && !isUuid(fileId)) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid file_id", requestId)
    }

    if (fileId !== null) {
      const { data: file, error: fileError } = await supabase
        .from("user_files")
        .select("id")
        .eq("id", fileId)
        .eq("user_id", user.id)
        .single()
      if (fileError || !file) {
        return errorResponse(404, "NOT_FOUND", "File not found or access denied", requestId)
      }
    }

    const payload = {
      user_id: user.id,
      module: moduleValue,
      file_id: fileId,
      google_mode: googleMode,
      country_target_enabled: countryTargetEnabled,
      countries: countryTargetEnabled ? countries : [],
      engines,
      filter_redirect_links: body.filter_redirect_links !== false,
      filter_blacklist_domains: body.filter_blacklist_domains !== false,
      antipublic: false,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("global_tasks").upsert(payload, { onConflict: "user_id" })
    if (error) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to save global task settings", requestId)
    }

    return NextResponse.json({
      success: true,
      settings: {
        module: payload.module,
        file_id: payload.file_id,
        google_mode: payload.google_mode,
        country_target_enabled: payload.country_target_enabled,
        countries: payload.countries,
        engines: payload.engines,
        filter_redirect_links: payload.filter_redirect_links,
        filter_blacklist_domains: payload.filter_blacklist_domains,
        antipublic: false,
      },
      requestId,
    })
  } catch (error) {
    return internalErrorResponse(requestId, "api/v1/tasks/settings", error)
  }
}
