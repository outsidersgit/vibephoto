import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook para buscar lista de vídeos do usuário
 */
export function useVideos(filters?: {
  status?: string
  quality?: string
  search?: string
  sort?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['videos', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters?.status) params.append('status', filters.status)
      if (filters?.quality) params.append('quality', filters.quality)
      if (filters?.search) params.append('search', filters.search)
      if (filters?.sort) params.append('sort', filters.sort)
      if (filters?.page) params.append('page', filters.page.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/video/history?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }

      return response.json()
    },
    staleTime: 30 * 1000, // 30 segundos
  })
}

/**
 * Hook para buscar detalhes de um vídeo específico
 */
export function useVideo(videoId: string | null) {
  return useQuery({
    queryKey: ['video', videoId],
    queryFn: async () => {
      if (!videoId) return null

      const response = await fetch(`/api/videos/${videoId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch video')
      }

      return response.json()
    },
    enabled: !!videoId,
    staleTime: 60 * 1000, // 1 minuto
  })
}

/**
 * Hook para verificar status de geração de vídeo
 */
export function useVideoStatus(videoId: string | null) {
  return useQuery({
    queryKey: ['video-status', videoId],
    queryFn: async () => {
      if (!videoId) return null

      const response = await fetch(`/api/video/status/${videoId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch video status')
      }

      return response.json()
    },
    enabled: !!videoId,
    refetchInterval: (data) => {
      // Se ainda está processando, fazer polling a cada 5 segundos
      if (data?.status === 'processing' || data?.status === 'queued') {
        return 5000
      }
      // Se completou ou falhou, parar polling
      return false
    },
    staleTime: 0, // Sempre buscar dados frescos para status
  })
}

/**
 * Hook para criar nova geração de vídeo
 */
export function useCreateVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      imageUrl: string
      generationId?: string
      quality?: string
      duration?: number
    }) => {
      const response = await fetch('/api/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create video')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidar cache de vídeos e galeria
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}
