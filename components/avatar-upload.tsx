"use client"

import * as React from "react"
import { IconUpload, IconLoader2, IconTrash, IconCamera, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AvatarImageComponent } from "@/components/avatar-image"
import { compressImage, validateImageFile, generateFileHash } from "@/lib/image-utils"
import { generateThumbnail, setCachedAvatar, clearCachedAvatar } from "@/lib/avatar-cache"

interface AvatarUploadProps {
  userId: string
  username: string
  currentAvatarUrl?: string | null
  currentAvatarHash?: string | null
  onUploadSuccess: (avatarUrl: string, hash: string) => void
  onRemoveSuccess: () => void
}

export function AvatarUpload({
  userId,
  username,
  currentAvatarUrl,
  currentAvatarHash,
  onUploadSuccess,
  onRemoveSuccess,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件
    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    // 设置选中的文件
    setSelectedFile(file)
    
    // 生成预览
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)

    try {
      // 1. 压缩图片
      const compressedFile = await compressImage(selectedFile)
      
      // 2. 生成哈希
      const hash = await generateFileHash(compressedFile)
      
      // 3. 生成缩略图
      const thumbnail = await generateThumbnail(compressedFile)
      
      // 4. 上传到服务器
      const formData = new FormData()
      formData.append('avatar', compressedFile)
      formData.append('hash', hash)

      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      
      // 5. 加密缓存头像
      await setCachedAvatar(userId, thumbnail, data.avatarUrl, hash)
      
      // 6. 通知父组件
      onUploadSuccess(data.avatarUrl, hash)
      
      toast.success('Avatar uploaded successfully')
      
      // 清除预览
      setSelectedFile(null)
      setPreviewUrl(null)
      
      // 刷新页面以更新所有组件
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!currentAvatarUrl) return

    setIsRemoving(true)

    try {
      const response = await fetch('/api/avatar/upload', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Remove failed')
      }

      // 清除缓存
      clearCachedAvatar(userId)
      
      // 通知父组件
      onRemoveSuccess()
      
      toast.success('Avatar removed successfully')
      
      // 刷新页面以更新所有组件
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('Remove error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove avatar')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-6">
      {/* 头像预览 */}
      <div className="relative">
        {previewUrl ? (
          <div className="h-24 w-24 rounded-lg overflow-hidden border-2 border-primary">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        ) : (
          <AvatarImageComponent
            userId={userId}
            avatarUrl={currentAvatarUrl}
            avatarHash={currentAvatarHash}
            username={username}
            size="lg"
            className="h-24 w-24"
          />
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <IconLoader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {selectedFile ? (
          // 显示上传和取消按钮
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={isUploading || isRemoving}
            >
              {isUploading ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <IconUpload className="size-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isUploading || isRemoving}
            >
              <IconX className="size-4 mr-2" />
              Cancel
            </Button>
          </div>
        ) : (
          // 显示选择和删除按钮
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
            >
              <IconCamera className="size-4 mr-2" />
              Change Avatar
            </Button>

            {currentAvatarUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={isUploading || isRemoving}
              >
                {isRemoving ? (
                  <>
                    <IconLoader2 className="size-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <IconTrash className="size-4 mr-2" />
                    Remove Avatar
                  </>
                )}
              </Button>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP. Max 2MB.
        </p>
      </div>
    </div>
  )
}
