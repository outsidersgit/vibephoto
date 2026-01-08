import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logClientError, validateAndSanitize, detectBrowser } from '@/lib/client-logger'

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
      try {
        // Detectar navegador para debugging
        const browser = detectBrowser()
        console.log('[IMAGE_GENERATION] Browser info:', browser)

        // Validar e sanitizar dados antes de enviar
        const payload = {
          modelId: params.modelId,
          prompt: params.prompt.trim(),
          negativePrompt: params.negativePrompt?.trim() || undefined,
          ...params.settings,
        }

        const validation = validateAndSanitize(payload, 'image-generation')

        if (!validation.valid) {
          const error = new Error(validation.error || 'Invalid data')
          logClientError(error, {
            context: 'image-generation-validation',
            payload,
            browser,
            validationError: validation.error
          })
          throw error
        }

        if (validation.sanitized) {
          console.warn('[IMAGE_GENERATION] Data was sanitized before sending')
          logClientError('Data sanitization occurred', {
            context: 'image-generation-sanitization',
            browser,
            originalPromptLength: params.prompt.length
          })
        }

        const response = await fetch('/api/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validation.data || payload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const error = new Error(errorData.error || `HTTP error! status: ${response.status}`)

          // Log erro de API
          logClientError(error, {
            context: 'image-generation-api-error',
            status: response.status,
            errorData,
            browser,
            promptLength: params.prompt.length
          })

          throw error
        }

        const data = await response.json()

        if (!data.success) {
          const errorDetails = data.details
            ? `\n\nDetalhes: ${data.details.errorType}\nStatus do modelo: ${data.details.modelStatus}\nTem URL do modelo: ${data.details.hasModelUrl ? 'Sim' : 'Não'}`
            : ''
          const error = new Error((data.error || 'Falha ao iniciar geração') + errorDetails)

          // Log erro de geração
          logClientError(error, {
            context: 'image-generation-failed',
            details: data.details,
            browser,
            promptLength: params.prompt.length
          })

          throw error
        }

        return data.generation

      } catch (error) {
        // Capturar erros inesperados (ex: "did not match the expected pattern")
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase()

          // Erro específico de validação de pattern (Safari issue)
          if (errorMessage.includes('pattern') || errorMessage.includes('did not match')) {
            console.error('[IMAGE_GENERATION] PATTERN VALIDATION ERROR - Safari issue detected!')

            logClientError(error, {
              context: 'image-generation-pattern-error',
              browser: detectBrowser(),
              promptLength: params.prompt?.length,
              promptPreview: params.prompt?.substring(0, 100),
              settings: params.settings,
              errorType: 'PATTERN_VALIDATION_ERROR',
              safariIssue: true
            })
          }
        }

        throw error
      }
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

      console.log(`🔍 [POLLING] Fetching status for generation: ${generationId}`)
      
      const response = await fetch(`/api/generations/${generationId}/check-status`, {
        cache: 'no-store' // Garantir que sempre busca dados frescos
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [POLLING] Failed to check status: ${response.status} - ${errorText}`)
        throw new Error(`Failed to check generation status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`✅ [POLLING] Status fetched:`, {
        generationId: data.id,
        status: data.status,
        hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
        imageUrlsCount: data.imageUrls?.length || 0
      })

      return data
    },
    enabled: enabled && !!generationId,
    refetchInterval: (data) => {
      // Fazer polling a cada 3s enquanto estiver processando
      const shouldContinue = data?.status === 'PROCESSING' || data?.status === 'PENDING'
      
      if (shouldContinue) {
        console.log(`🔄 [POLLING] Will refetch in 3s (status: ${data?.status})`)
        return 3000
      }
      
      // Parar polling quando completar ou falhar
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        console.log(`⏹️ [POLLING] Stopping polling (status: ${data?.status})`)
      }
      return false
    },
    staleTime: 0, // Sempre buscar dados frescos para status
    refetchOnWindowFocus: true, // Refetch quando janela ganha foco
    refetchOnReconnect: true, // Refetch quando reconectar
    onSuccess: (data) => {
      // Quando completar ou falhar, invalidar cache da galeria
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        console.log(`🔄 [POLLING] Invalidating cache for status: ${data?.status}`)
        queryClient.invalidateQueries({ queryKey: ['gallery'] })
        queryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    },
    onError: (error) => {
      console.error(`❌ [POLLING] Query error:`, error)
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
