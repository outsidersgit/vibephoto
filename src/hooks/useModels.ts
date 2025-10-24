import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook para buscar lista de modelos do usuário
 */
export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await fetch('/api/models')

      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutos (modelos mudam raramente)
  })
}

/**
 * Hook para buscar detalhes de um modelo específico
 */
export function useModel(modelId: string | null) {
  return useQuery({
    queryKey: ['model', modelId],
    queryFn: async () => {
      if (!modelId) return null

      const response = await fetch(`/api/models/${modelId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch model')
      }

      return response.json()
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

/**
 * Hook para criar/treinar novo modelo
 */
export function useCreateModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/ai/train', {
        method: 'POST',
        body: data
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create model')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidar cache de modelos
      queryClient.invalidateQueries({ queryKey: ['models'] })
    }
  })
}

/**
 * Hook para verificar status de treinamento do modelo
 */
export function useModelStatus(modelId: string | null) {
  return useQuery({
    queryKey: ['model-status', modelId],
    queryFn: async () => {
      if (!modelId) return null

      const response = await fetch(`/api/models/${modelId}/sync-status`)

      if (!response.ok) {
        throw new Error('Failed to fetch model status')
      }

      return response.json()
    },
    enabled: !!modelId,
    refetchInterval: (data) => {
      // Se ainda está treinando, fazer polling a cada 5 segundos
      if (data?.status === 'training' || data?.status === 'processing') {
        return 5000
      }
      // Se completou ou falhou, parar polling
      return false
    },
    staleTime: 0, // Sempre buscar dados frescos para status
  })
}

/**
 * Hook para deletar modelo
 */
export function useDeleteModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modelId: string) => {
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete model')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
    }
  })
}
