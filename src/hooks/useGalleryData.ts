import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface GalleryFilters {
  tab?: string
  status?: string
  search?: string
  sort?: string
  page?: number
  limit?: number
}

export interface GalleryData {
  generations: any[]
  editHistory: any[]
  videos: any[]
  stats: {
    totalGenerations: number
    totalEdited: number
    totalVideos: number
    totalCreditsUsed: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * Hook para buscar dados da galeria com React Query
 * Gerencia cache automático, revalidação e estados de loading/error
 */
export function useGalleryData(filters: GalleryFilters, placeholderData?: GalleryData) {
  return useQuery({
    queryKey: ['gallery', filters],
    queryFn: async (): Promise<GalleryData> => {
      const params = new URLSearchParams()

      if (filters.tab) params.append('tab', filters.tab)
      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      if (filters.sort) params.append('sort', filters.sort)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/gallery/data?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch gallery data')
      }

      return response.json()
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    placeholderData, // Mantém dados anteriores durante refetch (React Query v5)
    // placeholderData mantém os dados enquanto carrega novos (evita desaparecimento)
  })
}

/**
 * Hook para deletar geração individual
 * Implementa optimistic updates para UX instantâneo (Fase 2 - Otimização de Performance)
 */
export function useDeleteGeneration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch('/api/generations/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete generation')
      }

      return response.json()
    },
    // Optimistic update: remove da UI antes da resposta do servidor
    onMutate: async (generationId: string) => {
      // Cancelar queries em andamento para evitar conflitos
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      
      // Salvar estado anterior para rollback
      const previousData = queryClient.getQueryData(['gallery'])
      
      // Atualizar cache otimisticamente
      queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
        if (!old) return old
        
        return {
          ...old,
          generations: old.generations?.filter((g: any) => g.id !== generationId) || [],
          stats: {
            ...old.stats,
            totalGenerations: Math.max(0, (old.stats?.totalGenerations || 0) - 1)
          }
        }
      })
      
      return { previousData }
    },
    // Se erro, reverter para estado anterior
    onError: (err, generationId, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['gallery'], context.previousData)
      }
    },
    // Sempre revalidar após completar (sucesso ou erro)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}

/**
 * Hook para deletar item do histórico de edição
 * Implementa optimistic updates para UX instantâneo (Fase 2 - Otimização de Performance)
 */
export function useDeleteEditHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (editId: string) => {
      const response = await fetch(`/api/gallery/edited?id=${editId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete edit')
      }

      return response.json()
    },
    // Optimistic update: remove da UI instantaneamente
    onMutate: async (editId: string) => {
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      const previousData = queryClient.getQueryData(['gallery'])
      
      queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
        if (!old) return old
        
        return {
          ...old,
          editHistory: old.editHistory?.filter((e: any) => e.id !== editId) || [],
          stats: {
            ...old.stats,
            totalEdited: Math.max(0, (old.stats?.totalEdited || 0) - 1)
          }
        }
      })
      
      return { previousData }
    },
    onError: (err, editId, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['gallery'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}

/**
 * Hook para deletar vídeo individual
 * Implementa optimistic updates para UX instantâneo (Fase 2 - Otimização de Performance)
 */
export function useDeleteVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: string) => {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete video')
      }

      return response.json()
    },
    // Optimistic update: remove da UI instantaneamente
    onMutate: async (videoId: string) => {
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      const previousData = queryClient.getQueryData(['gallery'])
      
      queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
        if (!old) return old
        
        return {
          ...old,
          videos: old.videos?.filter((v: any) => v.id !== videoId) || [],
          stats: {
            ...old.stats,
            totalVideos: Math.max(0, (old.stats?.totalVideos || 0) - 1)
          }
        }
      })
      
      return { previousData }
    },
    onError: (err, videoId, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['gallery'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}

/**
 * Hook para deletar múltiplos vídeos
 * Invalida cache automaticamente após sucesso
 */
export function useBulkDeleteVideos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoIds: string[]) => {
      const response = await fetch('/api/videos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to bulk delete videos')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}

/**
 * Hook para forçar refresh manual dos dados da galeria
 */
export function useRefreshGallery() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['gallery'] })
  }
}
