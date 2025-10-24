import { MediaItem, Generation } from '@/types'

/**
 * Converts legacy generation data to MediaItem format
 */
export function generationToMediaItems(generations: any[]): MediaItem[] {
  const mediaItems: MediaItem[] = []

  generations.forEach(generation => {
    if (generation.status === 'COMPLETED' && generation.imageUrls) {
      generation.imageUrls.forEach((imageUrl: string, index: number) => {
        const mediaItem: MediaItem = {
          id: `${generation.id}-img-${index}`,
          url: imageUrl,
          thumbnailUrl: generation.thumbnailUrls?.[index] || imageUrl,
          operationType: 'generated', // Default for legacy data
          status: generation.status,
          metadata: {
            width: generation.width,
            height: generation.height,
            format: 'jpg' // Default assumption
          },
          generation: generation
        }
        mediaItems.push(mediaItem)
      })
    }
  })

  return mediaItems
}

/**
 * Converts edit history data to MediaItem format
 */
export function editHistoryToMediaItems(editHistory: any[]): MediaItem[] {
  return editHistory.map(edit => ({
    id: edit.id,
    url: edit.editedImageUrl,
    originalUrl: edit.originalImageUrl,
    thumbnailUrl: edit.thumbnailUrl || edit.editedImageUrl,
    operationType: 'edited' as const,
    status: 'COMPLETED' as const,
    metadata: edit.metadata || {},
    generation: undefined // Edit history doesn't have generation data
  }))
}

/**
 * Converts upscale results to MediaItem format
 */
export function upscaleToMediaItems(upscales: any[]): MediaItem[] {
  return upscales.map(upscale => ({
    id: upscale.id,
    url: upscale.upscaledImageUrl,
    originalUrl: upscale.originalImageUrl,
    thumbnailUrl: upscale.thumbnailUrl || upscale.upscaledImageUrl,
    operationType: 'upscaled' as const,
    status: upscale.status || 'COMPLETED',
    metadata: {
      width: upscale.outputWidth,
      height: upscale.outputHeight,
      format: 'jpg'
    },
    generation: upscale.sourceGeneration
  }))
}

/**
 * Converts video generation data to MediaItem format
 */
export function videoToMediaItems(videos: any[]): MediaItem[] {
  return videos.map(video => ({
    id: video.id,
    url: video.videoUrl,
    originalUrl: video.sourceImageUrl,
    thumbnailUrl: video.thumbnailUrl || video.posterUrl,
    operationType: 'video' as const,
    status: video.status,
    metadata: {
      duration: video.durationSec,
      format: 'mp4',
      sizeBytes: video.sizeBytes
    },
    generation: video.sourceGeneration
  }))
}

/**
 * Combines all media types into a single array for gallery display
 */
export function combineAllMediaItems(data: {
  generations?: any[]
  editHistory?: any[]
  upscales?: any[]
  videos?: any[]
}): MediaItem[] {
  const allItems: MediaItem[] = []

  if (data.generations) {
    allItems.push(...generationToMediaItems(data.generations))
  }

  if (data.editHistory) {
    allItems.push(...editHistoryToMediaItems(data.editHistory))
  }

  if (data.upscales) {
    allItems.push(...upscaleToMediaItems(data.upscales))
  }

  if (data.videos) {
    allItems.push(...videoToMediaItems(data.videos))
  }

  // Sort by creation date (newest first)
  return allItems.sort((a, b) => {
    const dateA = a.generation?.createdAt || new Date().toISOString()
    const dateB = b.generation?.createdAt || new Date().toISOString()
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })
}