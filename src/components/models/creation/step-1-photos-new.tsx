'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SimpleUpload } from '@/components/upload/simple-upload'
import { FileUpload } from '@/components/upload/file-upload'
import { Upload, X, User, Users, Heart, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react'

interface UploadedPhoto {
  url: string
  file: File
  id: string
}

interface ModelCreationStep1Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: UploadedPhoto[]
  }
  setModelData: (data: any) => void
}

export function ModelCreationStep1({ modelData, setModelData }: ModelCreationStep1Props) {
  const [uploadError, setUploadError] = useState<string | null>(null)

  const classOptions = [
    { value: 'MAN', label: 'Man', icon: User, description: 'Adult male person' },
    { value: 'WOMAN', label: 'Woman', icon: User, description: 'Adult female person' },
    { value: 'BOY', label: 'Boy', icon: Users, description: 'Young male person' },
    { value: 'GIRL', label: 'Girl', icon: Users, description: 'Young female person' },
    { value: 'ANIMAL', label: 'Animal', icon: Heart, description: 'Pet or animal' }
  ]

  const handleClassChange = (selectedClass: string) => {
    setModelData({
      ...modelData,
      class: selectedClass as 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    })
  }

  const handleUploadComplete = (url: string, file: File) => {
    const newPhoto: UploadedPhoto = {
      url,
      file,
      id: Date.now().toString() + Math.random().toString(36).substring(2)
    }

    setModelData({
      ...modelData,
      facePhotos: [...modelData.facePhotos, newPhoto]
    })

    setUploadError(null)
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
  }

  const removePhoto = (photoId: string) => {
    setModelData({
      ...modelData,
      facePhotos: modelData.facePhotos.filter(photo => photo.id !== photoId)
    })
  }

  const getQualityScore = (): number => {
    // Simple quality scoring based on number of photos
    const photoCount = modelData.facePhotos.length
    if (photoCount >= 15) return 95
    if (photoCount >= 10) return 85
    if (photoCount >= 7) return 75
    if (photoCount >= 5) return 65
    if (photoCount >= 3) return 50
    return 30
  }

  const getQualityColor = (score: number): string => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getQualityLabel = (score: number): string => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Very Good'
    if (score >= 70) return 'Good'
    if (score >= 60) return 'Fair'
    if (score >= 50) return 'Poor'
    return 'Very Poor'
  }

  const qualityScore = getQualityScore()
  const isValid = modelData.facePhotos.length >= 3

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Face Photos</h2>
        <p className="text-gray-600">
          Upload high-quality face photos for training. More photos = better results.
        </p>
      </div>

      {/* Model Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Model Type
          </CardTitle>
          <CardDescription>
            Select the type of model you want to create
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {classOptions.map((option) => {
              const Icon = option.icon
              const isSelected = modelData.class === option.value
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleClassChange(option.value)}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Photo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ImageIcon className="w-5 h-5 mr-2" />
              Face Photos ({modelData.facePhotos.length})
            </div>
            <Badge 
              variant="secondary" 
              className={getQualityColor(qualityScore)}
            >
              Quality: {getQualityLabel(qualityScore)} ({qualityScore}%)
            </Badge>
          </CardTitle>
          <CardDescription>
            Upload 3-20 clear face photos. Avoid sunglasses, heavy makeup, or blurred images.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Error */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* File Upload Component */}
          <FileUpload
            uploadType="face"
            maxFiles={20}
            onUploadComplete={(files) => {
              // Handle batch upload completion
              const newPhotos = files.map(f => ({
                url: f.url!,
                file: f.file,
                id: f.id
              }))
              setModelData({
                ...modelData,
                facePhotos: [...modelData.facePhotos, ...newPhotos]
              })
            }}
            onUploadError={handleUploadError}
          />

          {/* Uploaded Photos Grid */}
          {modelData.facePhotos.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Uploaded Photos ({modelData.facePhotos.length})
              </h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {modelData.facePhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={photo.url}
                        alt="Face photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Remove button */}
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Photo Requirements</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                Clear, well-lit face photos
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                Different angles and expressions
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                Minimum 3 photos, optimal 10-15
              </li>
              <li className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-blue-600" />
                Avoid sunglasses or face coverings
              </li>
            </ul>
          </div>

          {/* Quality Tips */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Tips for Better Results</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <div className="font-medium text-green-600 mb-1">✓ Good Photos</div>
                <ul className="space-y-1">
                  <li>• High resolution (1024px+)</li>
                  <li>• Natural lighting</li>
                  <li>• Direct face view</li>
                  <li>• Clear features</li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-red-600 mb-1">✗ Avoid</div>
                <ul className="space-y-1">
                  <li>• Blurry or pixelated</li>
                  <li>• Heavy shadows</li>
                  <li>• Multiple people</li>
                  <li>• Extreme angles</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Validation Status */}
          <div className={`p-4 rounded-lg ${
            isValid ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'
          }`}>
            <div className="flex items-center">
              {isValid ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600 mr-2" />
              )}
              <div>
                <div className={`font-medium ${
                  isValid ? 'text-green-900' : 'text-orange-900'
                }`}>
                  {isValid ? 'Ready to proceed' : 'More photos needed'}
                </div>
                <div className={`text-sm ${
                  isValid ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {isValid 
                    ? `You have ${modelData.facePhotos.length} photos. You can continue to the next step.`
                    : `Upload at least ${3 - modelData.facePhotos.length} more photo${3 - modelData.facePhotos.length === 1 ? '' : 's'} to continue.`
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}