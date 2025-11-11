'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Heart, Eye, MoreHorizontal, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface ResultsGalleryProps {
  generations: Array<{
    id: string
    prompt: string
    status: string
    imageUrls: string[]
    thumbnailUrls: string[]
    createdAt: string
    processingTime?: number
  }>
}

export function ResultsGallery({ generations }: ResultsGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDownload = (imageUrl: string, prompt: string) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `generated-${prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Eye className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 mb-2">No generations yet</p>
        <p className="text-sm text-gray-500">
          Your generated photos will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {generations.map((generation) => (
        <Card key={generation.id} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Generation Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {generation.prompt}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  {getStatusIcon(generation.status)}
                  <Badge variant="secondary" className={getStatusColor(generation.status)}>
                    {generation.status}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(generation.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>

            {/* Images Grid */}
            {generation.status === 'COMPLETED' && generation.imageUrls && generation.imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {generation.imageUrls.slice(0, 4).map((imageUrl, index) => {
                  // Validar que imageUrl existe antes de renderizar
                  if (!imageUrl) return null
                  
                  // Usar thumbnailUrls se disponível, senão usar imageUrl
                  const thumbnailUrl = (generation.thumbnailUrls && generation.thumbnailUrls[index]) 
                    ? generation.thumbnailUrls[index] 
                    : imageUrl

                  return (
                  <div
                    key={`${generation.id}-img-${index}`}
                    className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedImage(imageUrl)}
                  >
                    <img
                      src={thumbnailUrl}
                      alt={`Generated image ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(imageUrl, generation.prompt)
                            }}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : generation.status === 'PROCESSING' ? (
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <div className="text-center">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-gray-600">Generating...</p>
                  <p className="text-xs text-gray-500">~30 seconds remaining</p>
                </div>
              </div>
            ) : generation.status === 'FAILED' ? (
              <div className="aspect-square bg-red-50 border border-red-200 rounded-lg flex items-center justify-center mb-3">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600">Generation Failed</p>
                  <p className="text-xs text-red-500">Try again with different settings</p>
                </div>
              </div>
            ) : null}

            {/* Actions */}
            {generation.status === 'COMPLETED' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button size="sm" variant="outline">
                    <Heart className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/gallery?generation=${generation.id}`}>
                      <Eye className="w-4 h-4 mr-1" />
                      View All
                    </Link>
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500">
                  {generation.imageUrls.length} image{generation.imageUrls.length !== 1 ? 's' : ''}
                  {generation.processingTime && (
                    <> • {(generation.processingTime / 1000).toFixed(1)}s</>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* View All Button */}
      {generations.length > 3 && (
        <Button variant="outline" asChild className="w-full">
          <Link href="/gallery">
            View All Generations
          </Link>
        </Button>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Generated image"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

    </div>
  )
}