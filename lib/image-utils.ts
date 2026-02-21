// 图片处理工具
import imageCompression from 'browser-image-compression'

// 压缩和调整图片大小（保持原始尺寸，服务端会处理多尺寸）
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1, // 最大 1MB
    maxWidthOrHeight: 512, // 最大尺寸 512x512（服务端会生成多尺寸）
    useWebWorker: true,
    fileType: 'image/webp', // 转换为 WebP
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.error('Image compression failed:', error)
    throw new Error('Failed to compress image')
  }
}

// 验证图片文件
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload JPG, PNG, or WebP.' }
  }

  // 检查文件大小 (2MB)
  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 2MB.' }
  }

  return { valid: true }
}

// 生成文件哈希
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 16) // 使用前16个字符
}
