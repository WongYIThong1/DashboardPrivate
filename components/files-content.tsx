"use client"

import * as React from "react"
import {
  IconFile,
  IconDownload,
  IconTrash,
  IconDotsVertical,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconLoader2,
  IconUpload,
  IconX,
  IconPencil,
  IconShield,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface FileData {
  id: string
  name: string
  filePath?: string
  size: string
  sizeBytes: number
  type: string
  lines: number | null
  modified: string
}

interface ApiFile {
  id: string
  name: string
  file_path?: string
  size: number
  type: string
  lines: number | null
  modified: string
}

type FilesMinimalCachePayload = {
  ts: number
  files: Array<{ id: string; name: string; type?: string }>
}

const ALLOWED_EXTENSION = ".txt"
const FILES_MINIMAL_CACHE_KEY = "files_minimal_cache_v1"

function getHttpErrorMessage(
  status: number,
  fallback: string,
  options?: { forbiddenMessage?: string }
): string {
  if (status === 400 || status === 422) return "Invalid request data"
  if (status === 401) return "Please login again"
  if (status === 403) return options?.forbiddenMessage || "Permission denied"
  if (status === 404) return "Resource not found"
  if (status === 409) return "Operation conflict. Please refresh and retry"
  if (status === 413) return "File is too large"
  if (status === 429) return "Too many requests. Please try again later"
  if (status >= 500) return "Server error. Please try again later"
  return fallback
}

export function FilesContent() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [filesData, setFilesData] = React.useState<FileData[]>([])
  const [query, setQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<"all" | "urls" | "data" | "dorks" | "keywords" | "parameter" | "parameters" | "results">("all")
  const [storageUsed, setStorageUsed] = React.useState(0)
  const [storageMax, setStorageMax] = React.useState(0)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [showUploadDialog, setShowUploadDialog] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [showRenameDialog, setShowRenameDialog] = React.useState(false)
  const [renameOldName, setRenameOldName] = React.useState("")
  const [renameNewName, setRenameNewName] = React.useState("")
  const [isRenaming, setIsRenaming] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null)
  const [userPlan, setUserPlan] = React.useState<string | null>(null)
  const [fileType, setFileType] = React.useState<"urls" | "data" | "dorks" | "keywords" | "parameter">("data")
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [fileToDelete, setFileToDelete] = React.useState<{ name: string; filePath?: string } | null>(null)
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = React.useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = React.useState(false)
  const hasLoadedOnceRef = React.useRef(false)

  const fetchUserInfo = React.useCallback(async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'GET',
      })

      const data = await response.json()

      if (response.ok) {
        setUserPlan(data.plan || 'Free')
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
    }
  }, [])

  // 检查是否可以上传
  const canUpload = (): { allowed: boolean; reason?: string } => {
    // 检查用户计划
    if (userPlan === 'Free') {
      return { allowed: false, reason: 'Free plan users cannot upload files. Please upgrade your plan.' }
    }

    // 检查存储配额
    if (storageMax === 0) {
      return { allowed: false, reason: 'Storage quota is not set. Please contact support.' }
    }

    // 检查存储是否已满
    if (storageUsed >= storageMax) {
      return { allowed: false, reason: 'Storage quota exceeded. Please delete some files or upgrade your plan.' }
    }

    return { allowed: true }
  }

  const fetchFiles = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    const shouldBlockUi = !silent && !hasLoadedOnceRef.current
    if (shouldBlockUi) setIsLoading(true)
    try {
      const response = await fetch('/api/files', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to fetch files"))
      }

      const data = (await response.json()) as {
        files?: ApiFile[]
        storage_used?: number
        storage_limit?: number
        storage_max?: number
      }
      console.log('Files data:', data)

      // 更新文件列表
      const formattedFiles: FileData[] = (data.files || []).map((file) => ({
        id: file.id,
        name: file.name,
        filePath: file.file_path,
        size: formatFileSize(file.size),
        sizeBytes: file.size,
        type: file.type,
        lines: file.lines,
        modified: file.modified,
      }))
      
      setFilesData(formattedFiles)
      if (typeof window !== "undefined") {
        const minimalPayload: FilesMinimalCachePayload = {
          ts: Date.now(),
          files: (data.files || []).map((file) => ({
            id: file.id,
            name: file.name,
            type: file.type,
          })),
        }
        window.localStorage.setItem(FILES_MINIMAL_CACHE_KEY, JSON.stringify(minimalPayload))
      }
      
      // 更新存储信息
      const usedBytes = Math.max(0, Number(data.storage_used ?? 0))
      const totalBytes = Math.max(0, Number(data.storage_limit ?? data.storage_max ?? 0))
      
      console.log('Storage info:', { usedBytes, totalBytes })
      
      setStorageUsed(usedBytes)
      setStorageMax(totalBytes)
      hasLoadedOnceRef.current = true
    } catch (error) {
      console.error('Failed to fetch files:', error)
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Please Try Again")
      }
    } finally {
      if (shouldBlockUi) setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchFiles({ silent: false })
    void fetchUserInfo()
  }, [fetchFiles, fetchUserInfo])

  React.useEffect(() => {
    // Avoid landing on empty pages after filtering/searching.
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [query, typeFilter])

  React.useEffect(() => {
    // Silent background refresh: keep storage + list fresh without visible loading UI.
    const tick = () => void fetchFiles({ silent: true })

    const intervalId = window.setInterval(tick, 25_000)
    const onFocus = () => tick()
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [fetchFiles])

  const handleDownload = async (fileName: string) => {
    try {
      const response = await fetch(`/api/files/download?name=${encodeURIComponent(fileName)}`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to download file"))
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to download file')
    }
  }

  const handleDeleteClick = (file: FileData) => {
    setFileToDelete({ name: file.name, filePath: file.filePath })
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!fileToDelete) return

    setIsDeleting(fileToDelete.name)
    
    // 乐观更新：立即从 UI 移除文件
    const fileToRemove = filesData.find(f => f.name === fileToDelete.name)
    if (fileToRemove) {
      setFilesData(prev => prev.filter(f => f.name !== fileToDelete.name))
      setStorageUsed(prev => Math.max(0, prev - fileToRemove.sizeBytes))
    }
    
    // 立即关闭对话框和清除选择
    setShowDeleteDialog(false)
    setFileToDelete(null)
    toast.success('File deleted successfully')

    try {
      const deleteQuery = fileToDelete.filePath
        ? `path=${encodeURIComponent(fileToDelete.filePath)}`
        : `name=${encodeURIComponent(fileToDelete.name)}`
      const response = await fetch(`/api/files?${deleteQuery}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to delete file"))
      }

      // 后台刷新确保数据一致
      fetchFiles()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete file')
      // 如果失败，重新加载数据
      fetchFiles()
    } finally {
      setIsDeleting(null)
    }
  }

  const handleBatchDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (selectedRows.length === 0) return

    setIsBatchDeleting(true)
    const fileNames = selectedRows.map(row => row.getValue("name") as string)
    
    // 乐观更新：立即从 UI 移除所有选中的文件
    const filesToRemove = filesData.filter(f => fileNames.includes(f.name))
    const totalSize = filesToRemove.reduce((sum, f) => sum + f.sizeBytes, 0)
    
    setFilesData(prev => prev.filter(f => !fileNames.includes(f.name)))
    setStorageUsed(prev => Math.max(0, prev - totalSize))
    setRowSelection({})
    
    // 立即关闭对话框
    setShowBatchDeleteDialog(false)
    toast.success(`Deleting ${fileNames.length} file${fileNames.length > 1 ? 's' : ''}...`)

    try {
      const response = await fetch('/api/files/batch-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileNames }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to delete files"))
      }

      const { success, failed } = data || { success: 0, failed: 0 }
      
      if (failed > 0) {
        toast.warning(`Deleted ${success} files, ${failed} failed`)
      } else {
        toast.success(`Successfully deleted ${success} file${success > 1 ? 's' : ''}`)
      }
      
      // 后台刷新确保数据一致
      fetchFiles()
    } catch (error) {
      console.error('Batch delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete files')
      // 如果失败，重新加载数据
      fetchFiles()
    } finally {
      setIsBatchDeleting(false)
    }
  }

  const handleRenameClick = (fileName: string) => {
    setRenameOldName(fileName)
    setRenameNewName(fileName)
    setShowRenameDialog(true)
  }

  const handleRename = async () => {
    if (!renameNewName.trim()) {
      toast.error('File name cannot be empty')
      return
    }

    if (!renameNewName.toLowerCase().endsWith('.txt')) {
      toast.error('Only .txt files are allowed')
      return
    }

    if (renameNewName === renameOldName) {
      setShowRenameDialog(false)
      return
    }

    setIsRenaming(true)
    try {
      const response = await fetch('/api/files/rename', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldName: renameOldName,
          newName: renameNewName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to rename file"))
      }

      toast.success('File renamed successfully')
      setShowRenameDialog(false)
      fetchFiles()
    } catch (error) {
      console.error('Rename error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to rename file')
    } finally {
      setIsRenaming(false)
    }
  }

  const columns: ColumnDef<FileData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") column.toggleSorting(column.getIsSorted() === "asc")
        }}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        <span>Name</span>
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="opacity-80" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="opacity-80" />
        ) : (
          <IconArrowsSort size={14} className="opacity-50" />
        )}
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <IconFile size={16} className="text-muted-foreground" />
        <span className="font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },
  {
    accessorKey: "size",
    header: ({ column }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") column.toggleSorting(column.getIsSorted() === "asc")
        }}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        <span>Size</span>
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="opacity-80" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="opacity-80" />
        ) : (
          <IconArrowsSort size={14} className="opacity-50" />
        )}
      </div>
    ),
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground">
        {row.getValue("size")}
      </span>
    ),
    sortingFn: (rowA, rowB) => rowA.original.sizeBytes - rowB.original.sizeBytes,
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") column.toggleSorting(column.getIsSorted() === "asc")
        }}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        <span>Type</span>
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="opacity-80" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="opacity-80" />
        ) : (
          <IconArrowsSort size={14} className="opacity-50" />
        )}
      </div>
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string
      const displayType = getFileTypeLabel(type)
      return (
        <span className="text-muted-foreground">
          {displayType}
        </span>
      )
    },
  },
  {
    accessorKey: "lines",
    header: ({ column }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") column.toggleSorting(column.getIsSorted() === "asc")
        }}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        <span>Lines</span>
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="opacity-80" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="opacity-80" />
        ) : (
          <IconArrowsSort size={14} className="opacity-50" />
        )}
      </div>
    ),
    cell: ({ row }) => {
      const lines = row.getValue("lines") as number | null
      return (
        <span className="text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
          {lines !== null ? formatCompactNumber(lines) : "-"}
        </span>
      )
    },
  },
  {
    accessorKey: "modified",
    header: ({ column }) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") column.toggleSorting(column.getIsSorted() === "asc")
        }}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        <span>Modified</span>
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="opacity-80" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="opacity-80" />
        ) : (
          <IconArrowsSort size={14} className="opacity-50" />
        )}
      </div>
    ),
    cell: ({ row }) => {
      const modifiedDate = row.getValue("modified") as string
      return (
        <span className="text-muted-foreground font-[family-name:var(--font-jetbrains-mono)] text-sm">
          {formatDate(modifiedDate)}
        </span>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const fileName = row.getValue("name") as string
      const file = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <IconDotsVertical size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleDownload(fileName)}>
              <IconDownload size={14} className="mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRenameClick(fileName)}>
              <IconPencil size={14} className="mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={() => handleDeleteClick(file)}
            >
              <IconTrash size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatCompactNumber(value: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value)
}

function getFileTypeLabel(type: string): string {
  if (type === "urls") return "Vuln"
  if (type === "data") return "Data"
  if (type === "dorks") return "Dorks"
  if (type === "keywords") return "Keywords"
  if (type === "parameter" || type === "parameters") return "Parameter"
  if (type === "results" || type === "zip" || type === "storage") return "Results"
  return "Results"
}

function formatStorageSize(bytes: number): string {
  // 验证输入（防止负数或 NaN）
  const safeBytes = Math.max(0, Number(bytes) || 0)
  const gb = safeBytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // 如果是今天，显示时间
    if (diffDays === 0) {
      if (diffMins < 1) {
        return 'Just now'
      } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
      } else {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
      }
    }

    // 如果是昨天
    if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    }

    // 如果是一周内
    if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    }

    // 超过一周，显示完整日期
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const validateSelectedFile = (file: File): boolean => {
    const fileName = file.name || ""
    const isTxt = fileName.toLowerCase().endsWith(ALLOWED_EXTENSION)
    if (!isTxt) {
      toast.error("Only .txt files are allowed.")
      return false
    }
    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (validateSelectedFile(file)) {
        setSelectedFile(file)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (validateSelectedFile(file)) {
        setSelectedFile(file)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    if (!validateSelectedFile(selectedFile)) return

    // 检查是否可以上传
    const uploadCheck = canUpload()
    if (!uploadCheck.allowed) {
      toast.error(uploadCheck.reason || 'Upload not allowed')
      return
    }

    // 检查文件大小是否会超过配额
    const fileSize = selectedFile.size
    if (storageUsed + fileSize > storageMax) {
      toast.error('File size exceeds available storage quota')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', fileType)

      console.log('Uploading file:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: fileType,
      })

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const rawBody = await response.text().catch(() => "")
        let errData: unknown = null
        if (rawBody) {
          try {
            errData = JSON.parse(rawBody)
          } catch {
            errData = null
          }
        }
        const parsed = errData as { message?: unknown; error?: unknown } | null
        const apiMessage =
          typeof parsed?.message === "string"
            ? parsed.message
            : typeof parsed?.error === "string"
              ? parsed.error
              : null
        throw new Error(
          apiMessage ||
            getHttpErrorMessage(response.status, "Failed to upload file", {
              forbiddenMessage: "Upload is blocked by plan or storage quota",
            }) ||
            `Upload failed (HTTP ${response.status})`
        )
      }

      const data = await response.json()
      console.log('Upload success:', data)

      const linesText =
        typeof data.lines === "number" ? `${formatCompactNumber(data.lines)} lines` : "no line scan"
      toast.success(`Uploaded successfully (${linesText})`)
      
      setTimeout(() => {
        setSelectedFile(null)
        setShowUploadDialog(false)
        void fetchFiles({ silent: true })
      }, 250)
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleCloseUploadDialog = () => {
    if (!isUploading) {
      setShowUploadDialog(false)
      setSelectedFile(null)
      setFileType("data") // 重置 type
    }
  }

  const filteredData = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return filesData.filter((f) => {
      const typeOk = typeFilter === "all" ? true : f.type === typeFilter
      const queryOk = q.length === 0 ? true : f.name.toLowerCase().includes(q)
      return typeOk && queryOk
    })
  }, [filesData, query, typeFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      pagination,
      sorting,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  })

  // 计算使用百分比，确保值在 0-100 之间
  const usagePercent = storageMax > 0 
    ? Math.min(100, Math.max(0, (storageUsed / storageMax) * 100))
    : 0

  const remainingBytes = Math.max(0, storageMax - storageUsed)

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 p-6 font-[family-name:var(--font-inter)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Files</h1>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
              <span>{formatStorageSize(storageUsed)}</span>
              <span>/</span>
              <span>{formatStorageSize(storageMax)}</span>
              <span className="text-muted-foreground/70">({formatStorageSize(remainingBytes)} left)</span>
            </div>
          </div>
          <div className="max-w-[520px]">
            <Progress value={usagePercent} className="h-1.5" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              const check = canUpload()
              if (!check.allowed) {
                toast.error(check.reason || 'Upload not allowed')
                return
              }
              setShowUploadDialog(true)
            }}
            variant={canUpload().allowed ? "default" : "outline"}
            disabled={!canUpload().allowed}
            className="motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out hover:-translate-y-[1px] active:translate-y-0"
          >
            <IconUpload size={16} className="mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="max-w-[420px]"
          />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "urls" | "data" | "dorks" | "keywords" | "parameter" | "parameters" | "results")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="data">Data</SelectItem>
              <SelectItem value="urls">Vuln</SelectItem>
              <SelectItem value="dorks">Dorks</SelectItem>
              <SelectItem value="keywords">Keywords</SelectItem>
              <SelectItem value="parameter">Parameter</SelectItem>
              <SelectItem value="results">Results</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden md:block text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            {filteredData.length} file{filteredData.length === 1 ? "" : "s"}
          </div>
        </div>

        {table.getSelectedRowModel().rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium">{table.getSelectedRowModel().rows.length}</span>{" "}
              <span className="text-muted-foreground">selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRowSelection({})}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBatchDeleteDialog(true)}>
                <IconTrash size={16} className="mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Files Table */}
      <div className="mt-4 border-y">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 text-xs font-medium text-muted-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[420px]"
                >
                  <div className="flex flex-col items-center justify-center text-center py-12">
                    {/* Icon */}
                    <div className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 mb-4">
                      <IconFile className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>

                    {/* Text */}
                    <h3 className="text-lg font-semibold tracking-tight mb-2">
                      No files uploaded
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-[420px]">
                      Upload your first file to get started
                    </p>

                    {/* Action */}
                    {canUpload().allowed ? (
                      <Button 
                        onClick={() => setShowUploadDialog(true)}
                        size="sm"
                        className="motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out hover:-translate-y-[1px] active:translate-y-0"
                      >
                        <IconUpload size={16} className="mr-2" />
                        Upload File
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                        <IconShield size={16} />
                        <span>{canUpload().reason || 'Upgrade to upload files'}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page{" "}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-foreground">
            {table.getState().pagination.pageIndex + 1}
          </span>{" "}
          of{" "}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-foreground">
            {table.getPageCount()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronRight className="size-3" />
          </Button>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={handleCloseUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload a .txt file to your storage
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileSelect}
            />

            {!selectedFile ? (
              <>
                {/* File Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">File type</Label>
                  <Select value={fileType} onValueChange={(v) => setFileType(v as "urls" | "data" | "dorks" | "keywords" | "parameter")} disabled={isUploading}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="urls">Vuln</SelectItem>
                      <SelectItem value="dorks">Dorks</SelectItem>
                      <SelectItem value="keywords">Keywords</SelectItem>
                      <SelectItem value="parameter">Parameter</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use <span className="font-medium text-foreground">Vuln</span> for target lists (line-limited), and other types without line limits.
                  </p>
                </div>

                {/* Drop zone */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Choose File</Label>
                  <div
                    className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-primary bg-accent"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex size-12 items-center justify-center rounded-full border border-dashed">
                      <IconUpload className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {isDragging ? "Drop file here" : "Choose file or drag & drop"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        .txt files only
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Selected file */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected File</Label>
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-background">
                      <IconFile size={20} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)} • {getFileTypeLabel(fileType)}
                      </p>
                    </div>
                    {!isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                        }}
                      >
                        <IconX size={16} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Upload progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Uploading</span>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <IconLoader2 size={16} className="animate-spin" />
                        Working...
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 w-1/2 rounded-full bg-foreground/15" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Warning message */}
            {!canUpload().allowed && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm dark:border-yellow-900 dark:bg-yellow-900/20">
                <IconShield size={16} className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-500" />
                <p className="text-yellow-800 dark:text-yellow-200">
                  {canUpload().reason}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCloseUploadDialog}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || !canUpload().allowed}
            >
              {isUploading ? (
                <>
                  <IconLoader2 size={16} className="mr-2 animate-spin" />
                  Uploading
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPencil size={20} />
              Rename File
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="old-name">Current Name</Label>
                <Input
                  id="old-name"
                  value={renameOldName}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-name">New Name</Label>
                <Input
                  id="new-name"
                  value={renameNewName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameNewName(e.target.value)}
                  placeholder="Enter new file name"
                  className="mt-1"
                  disabled={isRenaming}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !isRenaming) {
                      handleRename()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  File must end with .txt extension
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !renameNewName.trim() || renameNewName === renameOldName}
            >
              {isRenaming ? (
                <>
                  <IconLoader2 size={16} className="mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                <>
                  <IconPencil size={16} className="mr-2" />
                  Rename
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">&quot;{fileToDelete?.name}&quot;</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <IconLoader2 size={16} className="mr-2 animate-spin" />
                  Deleting
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {table.getSelectedRowModel().rows.length} files</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to delete these files? This action cannot be undone.</p>
                {table.getSelectedRowModel().rows.length <= 5 ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {table.getSelectedRowModel().rows.map((row) => (
                      <li key={row.id} className="font-medium text-foreground">
                        • {row.getValue("name")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 space-y-1 text-sm">
                    {table.getSelectedRowModel().rows.slice(0, 3).map((row) => (
                      <div key={row.id} className="font-medium text-foreground">
                        • {row.getValue("name")}
                      </div>
                    ))}
                    <div className="text-muted-foreground">
                      and {table.getSelectedRowModel().rows.length - 3} more...
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBatchDeleting ? (
                <>
                  <IconLoader2 size={16} className="mr-2 animate-spin" />
                  Deleting
                </>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
