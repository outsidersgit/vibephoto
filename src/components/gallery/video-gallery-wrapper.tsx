'use client'

import { VideoGallery } from './video-gallery'

interface VideoGalleryWrapperProps {
  videos: any[]
  stats: {
    totalVideos: number
    completedVideos: number
    processingVideos: number
    failedVideos: number
    totalCreditsUsed: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  filters: {
    status?: string
    quality?: string
    search?: string
    sort: string
  }
  bulkSelectMode?: boolean
  selectedVideos?: Set<string>
  onToggleVideoSelection?: (videoId: string) => void
}

/**
 * Wrapper simplificado para VideoGallery
 * Sistema de seleção gerenciado pelo componente pai (auto-sync-gallery-interface)
 */
export function VideoGalleryWrapper(props: VideoGalleryWrapperProps) {
  return (
    <div className="space-y-6">
      <VideoGallery
        {...props}
        bulkSelectMode={props.bulkSelectMode || false}
        selectedVideos={props.selectedVideos || new Set()}
        onToggleVideoSelection={props.onToggleVideoSelection}
      />
    </div>
  )
}
