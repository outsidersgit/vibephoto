import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface GenerationSettings {
  aspectRatio?: string
  resolution?: string
  variations?: number
  strength?: number
  seed?: number
  style?: string
  steps?: number
  guidance_scale?: number
  raw_mode?: boolean
  output_quality?: number
  safety_tolerance?: number
  output_format?: string
  aiProvider?: 'replicate' | 'astria'
  astriaEnhancements?: any
}

interface GenerateImageParams {
  modelId: string
  prompt: string
  negativePrompt?: string
  settings: GenerationSettings
}

/**
 * Hook para criar nova geração de imagem com React Query
 * Invalida automaticamente o cache da galeria após sucesso
 */
export function useImageGeneration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: GenerateImageParams) => {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: params.modelId,
          prompt: params.prompt.trim(),
          negativePrompt: params.negativePrompt?.trim() || undefined,
          ...params.settings,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        const errorDetails = data.details
          ? `\n\nDetalhes: ${data.details.errorType}\nStatus do modelo: ${data.details.modelStatus}\nTem URL do modelo: ${data.details.hasModelUrl ? 'Sim' : 'Não'}`
          : ''
        throw new Error((data.error || 'Falha ao iniciar geração') + errorDetails)
      }

      return data.generation
    },
    onSuccess: () => {
      // Invalidar cache da galeria e gerações quando nova imagem é criada
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    },
    onError: (error) => {
      console.error('Generation request error:', error)
    },
  })
}

/**
 * Hook para monitorar status de geração com polling automático
 * Faz polling a cada 3s enquanto status for "PROCESSING" ou "PENDING"
 * Para automaticamente quando completar ou falhar
 */
export function useGenerationPolling(generationId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['generation-polling', generationId],
    queryFn: async () => {
      if (!generationId) return null

      const response = await fetch(`/api/generations/${generationId}/check-status`)

      if (!response.ok) {
        throw new Error('Failed to check generation status')
      }

      return response.json()
    },
    enabled: enabled && !!generationId,
    refetchInterval: (data) => {
      // Fazer polling a cada 3s enquanto estiver processando
      if (data?.status === 'PROCESSING' || data?.status === 'PENDING') {
        return 3000
      }
      // Parar polling quando completar ou falhar
      return false
    },
    staleTime: 0, // Sempre buscar dados frescos para status
    onSuccess: (data) => {
      // Quando completar ou falhar, invalidar cache da galeria
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        queryClient.invalidateQueries({ queryKey: ['gallery'] })
        queryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    },
  })
}

/**
 * Hook para sincronizar manualmente uma geração
 */
export function useManualSync() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch(`/api/generations/${generationId}/sync`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync generation')
      }

      return response.json()
    },
    onSuccess: (data, generationId) => {
      // Invalidar query específica da geração
      queryClient.invalidateQueries({ queryKey: ['generation-polling', generationId] })
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}
