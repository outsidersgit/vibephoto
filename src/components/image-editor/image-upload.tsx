'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void
  multiple?: boolean
  maxFiles?: number
  className?: string
  accept?: string
}

export function ImageUpload({ 
  onImagesChange, 
  multiple = false, 
  maxFiles = 5,
  className = '',
  accept = 'image/*'
}: ImageUploadProps) {
  const [images, setImages] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles)
    const validFiles = filesArray.filter(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.warn(`Invalid file type: ${file.type}`)
        return false
      }
      
      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        console.warn(`File too large: ${file.size} bytes`)
        return false
      }
      
      return true
    })

    let updatedImages: File[]
    if (multiple) {
      updatedImages = [...images, ...validFiles].slice(0, maxFiles)
    } else {
      updatedImages = validFiles.slice(0, 1)
    }

    setImages(updatedImages)
    onImagesChange(updatedImages)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index)
    setImages(updatedImages)
    onImagesChange(updatedImages)
  }

  const openFileDialog = () => {
    inputRef.current?.click()
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${images.length > 0 && !multiple ? 'opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <Upload className="w-full h-full" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {multiple ? 'Upload images' : 'Upload an image'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: JPEG, PNG, WebP, GIF (max 10MB each)
              {multiple && ` • Max ${maxFiles} files`}
            </p>
          </div>
        </div>
      </div>

      {/* Preview Images */}
      {images.length > 0 && (
        <div className={`grid gap-4 ${multiple ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
          {images.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* File Info */}
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              
              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeImage(index)
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Status */}
      {multiple && images.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          {images.length} of {maxFiles} images selected
        </div>
      )}
    </div>
  )
}