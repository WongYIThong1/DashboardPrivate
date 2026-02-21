// 头像缓存工具 - 参考 Discord 的快速加载机制，带加密存储

interface CachedAvatar {
  thumbnail: string // Base64 缩略图 (64x64)
  fullUrl: string // 完整图片 URL
  hash: string // 文件哈希
  cachedAt: number
}

const CACHE_PREFIX = 'avatar_cache_'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天
const ENCRYPTION_KEY_NAME = 'avatar'

// 生成或获取加密密钥
async function getEncryptionKey(): Promise<CryptoKey> {
  try {
    // 尝试从 localStorage 获取已存储的密钥
    const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME)
    
    if (storedKey) {
      // 导入已存储的密钥
      const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0))
      return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
    }
    
    // 生成新密钥
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    
    // 导出并存储密钥
    const exportedKey = await crypto.subtle.exportKey('raw', key)
    const keyArray = new Uint8Array(exportedKey)
    const keyBase64 = btoa(String.fromCharCode(...keyArray))
    localStorage.setItem(ENCRYPTION_KEY_NAME, keyBase64)
    
    return key
  } catch (error) {
    console.error('Failed to get encryption key:', error)
    throw error
  }
}

// 加密数据
async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
    const encodedData = new TextEncoder().encode(data)
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    )
    
    // 组合 IV 和加密数据
    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedData), iv.length)
    
    // 转换为 Base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Failed to encrypt data:', error)
    throw error
  }
}

// 解密数据
async function decryptData(encryptedBase64: string): Promise<string> {
  try {
    const key = await getEncryptionKey()
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    
    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12)
    const encryptedData = combined.slice(12)
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    )
    
    return new TextDecoder().decode(decryptedData)
  } catch (error) {
    console.error('Failed to decrypt data:', error)
    throw error
  }
}

export async function getCachedAvatar(userId: string): Promise<CachedAvatar | null> {
  try {
    const encrypted = localStorage.getItem(`${CACHE_PREFIX}${userId}`)
    if (!encrypted) return null

    // 解密数据
    const decrypted = await decryptData(encrypted)
    const data: CachedAvatar = JSON.parse(decrypted)
    
    // 检查缓存是否过期
    const now = Date.now()
    if (now - data.cachedAt > CACHE_DURATION) {
      localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
      return null
    }

    return data
  } catch (error) {
    console.error('Failed to get cached avatar:', error)
    // 如果解密失败，清除损坏的缓存
    localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
    return null
  }
}

export async function setCachedAvatar(
  userId: string,
  thumbnail: string,
  fullUrl: string,
  hash: string
): Promise<void> {
  try {
    // 移除 URL 中的版本参数，只存储基础 URL
    const baseUrl = fullUrl.split('?')[0]
    
    const data: CachedAvatar = {
      thumbnail,
      fullUrl: baseUrl,
      hash,
      cachedAt: Date.now(),
    }
    
    // 加密数据
    const encrypted = await encryptData(JSON.stringify(data))
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, encrypted)
  } catch (error) {
    console.error('Failed to cache avatar:', error)
  }
}

export function clearCachedAvatar(userId: string): void {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
  } catch (error) {
    console.error('Failed to clear cached avatar:', error)
  }
}

// 生成缩略图 (64x64 Base64)
export async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // 设置缩略图尺寸
        canvas.width = 64
        canvas.height = 64

        // 绘制图片（居中裁剪）
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2
        const y = (img.height - size) / 2
        ctx.drawImage(img, x, y, size, size, 0, 0, 64, 64)

        // 转换为 Base64（低质量）
        resolve(canvas.toDataURL('image/jpeg', 0.5))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// 生成用户名的颜色（用于默认头像背景）
export function getUserColor(username: string): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
  ]
  
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}
