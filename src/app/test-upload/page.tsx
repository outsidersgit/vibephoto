'use client'

import { FileUpload } from '@/components/upload/file-upload'
import { SimpleUpload } from '@/components/upload/simple-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

export default function TestUploadPage() {
  const [uploads, setUploads] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleUploadComplete = (url: string) => {
    setUploads(prev => [...prev, url])
    setError(null)
  }

  const handleUploadError = (error: string) => {
    setError(error)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Upload System Test
          </h1>
          <p className="text-gray-600">
            Test the file upload functionality with different storage providers
          </p>
        </div>

        <div className="grid gap-6">
          {/* Simple Upload Test */}
          <Card>
            <CardHeader>
              <CardTitle>Simple Upload Component</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleUpload
                uploadType="face"
                onUploadComplete={(url, file) => {
                  handleUploadComplete(url)
                  console.log('Upload completed:', { url, fileName: file.name })
                }}
                onUploadError={handleUploadError}
              />
            </CardContent>
          </Card>

          {/* Advanced Upload Test */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Upload Component</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                uploadType="body"
                maxFiles={5}
                onUploadComplete={(files) => {
                  const urls = files.map(f => f.url!).filter(Boolean)
                  setUploads(prev => [...prev, ...urls])
                  console.log('Batch upload completed:', files)
                }}
                onUploadError={handleUploadError}
              />
            </CardContent>
          </Card>

          {/* Upload Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Upload Results
                <Badge variant="secondary">
                  {uploads.length} uploads
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {uploads.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No uploads yet. Try uploading some images above.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {uploads.map((url, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback for broken images
                          const target = e.target as HTMLImageElement
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkM4LjY4NjI5IDE2IDYgMTMuMzEzNyA2IDEwQzYgNi42ODYyOSA4LjY4NjI5IDQgMTIgNEMxNS4zMTM3IDQgMTggNi42ODYyOSAxOCAxMEMxOCAxMy4zMTM3IDE1LjMxMzcgMTYgMTIgMTZaIiBzdHJva2U9IiM5Q0E0QUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {uploads.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                  <p>Upload URLs:</p>
                  <ul className="mt-2 space-y-1">
                    {uploads.map((url, index) => (
                      <li key={index} className="font-mono text-xs break-all">
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Info */}
          <Card>
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Storage Provider:</span>
                  <Badge variant="outline">
                    {process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'local'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max File Size:</span>
                  <span>10 MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Allowed Types:</span>
                  <span>JPEG, PNG, WebP</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}