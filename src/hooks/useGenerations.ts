import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook para buscar detalhes de uma geração específica
 */
export function useGeneration(generationId: string | null) {
  return useQuery({
    queryKey: ['generation', generationId],
    queryFn: async () => {
      if (!generationId) return null

      const response = await fetch(`/api/generations/${generationId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch generation')
      }

      return response.json()
    },
    enabled: !!generationId, // Só executa se tiver ID
    staleTime: 60 * 1000, // 1 minuto
  })
}

/**
 * Hook para criar nova geração de imagem
 */
export function useCreateGeneration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      modelId: string
      prompt: string
      negativePrompt?: string
      packageId?: string
      numImages?: number
    }) => {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create generation')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidar cache de gerações e galeria
      queryClient.invalidateQueries({ queryKey: ['generations'] })
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    }
  })
}

/**
 * Hook para verificar status de geração
 */
export function useGenerationStatus(generationId: string | null) {
  return useQuery({
    queryKey: ['generation-status', generationId],
    queryFn: async () => {
      if (!generationId) return null

      const response = await fetch(`/api/generations/${generationId}/check-status`)

      if (!response.ok) {
        throw new Error('Failed to fetch generation status')
      }

      return response.json()
    },
    enabled: !!generationId,
    refetchInterval: (data) => {
      // Se ainda está processando, fazer polling a cada 3 segundos
      if (data?.status === 'processing') {
        return 3000
      }
      // Se completou ou falhou, parar polling
      return false
    },
    staleTime: 0, // Sempre buscar dados frescos para status
  })
}

/**
 * Hook para buscar lista de gerações do usuário
 */
export function useGenerations(filters?: {
  status?: string
  modelId?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['generations', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters?.status) params.append('status', filters.status)
      if (filters?.modelId) params.append('modelId', filters.modelId)
      if (filters?.page) params.append('page', filters.page.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/generations?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch generations')
      }

      return response.json()
    },
    staleTime: 30 * 1000, // 30 segundos
  })
}
