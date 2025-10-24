import { useState, useEffect, useCallback } from 'react'

export interface MediaItem {
  id: string
  type: 'image' | 'video'
  prompt: string
  status: string
  createdAt: Date
  completedAt: Date | null
  processingTime?: number
  errorMessage?: string
  
  // Media URLs (may be temporary or permanent)
  urls: string[]
  thumbnailUrls: string[]
  
  // Storage metadata
  storageProvider?: string
  publicUrl?: string
  
  // Model information
  model?: {
    id: string
    name: string
  }
  
  // Video-specific fields
  duration?: number
  
  // Processing metadata
  metadata?: any
}

export interface MediaApiResponse {
  items: MediaItem[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  statistics: {
    total: number
    completed: number
    processing: number
    failed: number
    images: number
    videos: number
  }
  filters: {
    status?: string
    type?: string
    modelId?: string
  }
}

export interface MediaUrlResponse {
  id: string
  urls: string[]
  thumbnailUrls: string[]
  publicUrl?: string
  expiresAt?: string
  isVideo: boolean
  storageProvider: string
  fallback?: boolean
}

interface UseMediaApiOptions {
  page?: number
  limit?: number
  status?: string
  type?: 'image' | 'video' | 'all'
  modelId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useMediaApi(options: UseMediaApiOptions = {}) {
  const [data, setData] = useState<MediaApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    page = 1,
    limit = 20,
    status,
    type = 'all',
    modelId,
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = options

  const fetchGallery = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        type
      })

      if (status) params.append('status', status)
      if (modelId) params.append('modelId', modelId)

      const response = await fetch(`/api/gallery?${params.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      // Convert date strings to Date objects
      result.items = result.items.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        completedAt: item.completedAt ? new Date(item.completedAt) : null
      }))
      
      setData(result)
      setError(null)
    } catch (err) {
      console.error('Gallery API error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery')
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, type, modelId])

  const getMediaUrl = useCallback(async (mediaId: string): Promise<MediaUrlResponse | null> => {
    try {
      const response = await fetch(`/api/media/${mediaId}/url`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      console.error('Media URL API error:', err)
      return null
    }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchGallery()
  }, [fetchGallery])

  // Initial fetch
  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return

    const interval = setInterval(() => {
      fetchGallery()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchGallery])

  return {
    data,
    loading,
    error,
    refresh,
    getMediaUrl
  }
}

// Hook for managing media URLs with caching
export function useMediaUrls() {
  const [urlCache, setUrlCache] = useState<Map<string, MediaUrlResponse>>(new Map())
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set())

  const getMediaUrl = useCallback(async (mediaId: string): Promise<string[]> => {
    // Check cache first
    const cached = urlCache.get(mediaId)
    if (cached) {
      // Check if cached URLs are still valid
      if (!cached.expiresAt || new Date(cached.expiresAt) > new Date()) {
        return cached.urls
      }
    }

    // Avoid multiple requests for the same media
    if (loadingUrls.has(mediaId)) {
      return []
    }

    setLoadingUrls(prev => new Set(prev).add(mediaId))

    try {
      const response = await fetch(`/api/media/${mediaId}/url`)
      
      if (!response.ok) {
        throw new Error(`Failed to get media URL: ${response.status}`)
      }

      const urlData: MediaUrlResponse = await response.json()
      
      // Cache the result
      setUrlCache(prev => new Map(prev).set(mediaId, urlData))
      
      return urlData.urls
    } catch (err) {
      console.error('Failed to get media URL:', err)
      return []
    } finally {
      setLoadingUrls(prev => {
        const next = new Set(prev)
        next.delete(mediaId)
        return next
      })
    }
  }, [urlCache, loadingUrls])

  const clearCache = useCallback(() => {
    setUrlCache(new Map())
    setLoadingUrls(new Set())
  }, [])

  return {
    getMediaUrl,
    clearCache,
    isLoading: (mediaId: string) => loadingUrls.has(mediaId)
  }
}