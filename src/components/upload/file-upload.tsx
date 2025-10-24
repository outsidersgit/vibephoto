'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  X, 
  File, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadedFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress: number
  url?: string
  error?: string
  thumbnailUrl?: string
}

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number // in bytes
  uploadType: 'face' | 'body' | 'generated'
  modelId?: string
  onUploadComplete?: (files: UploadedFile[]) => void
  onUploadError?: (error: string) => void
  disabled?: boolean
  className?: string
}

export function FileUpload({
  accept = 'image/*',
  multiple = true,
  maxFiles = 20,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  uploadType,
  modelId,
  onUploadComplete,
  onUploadError,
  disabled = false,
  className
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File "${file.name}" is too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return `File "${file.name}" is not an image`
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return `File "${file.name}" type is not supported. Allowed types: JPEG, PNG, WebP`
    }

    return null
  }

  const generateFileId = () => {
    return Date.now().toString() + Math.random().toString(36).substring(2)
  }

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const currentFileCount = files.length
    
    // Check total file limit
    if (currentFileCount + fileArray.length > maxFiles) {
      onUploadError?.(`Cannot add ${fileArray.length} files. Maximum ${maxFiles} files allowed.`)
      return
    }

    const validFiles: UploadedFile[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        errors.push(error)
        continue
      }

      validFiles.push({
        file,
        id: generateFileId(),
        status: 'pending',
        progress: 0
      })
    }

    if (errors.length > 0) {
      onUploadError?.(errors.join(', '))
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }, [files.length, maxFiles, maxFileSize, onUploadError])

  const uploadFile = async (uploadedFile: UploadedFile): Promise<void> => {
    const formData = new FormData()
    formData.append('file', uploadedFile.file)
    formData.append('type', uploadType)
    formData.append('generateThumbnail', 'true')
    if (modelId) {
      formData.append('modelId', modelId)
    }

    // Update status to uploading
    setFiles(prev => 
      prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, status: 'uploading' as const, progress: 0 }
          : f
      )
    )

    try {
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setFiles(prev => 
              prev.map(f => 
                f.id === uploadedFile.id 
                  ? { ...f, progress }
                  : f
              )
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText)
              if (response.success) {
                setFiles(prev => 
                  prev.map(f => 
                    f.id === uploadedFile.id 
                      ? { 
                          ...f, 
                          status: 'completed' as const, 
                          progress: 100,
                          url: response.data.url,
                          thumbnailUrl: response.data.thumbnailUrl
                        }
                      : f
                  )
                )
                resolve()
              } else {
                throw new Error(response.error || 'Upload failed')
              }
            } catch (e) {
              reject(new Error('Invalid response from server'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setFiles(prev => 
        prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: 'error' as const, error: errorMessage }
            : f
        )
      )
      throw error
    }
  }

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return

    setIsUploading(true)

    try {
      await Promise.all(pendingFiles.map(uploadFile))
      onUploadComplete?.(files.filter(f => f.status === 'completed'))
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const clearAll = () => {
    setFiles([])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (disabled || isUploading) return
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <File className="w-4 h-4 text-gray-500" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const completedFiles = files.filter(f => f.status === 'completed')
  const pendingFiles = files.filter(f => f.status === 'pending')
  const errorFiles = files.filter(f => f.status === 'error')

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-gray-600" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              Drop files here or click to select
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Support for {accept === 'image/*' ? 'images' : 'files'} up to {Math.round(maxFileSize / 1024 / 1024)}MB
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Maximum {maxFiles} files
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              Files ({files.length})
            </h3>
            <div className="flex space-x-2">
              {pendingFiles.length > 0 && (
                <Button
                  size="sm"
                  onClick={uploadAllFiles}
                  disabled={isUploading || disabled}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload All
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isUploading}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.status)}
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {file.file.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {file.status === 'error' && file.error && (
                      <span className="text-xs text-red-500">
                        {file.error}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <Progress value={file.progress} className="mt-2 h-1" />
                  )}
                </div>

                {/* Preview */}
                {file.url && (
                  <div className="flex-shrink-0">
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded"
                    />
                  </div>
                )}

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  disabled={file.status === 'uploading'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Summary */}
          {(completedFiles.length > 0 || errorFiles.length > 0) && (
            <div className="text-sm text-gray-600">
              {completedFiles.length > 0 && (
                <span className="text-green-600">
                  {completedFiles.length} uploaded successfully
                </span>
              )}
              {completedFiles.length > 0 && errorFiles.length > 0 && ', '}
              {errorFiles.length > 0 && (
                <span className="text-red-600">
                  {errorFiles.length} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}