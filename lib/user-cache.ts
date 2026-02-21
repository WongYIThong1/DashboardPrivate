// 用户信息缓存工具

interface CachedUserInfo {
  id?: string
  username: string
  email: string
  plan?: string
  avatarUrl?: string | null
  avatarHash?: string | null
  cachedAt: number
}

const CACHE_KEY = 'user_info_cache'
const USER_CACHE_UPDATED_EVENT = "user-info-cache-updated"

export function getCachedUserInfo(): CachedUserInfo | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: CachedUserInfo = JSON.parse(cached)

    return data
  } catch (error) {
    console.error('Failed to get cached user info:', error)
    return null
  }
}

export function setCachedUserInfo(data: {
  id?: string
  username: string
  email: string
  plan?: string
  avatarUrl?: string | null
  avatarHash?: string | null
}): void {
  try {
    const payload: CachedUserInfo = {
      id: data.id,
      username: data.username,
      email: data.email,
      plan: data.plan,
      avatarUrl: data.avatarUrl ?? null,
      avatarHash: data.avatarHash ?? null,
      cachedAt: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent(USER_CACHE_UPDATED_EVENT))
  } catch (error) {
    console.error('Failed to cache user info:', error)
  }
}

export function clearCachedUserInfo(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.error('Failed to clear cached user info:', error)
  }
}
