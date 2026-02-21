const CACHE_KEY = "dashboard_snapshot_cache_v1"
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

type CachedDashboardSnapshot = {
  payload: unknown
  cachedAt: number
}

export function getCachedDashboardSnapshot(): unknown | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    const cached = JSON.parse(raw) as CachedDashboardSnapshot
    if (typeof cached.cachedAt !== "number") {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    if (Date.now() - cached.cachedAt > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    return cached.payload ?? null
  } catch (error) {
    console.error("Failed to read dashboard cache:", error)
    return null
  }
}

export function setCachedDashboardSnapshot(payload: unknown): void {
  try {
    const record: CachedDashboardSnapshot = {
      payload,
      cachedAt: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(record))
  } catch (error) {
    console.error("Failed to write dashboard cache:", error)
  }
}

export function clearCachedDashboardSnapshot(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.error("Failed to clear dashboard cache:", error)
  }
}
