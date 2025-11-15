'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useToast } from '@/hooks/use-toast'
import { useImageGeneration, useManualSync, useGenerationPolling } from '@/hooks/useImageGeneration'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Download
} from 'lucide-react'
import { PromptInput } from './prompt-input'
import { GenerationSettings } from './generation-settings'
import { PromptExamples } from './prompt-examples'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useInvalidateCredits } from '@/hooks/useCredits'
import { CREDIT_COSTS, getImageGenerationCost } from '@/lib/credits/pricing'

interface GenerationInterfaceProps {
  models: Array<{
    id: string
    name: string
    class: string
    sampleImages: any[]
    qualityScore?: number
  }>
  selectedModelId: string
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
  }
  canUseCredits: boolean
}

export function GenerationInterface({
  models,
  selectedModelId,
  user,
  canUseCredits
}: GenerationInterfaceProps) {
  console.log('🧭 [GENERATION_INTERFACE] render start')
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { addToast } = useToast()
  
  const [selectedModel, setSelectedModel] = useState(selectedModelId)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [isLastBlockSelected, setIsLastBlockSelected] = useState(false)
  const [isGuidedMode, setIsGuidedMode] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentGeneration, setCurrentGeneration] = useState<any>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isButtonLocked, setIsButtonLocked] = useState(false)
  const buttonFallbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingGenerationIdRef = useRef<string | null>(null)

  // Inline preview state
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' } | null>(null)
  const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false)
  // Flag para evitar toasts e previews duplicados
  const [completedGenerationIds, setCompletedGenerationIds] = useState<Set<string>>(new Set())
  const completedGenerationIdsRef = useRef<Set<string>>(completedGenerationIds)
  useEffect(() => {
    completedGenerationIdsRef.current = completedGenerationIds
  }, [completedGenerationIds])

  // React Query hooks
  const generateImage = useImageGeneration()
  const manualSync = useManualSync()
  const { invalidateBalance } = useInvalidateCredits()
  
  // Detect mobile for responsive labels
  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window === 'undefined') return
      setIsMobile(window.innerWidth < 768)
    }

    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
    return () => window.removeEventListener('resize', updateIsMobile)
  }, [])

  // Polling como fallback caso SSE falhe
  // CRITICAL: Habilitar polling se há uma geração em PROCESSING OU se SSE desconectou
  const shouldPoll = !!currentGeneration && (
    currentGeneration.status === 'PROCESSING' || 
    currentGeneration.status === 'PENDING'
  )
  
  const generationPolling = useGenerationPolling(
    currentGeneration?.id || null,
    shouldPoll
  )
  
  // Log polling status para debug
  useEffect(() => {
    if (currentGeneration?.id) {
      console.log(`🔍 [POLLING] Generation ${currentGeneration.id}:`, {
        status: currentGeneration.status,
        pollingEnabled: shouldPoll,
        pollingData: generationPolling.data?.status,
        pollingError: generationPolling.error,
        isLoading: generationPolling.isLoading
      })
    }
  }, [currentGeneration?.id, currentGeneration?.status, shouldPoll, generationPolling.data?.status, generationPolling.error, generationPolling.isLoading])
  
  // Botão deve permanecer em loading enquanto:
  // - Requisição HTTP está em andamento OU
  // - Geração está processando (aguardando webhook)
  const requestInFlight = generateImage.isPending || currentGeneration?.status === 'PROCESSING'
  const isGenerating = isButtonLocked || requestInFlight

  // Função para validar se uma URL de imagem está acessível
  const validateImageUrl = useCallback(async (url: string, maxRetries = 3): Promise<boolean> => {
    console.log(`🔍 [GENERATION] Validating image URL (attempt 1/${maxRetries}):`, url.substring(0, 100) + '...')
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const img = new Image()
        const isValid = await new Promise<boolean>((resolve) => {
          let resolved = false
          
          img.onload = () => {
            if (!resolved) {
              resolved = true
              console.log(`✅ [GENERATION] Image URL validated successfully (attempt ${attempt})`)
              resolve(true)
            }
          }
          
          img.onerror = () => {
            if (!resolved) {
              resolved = true
              console.warn(`⚠️ [GENERATION] Image URL validation failed (attempt ${attempt})`)
              resolve(false)
            }
          }
          
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              console.warn(`⏱️ [GENERATION] Image URL validation timeout (attempt ${attempt})`)
              resolve(false)
            }
          }, 5000)
          
          img.src = url
        })
        
        if (isValid) {
          return true
        }
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ [GENERATION] Retrying validation in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        console.error(`❌ [GENERATION] Error validating URL (attempt ${attempt}):`, error)
        if (attempt === maxRetries) {
          return false
        }
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    return false
  }, [])

  // Função para validar se URL está acessível
  const testImageUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const img = new Image()
      return await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000)
        img.onload = () => { clearTimeout(timeout); resolve(true) }
        img.onerror = () => { clearTimeout(timeout); resolve(false) }
        img.src = url
      })
    } catch {
      return false
    }
  }, [])

  const clearGenerationLock = useCallback(() => {
    if (buttonFallbackTimerRef.current) {
      clearTimeout(buttonFallbackTimerRef.current)
      buttonFallbackTimerRef.current = null
    }
    pendingGenerationIdRef.current = null
    setIsButtonLocked(false)
  }, [])

  const resetFormAfterPreview = useCallback(() => {
    setPrompt('')
    setNegativePrompt('')
    setIsLastBlockSelected(false)
    setIsGuidedMode(false)
    setCurrentGeneration(null)
  }, [])

  // Função para abrir modal com validação de URL
  const openModalWithValidation = useCallback(async (
    temporaryUrl: string | null,
    permanentUrl: string | null
  ) => {
    console.log('🎯 [GENERATION] Validating URLs for modal...')

    let urlToUse: string | null = null

    const candidates: Array<{ url: string | null; type: 'temporary' | 'permanent' }> = [
      { url: temporaryUrl, type: 'temporary' },
      { url: permanentUrl, type: 'permanent' }
    ]

    for (const candidate of candidates) {
      if (!candidate.url) continue
      const isAccessible = await testImageUrl(candidate.url)
      if (isAccessible) {
        urlToUse = candidate.url
        console.log(`✅ [GENERATION] Using ${candidate.type} URL (validated)`)
        break
      }
    }

    // Se nenhum candidato passou no teste, mas temos alguma URL, usa assim mesmo
    if (!urlToUse) {
      const fallbackCandidate = candidates.find(c => c.url)?.url || null
      if (fallbackCandidate) {
        console.warn('⚠️ [GENERATION] Image validation failed, but fallback URL exists. Using fallback without validation.')
        urlToUse = fallbackCandidate
      }
    }

    if (urlToUse) {
      setPreviewMedia({ url: urlToUse, type: 'image' })
      setIsPreviewLightboxOpen(false)
      clearGenerationLock()
      resetFormAfterPreview()
      invalidateBalance()
    } else {
      console.error('❌ [GENERATION] No valid URL')
      clearGenerationLock()
    }
  }, [testImageUrl, clearGenerationLock, resetFormAfterPreview, invalidateBalance])

  const fetchGenerationPreviewUrls = useCallback(async (
    generationId: string,
    attempts: number = 5,
    backoffMs: number = 1500
  ): Promise<{ temp: string | null; perm: string | null }> => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(`/api/generations/${generationId}`)
        if (response.ok) {
          const payload = await response.json()
          const details = payload?.generation || payload
          const metadata = details?.metadata || {}

          const temp =
            details?.temporaryUrls?.[0] ||
            metadata?.temporaryUrls?.[0] ||
            metadata?.originalUrls?.[0] ||
            null

          const perm =
            details?.imageUrls?.[0] ||
            metadata?.permanentUrls?.[0] ||
            null

          if (temp || perm) {
            return { temp, perm }
          }
        } else {
          console.warn(`⚠️ [GENERATION] Retry ${attempt} fetch status ${response.status}`)
        }
      } catch (error) {
        console.error(`❌ [GENERATION] Retry ${attempt} fetch error:`, error)
      }

      const delay = attempt * backoffMs
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    return { temp: null, perm: null }
  }, [])

  const handleGenerationPreview = useCallback(async (
    params: {
      generationId?: string | null
      imageUrls?: string[] | null
      temporaryUrls?: string[] | null
      showToast?: boolean
    }
  ) => {
    const { generationId, imageUrls, temporaryUrls, showToast = true } = params

    if (!generationId) {
      return false
    }

    let tempUrl = temporaryUrls?.[0] ?? null
    let permUrl = imageUrls?.[0] ?? null

    if (!tempUrl && !permUrl) {
      console.log('⚠️ [GENERATION] Preview missing URLs, fetching generation details...', {
        generationId,
        imageCount: imageUrls?.length || 0,
        tempCount: temporaryUrls?.length || 0
      })
      const fallback = await fetchGenerationPreviewUrls(generationId)
      tempUrl = fallback.temp
      permUrl = fallback.perm
    }

    if (!tempUrl && !permUrl) {
      console.warn('⚠️ [GENERATION] Preview postponed - still no URLs available after retries', {
        generationId
      })
      return false
    }

    if (completedGenerationIdsRef.current.has(generationId)) {
      console.log('⚠️ [GENERATION] Preview already handled for', generationId)
      return false
    }

    setCompletedGenerationIds((prev) => {
      if (prev.has(generationId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(generationId)
      return next
    })

    try {
      await openModalWithValidation(tempUrl, permUrl)
    } catch (error) {
      console.error('❌ [GENERATION] Error opening preview modal:', error)
      clearGenerationLock()
      return false
    }

    if (showToast) {
      addToast({
        type: 'success',
        title: 'Sucesso!',
        description: 'Imagem processada e salva com sucesso',
        duration: 4000
      })
    }

    return true
  }, [addToast, openModalWithValidation, clearGenerationLock, fetchGenerationPreviewUrls])

  // Real-time updates for generation status
  useRealtimeUpdates({
    onGenerationStatusChange: (generationId, status, data) => {
      console.log(`🔄 Real-time generation update: ${generationId} -> ${status}`, {
        hasImageUrls: !!data.imageUrls,
        imageUrlsLength: data.imageUrls?.length,
        currentGenerationId: currentGeneration?.id
      })
      
      // Update current generation if it matches
      if (currentGeneration?.id === generationId) {
        console.log(`✅ Matched current generation: ${generationId}`)
        setCurrentGeneration((prev: any) => ({
          ...prev,
          status,
          imageUrls: data.imageUrls || prev?.imageUrls,
          thumbnailUrls: data.thumbnailUrls || prev?.thumbnailUrls,
          temporaryUrls: data.temporaryUrls || prev?.temporaryUrls,
          metadata: data.metadata ? { ...(prev?.metadata || {}), ...data.metadata } : prev?.metadata,
          processingTime: data.processingTime || prev?.processingTime,
          errorMessage: data.errorMessage || prev?.errorMessage
        }))

        const hasAnyImageUrls = (data.temporaryUrls && data.temporaryUrls.length > 0) ||
          (data.imageUrls && data.imageUrls.length > 0)

        if (status === 'COMPLETED' && hasAnyImageUrls) {
          handleGenerationPreview({
            generationId,
            imageUrls: data.imageUrls,
            temporaryUrls: data.temporaryUrls
          }).catch((error) => {
            console.error('❌ [GENERATION] Failed to handle preview via SSE:', error)
          })
        }

        // Show error message if failed
        if (status === 'FAILED') {
          const errorMessage = data.errorMessage || 'Erro desconhecido na geração'
          addToast({
            type: 'error',
            title: 'Falha na geração de imagem',
            description: errorMessage,
            duration: 6000
          })
          clearGenerationLock()
        }
      }
    },
    onConnect: () => {
      console.log('✅ Connected to real-time updates')
    },
    onDisconnect: () => {
      console.log('❌ Disconnected from real-time updates')
      
      // Se há uma geração em andamento e SSE desconectou, polling vai cuidar
      if (currentGeneration?.status === 'PROCESSING') {
        console.log('⚠️ SSE disconnected during generation - polling will handle status updates')
      }
    },
    onError: (error) => {
      console.error('❌ SSE connection error:', error)
      
      // Se há uma geração em andamento e SSE falhou, polling vai cuidar
      if (currentGeneration?.status === 'PROCESSING') {
        console.log('⚠️ SSE error during generation - polling will handle status updates')
      }
    }
  })

  // Sincronizar polling com estado da geração (fallback caso SSE falhe)
  useEffect(() => {
    const payload = generationPolling.data
    if (!payload) {
      return
    }

    const matchesCurrent = currentGeneration?.id === payload.id
    console.log(`🔍 [POLLING_SYNC] Update`, {
      polledId: payload.id,
      pollingStatus: payload.status,
      currentId: currentGeneration?.id,
      currentStatus: currentGeneration?.status,
      matchesCurrent
    })

    if (!matchesCurrent) {
      // Caso raro: polling retornou dados de uma geração e o state local foi limpo
      if (!currentGeneration && payload.status === 'COMPLETED') {
        handleGenerationPreview({
          generationId: payload.id,
          imageUrls: payload.imageUrls,
          temporaryUrls: payload.temporaryUrls
        }).catch((error) => {
          console.error('❌ [GENERATION] Failed to handle preview for orphan polling data:', error)
        })
      }
      return
    }

    const statusChanged = payload.status !== currentGeneration.status
    const hasNewImages = payload.imageUrls && payload.imageUrls.length > 0 &&
      (!currentGeneration.imageUrls || currentGeneration.imageUrls.length === 0)

    if (statusChanged || hasNewImages) {
      setCurrentGeneration((prev: any) => ({
        ...prev,
        status: payload.status,
        imageUrls: payload.imageUrls || prev?.imageUrls,
        thumbnailUrls: payload.thumbnailUrls || prev?.thumbnailUrls,
        temporaryUrls: payload.temporaryUrls || prev?.temporaryUrls,
        processingTime: payload.processingTime || prev?.processingTime,
        errorMessage: payload.errorMessage || prev?.errorMessage,
        completedAt: payload.status === 'COMPLETED'
          ? (payload.completedAt ? new Date(payload.completedAt) : new Date())
          : prev?.completedAt
      }))
    }

    if (payload.status === 'COMPLETED') {
      handleGenerationPreview({
        generationId: currentGeneration?.id || payload.id,
        imageUrls: payload.imageUrls,
        temporaryUrls: payload.temporaryUrls
      }).catch((error) => {
        console.error('❌ [GENERATION] Failed to handle preview via polling:', error)
      })
    }

    if (payload.status === 'FAILED') {
      const errorMessage = payload.errorMessage || 'Erro desconhecido na geração'
      addToast({
        type: 'error',
        title: 'Falha na geração de imagem',
        description: errorMessage,
        duration: 6000
      })
      clearGenerationLock()
    }
  }, [generationPolling.data, currentGeneration, handleGenerationPreview, addToast, clearGenerationLock])
  
  const [settings, setSettings] = useState({
    aspectRatio: '1:1',
    resolution: '1024x1024',
    variations: 1,
    strength: 0.8,
    seed: undefined as number | undefined,
    style: 'photographic',
    // FLUX parameters
    steps: undefined as number | undefined,
    guidance_scale: undefined as number | undefined,
    raw_mode: false,
    output_quality: 95,
    safety_tolerance: 2,
    output_format: 'jpg',
    // AI Provider selection
    aiProvider: 'replicate' as 'replicate' | 'astria',
    // Astria enhancement parameters
    astria_super_resolution: true,
    astria_inpaint_faces: true,
    astria_face_correct: true,
    astria_face_swap: true,
    astria_hires_fix: true,
    astria_model_type: 'faceid' as 'faceid' | 'sd15' | 'sdxl1' | 'flux-lora'
  })

  const selectedModelData = models.find(m => m.id === selectedModel)

  // Função para limpar todos os campos após geração bem-sucedida
  const handleGenerate = async () => {
    if (!prompt.trim() || !canUseCredits) return

    setIsButtonLocked(true)

    addToast({
      type: 'info',
      title: 'Processando...',
      description: 'Sua imagem está sendo processada, você será notificado quando estiver pronta'
    })

    // Log do prompt que será enviado
    console.log('🚀 [GENERATION] Starting generation with prompt:', {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      promptLength: prompt.length,
      isGuidedMode,
      isLastBlockSelected,
      modelId: selectedModel
    })

    // Limpar estado anterior antes de iniciar nova geração
    setCurrentGeneration(null)
    setPreviewMedia(null)
    setIsPreviewLightboxOpen(false)

    try {
      const generation = await generateImage.mutateAsync({
        modelId: selectedModel,
        prompt: prompt.trim(), // Garantir que o prompt está trimado
        negativePrompt: negativePrompt,
        settings: {
          ...settings,
          // Astria specific parameters
          astriaEnhancements: settings.aiProvider === 'astria' ? {
            super_resolution: settings.astria_super_resolution,
            inpaint_faces: settings.astria_inpaint_faces,
            face_correct: settings.astria_face_correct,
            face_swap: settings.astria_face_swap,
            hires_fix: settings.astria_hires_fix,
            model_type: settings.astria_model_type
          } : undefined
        }
      })

      // CRITICAL: Garantir que status seja PROCESSING ao setar currentGeneration
      setCurrentGeneration({
        ...generation,
        status: generation.status || 'PROCESSING' // Garantir PROCESSING se não veio no response
      })
      pendingGenerationIdRef.current = generation.id
      if (buttonFallbackTimerRef.current) {
        clearTimeout(buttonFallbackTimerRef.current)
      }
      buttonFallbackTimerRef.current = setTimeout(() => {
        if (!pendingGenerationIdRef.current) return
        console.warn('⏱️ [GENERATION] Fallback timer triggered, forcing manual sync')
        handleManualSync(pendingGenerationIdRef.current)
      }, 15000)
      console.log('🚀 Generation started, waiting for real-time updates...', {
        generationId: generation.id,
        status: generation.status || 'PROCESSING'
      })
    } catch (error) {
      console.error('❌ Generation request error:', error)
      
      // CRITICAL: Limpar estado após erro para resetar o botão
      setCurrentGeneration(null)
      setPreviewMedia(null)
      setIsPreviewLightboxOpen(false)
      clearGenerationLock()
      
      // Extrair mensagem de erro
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Detectar tipo de erro para mostrar mensagem apropriada
      let userFriendlyMessage = 'Erro desconhecido ao iniciar a geração. Tente novamente.'
      let userFriendlyTitle = 'Erro ao iniciar geração'
      
      // Erro de saldo do Astria (conta VibePhoto) - NÃO mostrar ao usuário
      if (errorMessage.includes('Not enough balance') || errorMessage.includes('balance in account')) {
        // Este é um erro técnico interno - não mostrar detalhes ao usuário
        console.error('⚠️ [ASTRIA_BALANCE_ERROR] Saldo insuficiente na conta do Astria:', errorMessage)
        userFriendlyMessage = 'Erro temporário no serviço. Nossa equipe foi notificada. Por favor, tente novamente em alguns instantes.'
        userFriendlyTitle = 'Serviço temporariamente indisponível'
      }
      // Erro de créditos do usuário - MOSTRAR (já validado antes, mas pode acontecer em race condition)
      else if (errorMessage.includes('insufficient credits') || errorMessage.includes('créditos insuficientes') || errorMessage.includes('credits')) {
        userFriendlyMessage = 'Você não tem créditos suficientes para esta geração. Adquira mais créditos para continuar.'
        userFriendlyTitle = 'Créditos insuficientes'
      }
      // Erro de parâmetros inválidos
      else if (errorMessage.includes('Invalid parameters')) {
        userFriendlyMessage = 'Parâmetros inválidos. Verifique suas configurações e tente novamente.'
        userFriendlyTitle = 'Configuração inválida'
      }
      // Erro genérico do Astria
      else if (errorMessage.includes('Astria API error') || errorMessage.includes('Astria')) {
        console.error('⚠️ [ASTRIA_ERROR] Erro do provedor Astria:', errorMessage)
        userFriendlyMessage = 'Erro temporário no serviço de geração. Por favor, tente novamente em alguns instantes.'
        userFriendlyTitle = 'Erro no serviço'
      }
      
      // Usar toast em vez de alert para melhor UX
      addToast({
        type: 'error',
        title: userFriendlyTitle,
        description: userFriendlyMessage,
        duration: 8000 // 8 segundos para ler mensagem completa
      })
      clearGenerationLock()
    }
  }


  const handlePromptSelect = (selectedPrompt: string) => {
    setPrompt(selectedPrompt)
    // Scroll automático para a caixa de prompt
    setTimeout(() => {
      const promptElement = document.getElementById('prompt')
      if (promptElement) {
        const rect = promptElement.getBoundingClientRect()
        const offset = window.pageYOffset + rect.top - 150 // 150px from top para subir mais
        
        window.scrollTo({
          top: offset,
          behavior: 'smooth'
        })
        
        // Focar no textarea após scroll
        setTimeout(() => {
          promptElement.focus()
        }, 500)
      }
    }, 100)
  }

  const handleManualSync = useCallback(async (generationId: string) => {
    try {
      const data = await manualSync.mutateAsync(generationId)

      if (data.success) {
        // Refresh the current generation status
        const statusResponse = await fetch(`/api/generations/${generationId}`)
        const statusPayload = await statusResponse.json()
        const refreshedGeneration = statusPayload?.generation || statusPayload

        if (refreshedGeneration) {
          setCurrentGeneration(refreshedGeneration)

          if (refreshedGeneration.status === 'COMPLETED') {
            await handleGenerationPreview({
              generationId: refreshedGeneration.id,
              imageUrls: refreshedGeneration.imageUrls || (refreshedGeneration.metadata as any)?.permanentUrls || [],
              temporaryUrls: (refreshedGeneration.metadata as any)?.temporaryUrls || []
            })
          } else {
            clearGenerationLock()
          }

        }
      } else {
        alert(data.error || 'Falha ao sincronizar status da geração')
        clearGenerationLock()
      }
    } catch (error) {
      console.error('Error syncing generation:', error)
      clearGenerationLock()
    }
  }, [clearGenerationLock, manualSync, handleGenerationPreview])

  const handleDownloadPreview = useCallback(async () => {
    if (!previewMedia?.url) return

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const cleanUrl = previewMedia.url.split('?')[0]
      let extension = 'jpg'

      try {
        const urlObj = new URL(previewMedia.url)
        const urlExt = urlObj.pathname.split('.').pop()
        if (urlExt && urlExt.length <= 5) {
          extension = urlExt
        }
      } catch {
        const urlExt = cleanUrl.split('.').pop()
        if (urlExt && urlExt.length <= 5) {
          extension = urlExt
        }
      }

      const proxyResponse = await fetch('/api/download-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl: previewMedia.url,
          filename: `vibephoto-preview-${timestamp}.${extension}`
        })
      })

      if (!proxyResponse.ok) {
        throw new Error(`Failed to download preview: ${proxyResponse.status}`)
      }

      const blob = await proxyResponse.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `vibephoto-preview-${timestamp}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('❌ [GENERATION] Failed to download preview:', error)
      addToast({
        type: 'error',
        title: 'Falha no download',
        description: 'Não foi possível baixar a imagem gerada. Tente novamente.'
      })
    }
  }, [previewMedia, addToast])

  useEffect(() => {
    return () => {
      if (buttonFallbackTimerRef.current) {
        clearTimeout(buttonFallbackTimerRef.current)
        buttonFallbackTimerRef.current = null
      }
      pendingGenerationIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (previewMedia) {
      clearGenerationLock()
    }
  }, [previewMedia, clearGenerationLock])

  // Formula: credits_available = (credits_limit - credits_used) + credits_balance
  const creditsRemaining = (user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0)
  const creditsNeeded = getImageGenerationCost(settings.variations)
  const variationLabel = settings.variations === 1 ? 'foto' : 'fotos'
  const desktopButtonLabel = `Gerar ${settings.variations} ${variationLabel} (${creditsNeeded} créditos)`
  const mobileButtonLabel = desktopButtonLabel
  
  // Check if we're in guided mode by checking if last block (environment) was selected
  // In guided mode, require last block (environment) to be selected AND prompt to be filled
  // In free mode, just require prompt text
  // If isLastBlockSelected is true, we're in guided mode and the last block was selected
  // If isLastBlockSelected is false, we're in free mode and just need prompt
  // The condition is: prompt must be filled, and if we're in guided mode (isLastBlockSelected), it's already satisfied
  const canGenerate = 
    canUseCredits && 
    !isGenerating && 
    creditsRemaining >= creditsNeeded &&
    prompt.trim() // Prompt is sufficient - if in guided mode, isLastBlockSelected being true already ensures last block was selected

  const getClassLabel = (modelClass: string) => {
    const labels = {
      MAN: 'Homem',
      WOMAN: 'Mulher',
      BOY: 'Menino',
      GIRL: 'Menina',
      ANIMAL: 'Animal'
    }
    return labels[modelClass as keyof typeof labels] || modelClass
  }

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Model Selection and Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Model Selection Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Selecione qual modelo usar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({getClassLabel(model.class)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Settings Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Ajuste os parâmetros de geração
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GenerationSettings
                settings={settings}
                onSettingsChange={setSettings}
                userPlan={user.plan}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Prompt Input and Examples */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Escreva uma descrição detalhada da foto que deseja criar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PromptInput
                prompt={prompt}
                negativePrompt={negativePrompt}
                onPromptChange={setPrompt}
                isGenerating={isGenerating}
                modelClass={selectedModelData?.class || 'MAN'}
                onLastBlockSelected={setIsLastBlockSelected}
                onModeChange={setIsGuidedMode}
              />

              {/* Generate Button */}
              <div className="space-y-3">
                {!canUseCredits && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 font-medium text-sm">Limite de Créditos Atingido</p>
                    <p className="text-red-600 text-xs mt-1">
                      Você usou todos os seus créditos este mês. Faça upgrade do seu plano para continuar gerando.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`w-full shadow-lg ${
                    canGenerate
                      ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {isMobile ? mobileButtonLabel : desktopButtonLabel}
                    </>
                  )}
                </Button>

                {!canGenerate && !isGenerating && (
                  <p className="text-xs text-gray-500 text-center">
                    {!canUseCredits
                      ? 'Limite de créditos atingido'
                      : creditsRemaining < creditsNeeded
                      ? `Precisa de ${creditsNeeded} créditos (você tem ${creditsRemaining})`
                      : null
                    }
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Examples Card - Collapsible - Only visible in free mode */}
          {!isGuidedMode && (
            <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
              <CardContent className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowExamples(!showExamples)}
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  {showExamples ? 'Ocultar' : 'Ver'} Exemplos de Descrições
                  {showExamples ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                </Button>

                {/* Prompt Examples - Show when expanded */}
                {showExamples && (
                  <div className="mt-4">
                    <PromptExamples
                      modelClass={selectedModelData?.class || 'MAN'}
                      onPromptSelect={handlePromptSelect}
                      onClose={() => setShowExamples(false)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Generation Status - Only show when failed */}
          {currentGeneration && currentGeneration.status === 'FAILED' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-red-900">
                      Geração Falhou
                    </h3>
                    {currentGeneration.errorMessage && (
                      <p className="text-xs text-red-700 mt-1">
                        {currentGeneration.errorMessage}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentGeneration(null)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Inline preview */}
      {previewMedia && (
        <div className="max-w-4xl mx-auto px-6 mt-6 mb-12">
          <h3 className="text-base font-semibold text-gray-800 mb-3 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
            Resultado recente
          </h3>
          <div
            className="relative group cursor-pointer rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm"
            onClick={() => setIsPreviewLightboxOpen(true)}
          >
            <img
              src={previewMedia.url}
              alt="Resultado gerado"
              className="w-full h-auto object-cover max-h-72"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="px-3 py-1 bg-white/85 text-gray-900 text-xs font-semibold rounded-full">
                Clique para ampliar
              </span>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isPreviewLightboxOpen} onOpenChange={setIsPreviewLightboxOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
          {previewMedia?.type === 'image' && (
            <>
              <button
                type="button"
                onClick={handleDownloadPreview}
                className="absolute right-16 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-900 shadow-sm transition-all duration-200 ease-in-out hover:bg-white hover:ring-2 hover:ring-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
              >
                <Download className="w-3 h-3" />
                Baixar
              </button>
              <img
                src={previewMedia.url}
                alt="Resultado gerado"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}