'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, AlertCircle, CheckCircle, User, Users, Shield, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ModelCreationStep2Props {
  modelData: {
    halfBodyPhotos: File[]
    fullBodyPhotos: File[]
  }
  setModelData: (data: any) => void
}

export function ModelCreationStep2({ modelData, setModelData }: ModelCreationStep2Props) {
  const [activeUpload, setActiveUpload] = useState<'half' | 'full' | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const validateFile = (file: File): string[] => {
    const errors: string[] = []
    
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image')
    }
    
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB')
    }
    
    return errors
  }

  const validateImage = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        const errors: string[] = []
        
        if (img.width < 256 || img.height < 256) {
          errors.push('Image must be at least 256x256 pixels')
        }
        
        URL.revokeObjectURL(url)
        resolve(errors)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(['Invalid image file'])
      }
      
      img.src = url
    })
  }

  const handleFileSelect = async (files: FileList, type: 'half' | 'full') => {
    const newFiles: File[] = []
    const errors: string[] = []
    const maxFiles = type === 'half' ? 10 : 15
    const currentCount = type === 'half' ? modelData.halfBodyPhotos.length : modelData.fullBodyPhotos.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      const fileErrors = validateFile(file)
      if (fileErrors.length > 0) {
        errors.push(`${file.name}: ${fileErrors.join(', ')}`)
        continue
      }
      
      const imageErrors = await validateImage(file)
      if (imageErrors.length > 0) {
        errors.push(`${file.name}: ${imageErrors.join(', ')}`)
        continue
      }
      
      newFiles.push(file)
    }

    const totalFiles = currentCount + newFiles.length
    if (totalFiles > maxFiles) {
      errors.push(`Maximum ${maxFiles} ${type === 'half' ? 'half body' : 'full body'} photos allowed (you selected ${totalFiles})`)
      setValidationErrors(errors)
      return
    }

    setValidationErrors(errors)
    
    if (newFiles.length > 0) {
      const key = type === 'half' ? 'halfBodyPhotos' : 'fullBodyPhotos'
      setModelData({
        ...modelData,
        [key]: [...modelData[key], ...newFiles]
      })
    }
  }

  const removePhoto = (index: number, type: 'half' | 'full') => {
    const key = type === 'half' ? 'halfBodyPhotos' : 'fullBodyPhotos'
    const newPhotos = modelData[key].filter((_, i) => i !== index)
    setModelData({
      ...modelData,
      [key]: newPhotos
    })
  }

  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file)
  }

  const PhotoUploadSection = ({ 
    type, 
    title, 
    description, 
    photos, 
    minCount, 
    maxCount 
  }: {
    type: 'half' | 'full'
    title: string
    description: string
    photos: File[]
    minCount: number
    maxCount: number
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <Badge variant={photos.length >= minCount ? 'default' : 'secondary'}>
            {photos.length}/{maxCount} photos
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            activeUpload === type 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={(e) => {
            e.preventDefault()
            setActiveUpload(null)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileSelect(e.dataTransfer.files, type)
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setActiveUpload(type)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setActiveUpload(null)
          }}
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <div className="space-y-2">
            <p className="font-medium text-gray-900">
              Drop {title.toLowerCase()} here, or{' '}
              <label className="text-purple-600 cursor-pointer hover:underline">
                browse files
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files, type)}
                />
              </label>
            </p>
            <p className="text-sm text-gray-500">
              PNG, JPG, WebP up to 10MB each
            </p>
          </div>
        </div>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={getImagePreview(file)}
                    alt={`${title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => removePhoto(index, type)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(file.size / 1024)}KB
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Requirements */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            {photos.length >= minCount ? (
              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            ) : (
              <div className="w-4 h-4 border border-gray-300 rounded-full mr-2" />
            )}
            <span className={`text-sm ${photos.length >= minCount ? 'text-green-700' : 'text-blue-800'}`}>
              At least {minCount} {title.toLowerCase()} required (you have {photos.length})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">

      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900">Body Photos Upload</h3>
              <p className="text-purple-700 text-sm">
                Upload photos showing different poses and outfits
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-900">
                {modelData.halfBodyPhotos.length + modelData.fullBodyPhotos.length}
              </div>
              <div className="text-sm text-purple-700">photos uploaded</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Upload Issues</h4>
              <ul className="text-sm text-red-700 mt-1 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Half Body Photos */}
      <PhotoUploadSection
        type="half"
        title="Half Body Photos"
        description="5-10 photos from waist up showing different poses, expressions, and clothing"
        photos={modelData.halfBodyPhotos}
        minCount={5}
        maxCount={10}
      />

      {/* Full Body Photos */}
      <PhotoUploadSection
        type="full"
        title="Full Body Photos"
        description="10-15 full body photos showing complete outfits and different poses"
        photos={modelData.fullBodyPhotos}
        minCount={10}
        maxCount={15}
      />

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Photo Guidelines</CardTitle>
          <CardDescription>
            Tips for the best training results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-700 mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Half Body Photos
              </h4>
              <div className="space-y-2 text-sm text-green-700">
                <p>✓ Show from waist/hips up</p>
                <p>✓ Include arms and hands when possible</p>
                <p>✓ Various clothing styles</p>
                <p>✓ Different poses and gestures</p>
                <p>✓ Both front and side angles</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Full Body Photos
              </h4>
              <div className="space-y-2 text-sm text-blue-700">
                <p>✓ Complete body visible</p>
                <p>✓ Standing and sitting poses</p>
                <p>✓ Different outfits and styles</p>
                <p>✓ Various backgrounds</p>
                <p>✓ Natural, relaxed postures</p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Important Notes</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• Ensure the same person appears in all photos</p>
              <p>• Use good lighting and avoid heavy shadows</p>
              <p>• Include variety in clothing, poses, and settings</p>
              <p>• Avoid group photos or photos with other people</p>
              <p>• Higher quality photos lead to better AI results</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Half Body Photos</span>
              <span className="text-sm text-gray-600">
                {modelData.halfBodyPhotos.length}/10
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((modelData.halfBodyPhotos.length / 10) * 100, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Full Body Photos</span>
              <span className="text-sm text-gray-600">
                {modelData.fullBodyPhotos.length}/15
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((modelData.fullBodyPhotos.length / 15) * 100, 100)}%` }}
              />
            </div>

            {modelData.halfBodyPhotos.length >= 5 && modelData.fullBodyPhotos.length >= 10 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-sm text-green-700 font-medium">
                    Minimum requirements met! You can proceed to the next step.
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}