'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleUploadedFile {
  file: File
  id: string
  status: 'uploading' | 'completed' | 'error'
  progress: number
  url?: string
  error?: string
}

interface SimpleUploadProps {
  onUploadComplete: (url: string, file: File) => void
  onUploadError?: (error: string) => void
  uploadType: 'face' | 'body' | 'generated'
  modelId?: string
  className?: string
  children?: React.ReactNode
}

export function SimpleUpload({
  onUploadComplete,
  onUploadError,
  uploadType,
  modelId,
  className,
  children
}: SimpleUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<SimpleUploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return `File is too large. Maximum size is 10MB`
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return `File must be an image`
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return `File type not supported. Use JPEG, PNG, or WebP`
    }

    return null
  }

  const uploadFile = async (file: File): Promise<void> => {
    const fileId = Date.now().toString() + Math.random().toString(36).substring(2)
    
    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      onUploadError?.(validationError)
      return
    }

    // Add to uploading files
    const uploadedFile: SimpleUploadedFile = {
      file,
      id: fileId,
      status: 'uploading',
      progress: 0
    }

    setUploadingFiles(prev => [...prev, uploadedFile])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', uploadType)
      formData.append('generateThumbnail', 'true')
      if (modelId) {
        formData.append('modelId', modelId)
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setUploadingFiles(prev => 
              prev.map(f => 
                f.id === fileId 
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
                // Update status to completed
                setUploadingFiles(prev => 
                  prev.map(f => 
                    f.id === fileId 
                      ? { 
                          ...f, 
                          status: 'completed' as const, 
                          progress: 100,
                          url: response.data.url
                        }
                      : f
                  )
                )

                // Call completion callback
                onUploadComplete(response.data.url, file)

                // Remove from uploading list after a short delay
                setTimeout(() => {
                  setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
                }, 2000)

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
      
      // Update status to error
      setUploadingFiles(prev => 
        prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error' as const, error: errorMessage }
            : f
        )
      )

      onUploadError?.(errorMessage)

      // Remove from uploading list after delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
      }, 5000)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await uploadFile(file)
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {children ? (
        <div onClick={triggerFileSelect}>
          {children}
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={triggerFileSelect}
          disabled={uploadingFiles.length > 0}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Images
        </Button>
      )}

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0">
                {file.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                )}
                {file.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {file.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {file.file.name}
                </div>
                
                {file.status === 'uploading' && (
                  <Progress value={file.progress} className="mt-1 h-1" />
                )}
                
                {file.status === 'error' && file.error && (
                  <div className="text-xs text-red-600 mt-1">
                    {file.error}
                  </div>
                )}
                
                {file.status === 'completed' && (
                  <div className="text-xs text-green-600 mt-1">
                    Upload completed
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                {(file.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}