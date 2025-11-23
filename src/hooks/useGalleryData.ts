import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface GalleryFilters {
  tab?: string
  status?: string
  model?: string
  search?: string
  sort?: string
  limit?: number
  page?: number
  package?: string
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
    limit: number
    total: number
    page: number
    pages: number
    hasMore?: boolean
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
      if (filters.model) params.append('model', filters.model)
      if (filters.search) params.append('search', filters.search)
      if (filters.sort) params.append('sort', filters.sort)
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.package) params.append('package', filters.package)

      const response = await fetch(`/api/gallery/data?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch gallery data')
      }

      return response.json()
    },
    staleTime: 30 * 1000, // 30 segundos - dados são considerados frescos
    gcTime: 5 * 60 * 1000, // 5 minutos - mantém em cache
    placeholderData, // Mantém dados anteriores durante refetch (React Query v5)
    // CRITICAL: Atualização automática quando há gerações processando
    refetchInterval: (data) => {
      // Verificar se há gerações processando na resposta anterior
      const hasProcessingGenerations = data?.generations?.some((g: any) => 
        g.status === 'PROCESSING' || g.status === 'PENDING'
      )
      // Se há processamento, refetch a cada 10 segundos
      // Se não, desabilitar polling (SSE vai cuidar das atualizações)
      return hasProcessingGenerations ? 10000 : false
    },
    // CRITICAL: Refetch quando janela ganha foco (usuário volta à aba)
    refetchOnWindowFocus: true,
    // CRITICAL: Refetch quando reconectar à internet
    refetchOnReconnect: true,
    // 🚀 OTIMIZAÇÃO: Não refetch se dados são frescos (< staleTime)
    // SSE e polling já garantem sincronização em tempo real
    // Isso evita refetch desnecessário ao trocar entre tabs
    refetchOnMount: false,
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
