'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Edit3,
  Plus,
  Minus,
  RefreshCw,
  Blend,
  Upload,
  X,
  Download,
  Loader2,
  Image as ImageIcon,
  Copy
} from 'lucide-react'
import { PromptOptimizer } from '@/components/ui/prompt-optimizer'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useInvalidateCredits } from '@/hooks/useCredits'
import { CREDIT_COSTS, getImageEditCost, EditorResolution } from '@/lib/credits/pricing'
import { ProcessingMessage } from '@/components/ui/processing-message'
import { notifyError } from '@/lib/errors'
import { InsufficientCreditsBanner } from '@/components/ui/insufficient-credits-banner'
import { PackageSelectorModal } from '@/components/credits/package-selector-modal'
import { saveFilesToIndexedDB, loadFilesFromIndexedDB, deleteFilesFromIndexedDB, savePromptToIndexedDB, loadPromptFromIndexedDB, finalizeDraft, touchDraft } from '@/lib/utils/indexed-db-persistence'
import { EDITOR_PRESETS, FREE_MODE_PRESET, type EditorPreset } from '@/lib/editor-presets'

// Custos dinâmicos baseados na resolução
const getEditorCost = (resolution: EditorResolution) => getImageEditCost(1, resolution)

interface ImageEditorInterfaceProps {
  preloadedImageUrl?: string
  className?: string
  canUseCredits?: boolean
  creditsNeeded?: number
  currentCredits?: number
}

type Operation = 'edit' | 'add' | 'remove' | 'style' | 'blend'

export function ImageEditorInterface({
  preloadedImageUrl,
  className,
  canUseCredits = true,
  creditsNeeded = 0,
  currentCredits = 0
}: ImageEditorInterfaceProps) {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { data: session, status } = useSession()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentEditIdRef = useRef<string | null>(null)
  const loadingRef = useRef<boolean>(false)
  const editFallbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaveRef = useRef<File[]>([])
  const { invalidateBalance } = useInvalidateCredits()

  const [operation] = useState<Operation>('edit')
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>(preloadedImageUrl ? [preloadedImageUrl] : [])
  const [imageFiles, setImageFiles] = useState<File[]>([]) // Store actual File objects
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '9:16' | '16:9'>('3:4')
  const [resolution, setResolution] = useState<EditorResolution>('4k')
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' } | null>(null)
  const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false)
  const [currentEditId, setCurrentEditId] = useState<string | null>(null)
  const [showCreditPurchase, setShowCreditPurchase] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const router = useRouter()
  const fileInputId = useId()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Sync refs with state
  useEffect(() => {
    currentEditIdRef.current = currentEditId
  }, [currentEditId])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // Load persisted images on mount
  useEffect(() => {
    const loadPersistedImages = async () => {
      const files = await loadFilesFromIndexedDB('editor_uploadedImages')

      if (files.length > 0) {
        // Convert Files to base64 for preview
        const base64Images = await Promise.all(
          files.map(file => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => resolve(e.target?.result as string)
              reader.readAsDataURL(file)
            })
          })
        )

        setImages(base64Images)
        setImageFiles(files)
      }
    }

    // Only load if not preloaded from URL
    if (!preloadedImageUrl) {
      loadPersistedImages()
    }
  }, [preloadedImageUrl])

  // Load persisted prompt on mount
  useEffect(() => {
    const loadPersistedPrompt = async () => {
      const saved = await loadPromptFromIndexedDB('editor_prompt')
      if (saved) {
        setPrompt(saved)
      }
    }
    loadPersistedPrompt()
  }, [])

  // Save prompt on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Always save (or delete if empty)
      savePromptToIndexedDB('editor_prompt', prompt)
    }, 1000) // Save 1 second after user stops typing

    return () => clearTimeout(timer)
  }, [prompt])

  // Função para limpar todos os campos após geração bem-sucedida
  const clearForm = async () => {
    setPrompt('')
    setImages([])
    setImageFiles([])
    setError(null)
    setCurrentEditId(null) // Clear edit monitoring
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    // Clear persisted data (idempotent, includes images + prompt)
    await finalizeDraft('editor')
  }
  
  
  // Função para validar se uma URL de imagem está acessível
  const validateImageUrl = useCallback(async (url: string, maxRetries = 3): Promise<boolean> => {
    console.log(`🔍 [IMAGE_EDITOR] Validating image URL (attempt 1/${maxRetries}):`, url.substring(0, 100) + '...')
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Usar Image object para validar (funciona mesmo com CORS)
        const img = new Image()
        const isValid = await new Promise<boolean>((resolve) => {
          let resolved = false
          
          img.onload = () => {
            if (!resolved) {
              resolved = true
              console.log(`✅ [IMAGE_EDITOR] Image URL validated successfully (attempt ${attempt})`)
              resolve(true)
            }
          }
          
          img.onerror = () => {
            if (!resolved) {
              resolved = true
              console.warn(`⚠️ [IMAGE_EDITOR] Image URL validation failed (attempt ${attempt})`)
              resolve(false)
            }
          }
          
          // Timeout de 5 segundos
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              console.warn(`⏱️ [IMAGE_EDITOR] Image URL validation timeout (attempt ${attempt})`)
              resolve(false)
            }
          }, 5000)
          
          img.src = url
        })
        
        if (isValid) {
          return true
        }
        
        // Se não validou e ainda há tentativas, aguardar antes de tentar novamente
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // Backoff exponencial: 2s, 4s
          console.log(`⏳ [IMAGE_EDITOR] Retrying validation in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        console.error(`❌ [IMAGE_EDITOR] Error validating URL (attempt ${attempt}):`, error)
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
  const testUrlAccessibility = useCallback(async (url: string): Promise<boolean> => {
    try {
      console.log(`🔍 [IMAGE_EDITOR] Testing URL:`, url.substring(0, 100) + '...')

      const img = new Image()
      const isAccessible = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⏱️ [IMAGE_EDITOR] URL test timeout (5s)`)
          resolve(false)
        }, 5000)

        img.onload = () => {
          clearTimeout(timeout)
          console.log(`✅ [IMAGE_EDITOR] URL is accessible`)
          resolve(true)
        }

        img.onerror = () => {
          clearTimeout(timeout)
          console.warn(`❌ [IMAGE_EDITOR] URL failed to load`)
          resolve(false)
        }

        img.src = url
      })

      return isAccessible
    } catch (error) {
      console.error(`❌ [IMAGE_EDITOR] Error testing URL:`, error)
      return false
    }
  }, [])

  const clearEditProcessingState = useCallback(() => {
    if (editFallbackTimerRef.current) {
      clearTimeout(editFallbackTimerRef.current)
      editFallbackTimerRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setLoading(false)
    loadingRef.current = false
    setCurrentEditId(null)
    currentEditIdRef.current = null
  }, [])

  // Função para abrir modal com validação robusta de URL
  const openModalWithValidation = useCallback(async (
    temporaryUrl: string | null,
    permanentUrl: string | null
  ) => {
    console.log('🎯 [IMAGE_EDITOR] ===== MODAL VALIDATION START =====')
    console.log('🎯 [IMAGE_EDITOR] URLs:', {
      temp: temporaryUrl?.substring(0, 100),
      perm: permanentUrl?.substring(0, 100)
    })

    // Use primeira URL disponível
    const urlToUse = temporaryUrl || permanentUrl

    if (urlToUse) {
      // Update preview state PRIMEIRO
      setPreviewMedia({ url: urlToUse, type: 'image' })
      setIsPreviewLightboxOpen(false)

      // CRITICAL: Limpar loading DEPOIS de atualizar preview
      // Aguardar um frame para garantir que o preview renderizou
      await new Promise(resolve => setTimeout(resolve, 100))
      clearEditProcessingState()

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })

      clearForm()
      invalidateBalance()

      // Clear prompt from IndexedDB after successful generation
      savePromptToIndexedDB('editor_prompt', '')

      console.log('✅ [IMAGE_EDITOR] Preview updated successfully with URL:', urlToUse.substring(0, 100))
    } else {
      console.error('❌ [IMAGE_EDITOR] NO URL AVAILABLE')
      clearEditProcessingState()

      addToast({
        title: "Aviso",
        description: "Imagem processada mas ainda não disponível. Verifique a galeria em alguns instantes.",
        type: "warning"
      })
    }
  }, [addToast, clearForm, clearEditProcessingState, invalidateBalance])

  const triggerEditFallback = useCallback(async (editId: string) => {
    console.warn('⏱️ [IMAGE_EDITOR] Fallback triggered after 120s timeout', { editId })

    try {
      // Tentar buscar do histórico
      const response = await fetch(`/api/edit-history/${editId}`)
      if (response.ok) {
        const payload = await response.json()
        const editedUrl = payload?.editHistory?.editedImageUrl || null
        if (editedUrl) {
          console.log('✅ [IMAGE_EDITOR] Fallback located edit URL, opening preview now')
          await openModalWithValidation(editedUrl, editedUrl)
          invalidateBalance()
          return
        }
      }

      // NÃO limpar loading - apenas avisar usuário que está demorando
      // SSE ainda pode chegar e completar normalmente
      console.warn('⚠️ [IMAGE_EDITOR] Fallback: still waiting for SSE, keeping loading active')

      addToast({
        title: "Ainda processando...",
        description: "A geração está demorando mais que o esperado. Por favor aguarde, você será notificado quando concluir.",
        type: "info"
      })
    } catch (error) {
      console.error('❌ [IMAGE_EDITOR] Fallback error:', error)

      // Só avisar, não limpar loading
      addToast({
        title: "Processando...",
        description: "A geração está em andamento. Por favor aguarde.",
        type: "info"
      })
    }
  }, [openModalWithValidation, invalidateBalance, addToast])

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
      console.error('❌ [IMAGE_EDITOR] Failed to download preview:', error)
      addToast({
        title: 'Falha no download',
        description: 'Não foi possível baixar a imagem gerada. Tente novamente.',
        type: 'error'
      })
    }
  }, [previewMedia, addToast])

  // Monitor async processing via SSE - use useCallback to ensure stable reference
  const handleGenerationStatusChange = useCallback((generationId: string, status: string, data: any) => {
    console.log('🔔 [IMAGE_EDITOR] ========== SSE EVENT RECEIVED ==========')
    console.log('🔔 [IMAGE_EDITOR] Current monitoring editId:', currentEditIdRef.current)
    console.log('🔔 [IMAGE_EDITOR] SSE event generationId:', generationId)
    console.log('🔔 [IMAGE_EDITOR] SSE event status:', status)
    console.log('🔔 [IMAGE_EDITOR] SSE event data.editHistoryId:', data.editHistoryId)
    console.log('🔔 [IMAGE_EDITOR] SSE event data.generationId:', data.generationId)
    console.log('🔔 [IMAGE_EDITOR] Current loading state:', loadingRef.current)
    console.log('🔔 [IMAGE_EDITOR] Full SSE data:', JSON.stringify(data, null, 2))
    
    // Check if this is our edit (by editHistoryId or generationId matching currentEditId)
    // IMPORTANT: The webhook broadcasts with editHistory.id as generationId, so we need to match on that
    // But the generation created might also broadcast with its own ID, so we check metadata.editHistoryId too
    const isOurEdit = currentEditIdRef.current && (
      generationId === currentEditIdRef.current || 
      data.editHistoryId === currentEditIdRef.current ||
      data.generationId === currentEditIdRef.current ||
      // Check if metadata contains editHistoryId
      (data.metadata && typeof data.metadata === 'object' && 'editHistoryId' in data.metadata && data.metadata.editHistoryId === currentEditIdRef.current) ||
      // Also check if the generationId in the SSE matches the editHistoryId we're monitoring (for backwards compatibility)
      (typeof generationId === 'string' && generationId.includes(currentEditIdRef.current)) ||
      (typeof data.generationId === 'string' && data.generationId.includes(currentEditIdRef.current))
    )
    
    console.log('🔍 [IMAGE_EDITOR] Matching check:', {
      currentEditId: currentEditIdRef.current,
      generationId,
      dataEditHistoryId: data.editHistoryId,
      dataGenerationId: data.generationId,
      metadataEditHistoryId: data.metadata?.editHistoryId,
      matchGenerationId: generationId === currentEditIdRef.current,
      matchEditHistoryId: data.editHistoryId === currentEditIdRef.current,
      matchDataGenerationId: data.generationId === currentEditIdRef.current,
      matchMetadataEditHistoryId: data.metadata?.editHistoryId === currentEditIdRef.current,
      isOurEdit,
      currentLoadingState: loadingRef.current
    })
    
    if (isOurEdit) {
          console.log('🎯 [IMAGE_EDITOR] SSE update matched our edit:', {
            generationId,
            status,
            hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
            hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0),
            editHistoryId: data.editHistoryId,
            imageUrls: data.imageUrls,
            temporaryUrls: data.temporaryUrls
          })
          
          // Accept multiple status formats from different sources:
          // - Replicate webhook: 'succeeded' (lowercase)
          // - Backend/database: 'COMPLETED', 'COMPLETE' (uppercase)
          const normalizedStatus = (status || '').toUpperCase()
          const isCompleted = normalizedStatus === 'COMPLETED' ||
                             normalizedStatus === 'COMPLETE' ||
                             normalizedStatus === 'SUCCEEDED' ||
                             status === 'succeeded' || // Replicate format
                             status === 'completed' ||
                             status === 'COMPLETED'

          console.log('🔍 [IMAGE_EDITOR] ===== CHECKING COMPLETION STATUS =====')
          console.log('🔍 [IMAGE_EDITOR] Status check details:', {
            originalStatus: status,
            statusType: typeof status,
            normalizedStatus,
            isCompleted,
            hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
            hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0),
            imageUrlsCount: data.imageUrls?.length || 0,
            temporaryUrlsCount: data.temporaryUrls?.length || 0,
            willOpenModal: isCompleted && (data.imageUrls || data.temporaryUrls)
          })
          console.log('🔍 [IMAGE_EDITOR] ===================================')

          if (isCompleted && (data.imageUrls || data.temporaryUrls)) {
            // Extract URLs: temporary for quick display, permanent as fallback
            const temporaryUrl = data.temporaryUrls && data.temporaryUrls.length > 0
              ? data.temporaryUrls[0]
              : null
            const permanentUrl = data.imageUrls && data.imageUrls.length > 0
              ? data.imageUrls[0]
              : null
            
            // CRITICAL: Log FULL URLs to verify they're not truncated
            console.log('✅ [IMAGE_EDITOR] SSE update received with URLs (FULL):', {
              hasTemporaryUrl: !!temporaryUrl,
              hasPermanentUrl: !!permanentUrl,
              temporaryUrl: temporaryUrl, // FULL URL
              temporaryUrlLength: temporaryUrl?.length || 0,
              permanentUrl: permanentUrl, // FULL URL
              permanentUrlLength: permanentUrl?.length || 0,
              temporaryUrlPreview: temporaryUrl?.substring(0, 100) + '...',
              permanentUrlPreview: permanentUrl?.substring(0, 100) + '...',
              allTemporaryUrls: data.temporaryUrls,
              allImageUrls: data.imageUrls
            })
            
            if (temporaryUrl || permanentUrl) {
              console.log('🚀 [IMAGE_EDITOR] Calling openModalWithValidation...')

              // CRITICAL: Limpar fallback timer imediatamente quando SSE chegar
              if (editFallbackTimerRef.current) {
                clearTimeout(editFallbackTimerRef.current)
                editFallbackTimerRef.current = null
                console.log('✅ [IMAGE_EDITOR] Fallback timer cleared - SSE arrived in time')
              }

              // Use validation function to open modal (async, fire and forget)
              openModalWithValidation(temporaryUrl, permanentUrl).then(() => {
                console.log('✅ [IMAGE_EDITOR] Modal opened successfully')
              }).catch((error) => {
                console.error('❌ [IMAGE_EDITOR] Error opening modal with validation:', error)
                clearEditProcessingState()
              })
            } else {
              console.warn('⚠️ [IMAGE_EDITOR] SSE update has COMPLETED status but no image URLs')
              clearEditProcessingState()
            }
          } else if (status === 'FAILED' || status === 'failed') {
            setError(data.errorMessage || 'Erro ao processar imagem')
            clearEditProcessingState() // Clear loading state
            addToast({
              title: "Erro",
              description: data.errorMessage || 'Erro ao processar imagem',
              type: "error"
            })
          } else {
            const normalizedStatus = (status || '').toUpperCase()
            const isCompleted = normalizedStatus === 'COMPLETED' || 
                               normalizedStatus === 'COMPLETE' || 
                               normalizedStatus === 'SUCCEEDED' ||
                               status === 'succeeded' ||
                               status === 'completed'
            console.log(`⏳ [IMAGE_EDITOR] Status ${status} (normalized: ${normalizedStatus}) - NOT completed or no URLs yet`, {
              isCompleted,
              hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
              hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0)
            })
          }
        } else {
          console.log('⏭️ [IMAGE_EDITOR] SSE event not for our edit, ignoring', {
            generationId,
            currentEditId: currentEditIdRef.current,
            dataEditHistoryId: data.editHistoryId,
            dataGenerationId: data.generationId
          })
        }
  }, [addToast, openModalWithValidation, clearEditProcessingState])
  
  useRealtimeUpdates({
    onGenerationStatusChange: handleGenerationStatusChange
  })

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Cleanup fallback timer and polling on unmount
  useEffect(() => {
    return () => {
      if (editFallbackTimerRef.current) {
        clearTimeout(editFallbackTimerRef.current)
        editFallbackTimerRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  // CRITICAL: Polling de fallback para garantir atualização mesmo se SSE falhar
  // Monitora o status do edit atual a cada 5 segundos enquanto está processando
  useEffect(() => {
    if (!currentEditId || !loading) {
      // Não está processando, limpar polling se existir
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    console.log('🔄 [IMAGE_EDITOR] Starting status polling for edit:', currentEditId)

    // Verificar status imediatamente
    checkEditStatus(currentEditId)

    // Iniciar polling a cada 5 segundos
    pollingIntervalRef.current = setInterval(() => {
      if (currentEditIdRef.current && loadingRef.current) {
        checkEditStatus(currentEditIdRef.current)
      } else {
        // Estado mudou, limpar polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }, 5000) // Polling a cada 5 segundos

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [currentEditId, loading])

  // Função para verificar status do edit via API
  const checkEditStatus = useCallback(async (editId: string) => {
    try {
      console.log('🔍 [IMAGE_EDITOR] Polling edit status for:', editId)

      const response = await fetch(`/api/edit-history/${editId}`)
      if (!response.ok) {
        console.warn('⚠️ [IMAGE_EDITOR] Failed to fetch edit status:', response.status)
        return
      }

      const data = await response.json()
      const editHistory = data.editHistory

      if (!editHistory) {
        console.warn('⚠️ [IMAGE_EDITOR] No edit history in response')
        return
      }

      console.log('📊 [IMAGE_EDITOR] Edit status poll result:', {
        editId,
        status: editHistory.metadata?.status || editHistory.status,
        hasEditedUrl: !!editHistory.editedImageUrl,
        editedUrl: editHistory.editedImageUrl?.substring(0, 100)
      })

      // Verificar se completou
      const status = editHistory.metadata?.status || editHistory.status
      if (status === 'COMPLETED' && editHistory.editedImageUrl) {
        console.log('✅ [IMAGE_EDITOR] Polling detected completion! Opening modal...')

        // Limpar polling e fallback timer
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        if (editFallbackTimerRef.current) {
          clearTimeout(editFallbackTimerRef.current)
          editFallbackTimerRef.current = null
        }

        // Abrir modal com a imagem
        await openModalWithValidation(editHistory.editedImageUrl, editHistory.editedImageUrl)
        invalidateBalance()
      } else if (status === 'FAILED') {
        console.error('❌ [IMAGE_EDITOR] Polling detected failure')
        clearEditProcessingState()

        addToast({
          title: "Erro na geração",
          description: editHistory.metadata?.errorMessage || "Ocorreu um erro ao processar a imagem",
          type: "error"
        })
      }
    } catch (error) {
      console.error('❌ [IMAGE_EDITOR] Error polling edit status:', error)
      // Não fazer nada - próximo polling tentará novamente
    }
  }, [openModalWithValidation, invalidateBalance, clearEditProcessingState, addToast])

  // CRITICAL: useCallback DEVE vir ANTES de qualquer early return
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(async (file) => {
      // Verificar limite total de imagens (Nano Banana Pro: max 14)
      if (images.length >= 14) {
        addToast({
          title: "Limite atingido",
          description: "Máximo 14 imagens por vez",
          type: "error"
        })
        return
      }

      // Verificar tamanho do arquivo (limite 10MB por imagem)
      const maxFileSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxFileSize) {
        console.warn(`⚠️ Arquivo muito grande (${Math.round(file.size / 1024 / 1024)}MB), tentando comprimir...`)

        // Tentar comprimir a imagem automaticamente
        try {
          const compressedFile = await compressImage(file, maxFileSize)
          processImageFile(compressedFile)

          addToast({
            title: "Imagem comprimida",
            description: `Imagem original muito grande (${Math.round(file.size / 1024 / 1024)}MB), foi comprimida para ${Math.round(compressedFile.size / 1024 / 1024)}MB`,
            type: "info"
          })
        } catch (compressionError) {
          console.error('❌ Falha na compressão:', compressionError)
          addToast({
            title: "Arquivo muito grande",
            description: `Tamanho: ${Math.round(file.size / 1024 / 1024)}MB. Limite: 10MB por imagem. Tente reduzir a resolução ou usar um editor de imagens.`,
            type: "error"
          })
        }
        return
      }

      // Arquivo dentro do limite, processar normalmente
      processImageFile(file)
    })

    // Função auxiliar para processar arquivo de imagem
    function processImageFile(file: File) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string
        setImages(prev => {
          if (prev.length >= 14) {
            return prev
          }
          return [...prev, base64Image]
        })
        // CRITICAL: Also store the File object for FormData submission
        setImageFiles(prev => {
          if (prev.length >= 14) {
            return prev
          }
          return [...prev, file]
        })

        // Queue file for batch save
        pendingSaveRef.current.push(file)

        // Debounced save after all files processed
        setTimeout(async () => {
          if (pendingSaveRef.current.length > 0) {
            const currentImages = imageFiles.length > 0 ? imageFiles : await loadFilesFromIndexedDB('editor_uploadedImages')
            const allFiles = [...currentImages, ...pendingSaveRef.current]
            await saveFilesToIndexedDB('editor_uploadedImages', allFiles)
            await touchDraft('editor') // Update timestamp for GC
            console.log(`✅ [Editor] Saved ${pendingSaveRef.current.length} files to IndexedDB. Total: ${allFiles.length}`)
            pendingSaveRef.current = []
          }
        }, 500) // Give time for all files to be queued
      }
      reader.onerror = () => {
        addToast({
          title: "Erro ao carregar imagem",
          description: "Não foi possível ler o arquivo. Tente novamente.",
          type: "error"
        })
      }
      reader.readAsDataURL(file)
    }

    // Função para comprimir imagem
    async function compressImage(file: File, maxSize: number): Promise<File> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (e) => {
          const img = new Image()
          img.src = e.target?.result as string

          img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height

            // Reduzir dimensões se necessário (manter aspect ratio)
            const maxDimension = 4096 // Nano Banana Pro max: 4096x4096
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension
                width = maxDimension
              } else {
                width = (width / height) * maxDimension
                height = maxDimension
              }
            }

            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('Failed to get canvas context'))
              return
            }

            ctx.drawImage(img, 0, 0, width, height)

            // Tentar diferentes qualidades até ficar abaixo do limite
            let quality = 0.9
            const tryCompress = () => {
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to compress image'))
                    return
                  }

                  // Se ainda está muito grande e quality pode ser reduzida
                  if (blob.size > maxSize && quality > 0.1) {
                    quality -= 0.1
                    tryCompress()
                    return
                  }

                  // Se ficou dentro do limite ou já tentamos o suficiente
                  if (blob.size <= maxSize || quality <= 0.1) {
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    })
                    resolve(compressedFile)
                  } else {
                    reject(new Error('Could not compress image enough'))
                  }
                },
                'image/jpeg',
                quality
              )
            }

            tryCompress()
          }

          img.onerror = () => {
            reject(new Error('Failed to load image for compression'))
          }
        }

        reader.onerror = () => {
          reject(new Error('Failed to read file for compression'))
        }
      })
    }
  }, [images.length, addToast])
  
  // CRITICAL: AGORA sim podemos fazer early returns após TODOS os hooks
  // Durante loading, mostrar loading state (não bloquear)
  // A página server-side já garantiu que há sessão válida
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Se não autenticado após loading, aguardar (página server-side já verificou)
  // Retornar null só se realmente não autenticado (proteção extra)
  if (status === 'unauthenticated' || !session?.user) {
    // Em caso de perda de sessão, aguardar um momento antes de redirecionar
    // (pode ser um problema temporário de hidratação)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  const removeImage = async (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImageFiles(prev => {
      const updatedFiles = prev.filter((_, i) => i !== index)
      // Save updated files to IndexedDB
      saveFilesToIndexedDB('editor_uploadedImages', updatedFiles)
      touchDraft('editor') // Update timestamp for GC
      return updatedFiles
    })
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt)
    addToast({
      title: "Copiado!",
      description: "Prompt copiado para a área de transferência",
      type: "success"
    })
  }

  const handleSubmit = async () => {
    // Check if user has enough credits
    if (!canUseCredits) {
      addToast({
        title: "Créditos Insuficientes",
        description: `Você precisa de ${creditsNeeded} créditos, mas tem apenas ${currentCredits}`,
        type: "error"
      })
      return
    }

    if (!images.length && !prompt.trim()) {
      addToast({
        title: "Erro",
        description: "Adicione uma imagem ou descreva o que deseja fazer",
        type: "error"
      })
      return
    }

    // CRITICAL: Set loading state BEFORE async operation
    console.log('🚀 [IMAGE_EDITOR] Starting submit, setting loading to true')
    setLoading(true)
    loadingRef.current = true
    setError(null)
    
    // Force a small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 0))

    try {
      // SOLUTION: Upload images directly to R2 using presigned URLs
      // This bypasses Vercel's 4.5MB body limit
      const imageUrls: string[] = []

      // IMPORTANT: Handle both Files (new uploads) and URLs (from gallery)
      if (imageFiles.length > 0) {
        console.log('☁️ [IMAGE_EDITOR] Uploading images directly to R2...')

        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i]

          // Step 1: Get presigned URL from API
          const presignedResponse = await fetch('/api/upload/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              category: 'edited'
            })
          })

          if (!presignedResponse.ok) {
            throw new Error('Failed to get presigned URL')
          }

          const { data } = await presignedResponse.json()

          // Step 2: Upload directly to R2 using presigned URL
          const uploadResponse = await fetch(data.presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
          })

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image ${i + 1}`)
          }

          // Step 3: Store public URL
          imageUrls.push(data.publicUrl)
          console.log(`✅ [IMAGE_EDITOR] Image ${i + 1} uploaded:`, data.publicUrl.substring(0, 50))
        }
      } else if (images.length > 0) {
        // User loaded image from gallery or URL - use existing URLs
        console.log('🔗 [IMAGE_EDITOR] Using existing image URLs from gallery')
        for (const imageUrl of images) {
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            imageUrls.push(imageUrl)
            console.log(`✅ [IMAGE_EDITOR] Using existing URL:`, imageUrl.substring(0, 50))
          } else {
            console.warn('⚠️ [IMAGE_EDITOR] Skipping non-HTTP URL (probably data URL):', imageUrl.substring(0, 50))
          }
        }
      }

      // Send only URLs to API (no files in body)
      const requestBody = {
        operation,
        prompt,
        aspectRatio,
        resolution,
        imageUrls // Array of R2 URLs
      }

      // CRITICAL VALIDATION: Ensure no data URLs are being sent
      const hasDataUrls = imageUrls.some(url => url.startsWith('data:'))
      if (hasDataUrls) {
        console.error('❌ [IMAGE_EDITOR] CRITICAL: Data URLs detected in imageUrls!')
        console.error('❌ [IMAGE_EDITOR] This will cause E006 error on Replicate')
        console.error('❌ [IMAGE_EDITOR] URLs:', imageUrls.map(u => u.substring(0, 60)))
        throw new Error('Invalid URLs: data URLs are not supported. Images must be uploaded to R2 first.')
      }

      console.log('📤 [IMAGE_EDITOR] Sending request with image URLs:', {
        imageCount: imageUrls.length,
        operation,
        prompt: prompt.substring(0, 50),
        aspectRatio,
        resolution,
        urlPreviews: imageUrls.map(url => url.substring(0, 60) + '...')
      })

      const response = await fetch('/api/ai/image-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar imagem')
      }

      const data = await response.json()
      
      // Check if processing is async (webhook-enabled)
      // Status can be 'processing', 'starting', or the response has async: true
      if (data.async || (data.data && (data.data.status === 'processing' || data.data.status === 'starting'))) {
        console.log('📡 [IMAGE_EDITOR] Async processing started, waiting for webhook:', {
          predictionId: data.predictionId,
          editHistoryId: data.data?.editHistoryId,
          status: data.data?.status,
          async: data.async,
          fullResponse: data,
          currentLoadingState: loading,
          loadingRefState: loadingRef.current
        })
        
        // CRITICAL: Ensure loading state is true (double-check)
        if (!loadingRef.current) {
          console.warn('⚠️ [IMAGE_EDITOR] Loading ref was false, setting to true')
          setLoading(true)
          loadingRef.current = true
        }
        if (!loading) {
          console.warn('⚠️ [IMAGE_EDITOR] Loading state was false, setting to true')
          setLoading(true)
          loadingRef.current = true
        }
        
        addToast({
          title: "Processando...",
          description: "Sua imagem está sendo processada, você será notificado quando estiver pronta",
          type: "info"
        })
        
        // Store editHistoryId to monitor via SSE
        if (data.data?.editHistoryId) {
          const editId = data.data.editHistoryId
          setCurrentEditId(editId)
          currentEditIdRef.current = editId
          if (editFallbackTimerRef.current) {
            clearTimeout(editFallbackTimerRef.current)
          }
          // CRITICAL FIX: Aumentar timeout de 2 min para 15 min (900 segundos)
          // Modelos complexos (Nano Banana 4K) podem demorar 10-15 minutos
          editFallbackTimerRef.current = setTimeout(() => {
            if (!currentEditIdRef.current) return
            triggerEditFallback(currentEditIdRef.current)
          }, 900000) // 900 segundos = 15 minutos (era 120s = 2 min)
          console.log('✅ [IMAGE_EDITOR] ===== MONITORING EDIT VIA SSE =====')
          console.log('✅ [IMAGE_EDITOR] Edit History ID:', editId)
          console.log('✅ [IMAGE_EDITOR] ID Length:', editId.length)
          console.log('✅ [IMAGE_EDITOR] ID Type:', typeof editId)
          console.log('✅ [IMAGE_EDITOR] First 10 chars:', editId.substring(0, 10))
          console.log('✅ [IMAGE_EDITOR] Last 10 chars:', editId.substring(editId.length - 10))
          console.log('✅ [IMAGE_EDITOR] Full ID:', editId)
          console.log('✅ [IMAGE_EDITOR] Will match SSE events where generationId === this ID')
          console.log('✅ [IMAGE_EDITOR] =====================================')
          // CRITICAL: Keep loading state true - will be cleared when SSE completes
          console.log('⏳ [IMAGE_EDITOR] Keeping loading state active until SSE completion')
        } else {
          console.warn('⚠️ [IMAGE_EDITOR] No editHistoryId in response, cannot monitor via SSE')
          clearEditProcessingState() // Only clear loading if we can't monitor
          loadingRef.current = false
        }
        
        // Don't clear form yet - will be cleared when webhook completes
        // Loading state will be cleared when SSE completes (see SSE handler)
        return
      }
      
      // Synchronous processing (no webhook or completed immediately)
      // Use temporary URL for modal (faster display), permanent URL for gallery
      const temporaryUrl = data.temporaryUrl || data.data?.temporaryUrl || data.resultImage
      const permanentUrl = data.resultUrl || data.data?.resultImage || data.resultImage

      console.log('✅ [IMAGE_EDITOR] Image processed successfully (SYNC):', {
        hasTemporaryUrl: !!temporaryUrl,
        hasPermanentUrl: !!permanentUrl,
        temporaryUrl: temporaryUrl?.substring(0, 100) + '...',
        permanentUrl: permanentUrl?.substring(0, 100) + '...',
        fullResponse: data
      })

      // Use temporary URL for modal (faster), fallback to permanent if no temporary
      const modalUrl = temporaryUrl || permanentUrl

      if (!modalUrl) {
        throw new Error('URL da imagem não foi retornada pela API')
      }

      // CRITICAL: Atualizar preview ANTES de limpar loading
      setPreviewMedia({ url: modalUrl, type: 'image' })
      setIsPreviewLightboxOpen(false)

      console.log('✅ [IMAGE_EDITOR] Inline preview updated with', temporaryUrl ? 'temporary URL' : 'permanent URL')

      // Aguardar um momento para garantir que preview renderizou
      await new Promise(resolve => setTimeout(resolve, 100))

      // Agora sim limpar loading
      clearEditProcessingState()
      loadingRef.current = false

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })

      clearForm()
      invalidateBalance()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      clearEditProcessingState()
      loadingRef.current = false
      addToast({
        title: "Erro",
        description: errorMessage,
        type: "error"
      })
    } finally {
      if (!loadingRef.current) {
        clearEditProcessingState()
      }
    }
  }

  const canProcess = (prompt.trim() || images.length > 0) && !loading

  // Função para selecionar preset
  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'free') {
      // Modo livre: limpa preset e prompt
      setSelectedPreset(null)
      setPrompt('')
    } else {
      // Seleciona preset e preenche prompt
      const preset = EDITOR_PRESETS.find(p => p.id === presetId)
      if (preset) {
        setSelectedPreset(presetId)
        setPrompt(preset.promptBase)
      }
    }
  }

  // Get current preset data
  const currentPreset = selectedPreset ? EDITOR_PRESETS.find(p => p.id === selectedPreset) : null

  // Mobile Layout - ChatGPT style
  if (isMobile) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-4 py-0">
          {/* Mobile: Info Card - Similar to desktop */}
          <div className="mb-4">
            <Card className="border-[#2C3E50] bg-[#2C3E50] rounded-lg shadow-lg">
              <CardContent className="p-4">
                <div className="text-sm text-white leading-relaxed font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  <h3 className="text-base font-bold text-white mb-3">
                    Como Funciona o Studio IA
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-200">
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Envie de 1 a 14 imagens: use 1 para editar (adicionar, remover ou alterar algo) ou até 14 para combinar e criar uma nova composição</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Você também pode criar imagens do zero! Basta digitar sua ideia no prompt e gerar, sem precisar anexar nenhuma imagem</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span><strong>Use os atalhos:</strong> templates prontos para melhorar fotos, criar banners, experimentar roupas e muito mais. Clique e veja o poder da ferramenta!</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile: Atalhos Section - Com profundidade */}
          <div className="mb-4">
            <div className="mb-2">
              <h4 className="text-sm font-semibold text-gray-800">Atalhos</h4>
              <p className="text-xs text-gray-600">Escolha um atalho e gere mais rápido</p>
            </div>

            {/* Atalhos Horizontal Scroll - Com sombra */}
            <div className="flex gap-2.5 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
              {EDITOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedPreset === preset.id
                      ? 'bg-gradient-to-b from-gray-800 to-gray-900 text-white shadow-lg shadow-gray-400/50'
                      : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
                  }`}
                >
                  {preset.title}
                </button>
              ))}
            </div>

            {/* Modo Livre - Separado */}
            <div className="flex items-center gap-2 pt-3 border-t border-gray-200 mt-2">
              <button
                onClick={() => handlePresetSelect('free')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedPreset === null
                    ? 'bg-gradient-to-b from-gray-700 to-gray-800 text-white shadow-lg shadow-gray-400/50'
                    : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
                }`}
              >
                {FREE_MODE_PRESET.title}
              </button>
              <span className="text-xs text-gray-500">ou escreva seu prompt</span>
            </div>

            {/* Helper Text - Mobile destacado */}
            {currentPreset && (
              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  {currentPreset.instruction}
                </p>
                {(currentPreset.id === 'banner' || currentPreset.id === 'interior') && (
                  <p className="text-xs text-blue-700">
                    💡 Edite o prompt para personalizar
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Mobile: Single prompt box centered */}
          <div className="space-y-3">
            {/* Prompt Input - ChatGPT style with gray theme */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Descrição
                </label>
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-gray-600">
                    {prompt.length}/4000
                  </div>
                  {prompt && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrompt('')}
                        className="h-6 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                        title="Limpar prompt"
                      >
                        Limpar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyPrompt}
                        className="h-6 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-300"
                        title="Copiar prompt"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="relative">
                <Textarea
                  placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] rounded-lg px-4 py-4 pr-40 transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                  style={{
                    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                  }}
                />
                <PromptOptimizer
                  currentPrompt={prompt}
                  onOptimizedPrompt={setPrompt}
                  type="image"
                  variant="inline"
                />
              </div>

              {/* Banner de Créditos Insuficientes */}
              {!canUseCredits && (
                <div className="mt-3">
                  <InsufficientCreditsBanner
                    creditsNeeded={creditsNeeded}
                    currentCredits={currentCredits}
                    feature="edit"
                    variant="inline"
                    onBuyCredits={() => setShowCreditPurchase(true)}
                  />
                </div>
              )}
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formato
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                className="w-full p-2 bg-gray-200 border border-gray-900 rounded text-gray-900 text-sm focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20"
              >
                <option value="1:1">Quadrado (1:1)</option>
                <option value="4:3">Padrão (4:3)</option>
                <option value="3:4">Retrato (3:4)</option>
                <option value="9:16">Vertical (9:16)</option>
                <option value="16:9">Paisagem (16:9)</option>
              </select>
            </div>

            {/* 4K Resolution Option */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resolution === '4k'}
                  onChange={(e) => setResolution(e.target.checked ? '4k' : 'standard')}
                  className="w-4 h-4 rounded border-gray-300 text-[#667EEA] focus:ring-[#667EEA]"
                />
                <span className="text-sm text-gray-700">
                  Gerar em 4K
                </span>
              </label>
            </div>

            {/* Upload and Process Buttons - Side by side, smaller */}
            <div className="flex flex-row items-center gap-2">
              <Button
                asChild
                type="button"
                variant="outline"
                disabled={images.length >= 14 || loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <label htmlFor={fileInputId} className="flex items-center justify-center w-full cursor-pointer">
                  <ImageIcon className="w-3 h-3 mr-1.5" />
                  {images.length > 0 ? `${images.length}/14 imagens` : 'Adicionar imagens'}
                </label>
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canProcess || loading || !canUseCredits}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {isMobile ? `Gerar (${getEditorCost(resolution)} créditos)` : `Gerar Foto (${getEditorCost(resolution)} créditos)`}
                  </>
                )}
              </Button>
            </div>
            
            {/* Processing Message - Mobile */}
            <ProcessingMessage 
              isProcessing={loading} 
              type="editor" 
            />
            
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/*"
              multiple={true}
              onChange={handleImageUpload}
              className="sr-only"
            />

            {/* Uploaded Images Preview */}
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <div key={index} className="relative flex-shrink-0">
                    <img
                      src={image}
                      alt={`Imagem ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600 font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Preview inline */}
          {previewMedia && (
            <div className="mt-6">
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
      </div>
    )
  }

  // Desktop Layout - ChatGPT style with white background
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Features Card - Dark theme, similar to attached image */}
        <div className="mb-6">
          <Card className="border-[#2C3E50] bg-[#2C3E50] rounded-lg shadow-lg">
            <CardContent className="p-4">
              <div className="text-sm text-white leading-relaxed font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                <h3 className="text-base font-bold text-white mb-3">
                  Como Funciona o Studio IA
                </h3>
                <ul className="space-y-2 text-sm text-gray-200 mb-4">
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span>Envie de 1 a 14 imagens: use 1 para editar (adicionar, remover ou alterar algo) ou até 14 para combinar e criar uma nova composição</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span>Você também pode criar imagens do zero! Basta digitar sua ideia no prompt e gerar, sem precisar anexar nenhuma imagem</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Use os atalhos:</strong> templates prontos para melhorar fotos, criar banners, experimentar roupas e muito mais. Clique e veja o poder da ferramenta!</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Atalhos Section - Com profundidade */}
        <div className="mb-6">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-800">Atalhos</h4>
            <p className="text-xs text-gray-600">Escolha um atalho e gere mais rápido</p>
          </div>

          {/* Atalhos Grid - Com sombra e profundidade */}
          <div className="flex flex-wrap gap-2.5 mb-4">
            {EDITOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-gradient-to-b from-gray-800 to-gray-900 text-white shadow-lg shadow-gray-400/50 scale-105'
                    : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5'
                }`}
              >
                {preset.title}
              </button>
            ))}
          </div>

          {/* Modo Livre - Separado */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            <button
              onClick={() => handlePresetSelect('free')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset === null
                  ? 'bg-gradient-to-b from-gray-700 to-gray-800 text-white shadow-lg shadow-gray-400/50 scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5'
              }`}
            >
              {FREE_MODE_PRESET.title}
            </button>
            <span className="text-xs text-gray-500">ou escreva seu próprio prompt</span>
          </div>

          {/* Helper Text - Mais destacado */}
          {currentPreset && (
            <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                {currentPreset.instruction}
              </p>
              {(currentPreset.id === 'banner' || currentPreset.id === 'interior') && (
                <p className="text-xs text-blue-700">
                  💡 Lembre-se de editar o prompt para personalizar seu resultado
                </p>
              )}
            </div>
          )}
        </div>

        {/* ChatGPT Style - Centered Layout */}
        <div className="space-y-4">
          {/* Prompt Input - ChatGPT style with gray theme */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Descrição
              </label>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-600">
                  {prompt.length}/4000
                </div>
                {prompt && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrompt('')}
                      className="h-6 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                      title="Limpar prompt"
                    >
                      Limpar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyPrompt}
                      className="h-6 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-300"
                      title="Copiar prompt"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <Textarea
                placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                maxLength={4000}
                className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20 rounded-lg px-4 py-4 pr-40 shadow-sm transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
              <PromptOptimizer
                currentPrompt={prompt}
                onOptimizedPrompt={setPrompt}
                type="image"
                variant="inline"
              />
            </div>

            {/* Banner de Créditos Insuficientes */}
            {!canUseCredits && (
              <div className="mt-3">
                <InsufficientCreditsBanner
                  creditsNeeded={creditsNeeded}
                  currentCredits={currentCredits}
                  feature="edit"
                  variant="inline"
                  onBuyCredits={() => setShowCreditPurchase(true)}
                />
              </div>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
              className="w-full p-2 bg-gray-200 border border-gray-900 rounded text-gray-900 text-sm focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20"
            >
              <option value="1:1">Quadrado (1:1)</option>
              <option value="4:3">Padrão (4:3)</option>
              <option value="3:4">Retrato (3:4)</option>
              <option value="9:16">Vertical (9:16)</option>
              <option value="16:9">Paisagem (16:9)</option>
            </select>
          </div>

          {/* 4K Resolution Option */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={resolution === '4k'}
                onChange={(e) => setResolution(e.target.checked ? '4k' : 'standard')}
                className="w-4 h-4 rounded border-gray-300 text-[#667EEA] focus:ring-[#667EEA]"
              />
              <span className="text-sm text-gray-700">
                Gerar em 4K
              </span>
            </label>
          </div>

          {/* Upload and Process Buttons - Side by side, smaller */}
          <div className="flex items-center gap-3">
            <Button
              asChild
              type="button"
              variant="outline"
              disabled={images.length >= 14 || loading}
              className="flex items-center gap-2 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-3 text-sm font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              <label htmlFor={fileInputId} className="flex items-center gap-2 cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {images.length > 0 ? `${images.length}/14 imagens` : 'Adicionar imagens'}
              </label>
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canProcess || loading || !canUseCredits}
              className="flex-1 sm:flex-none sm:w-auto bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  {isMobile ? `Gerar (${getEditorCost(resolution)} créditos)` : `Gerar Foto (${getEditorCost(resolution)} créditos)`}
                </>
              )}
            </Button>
          </div>
          
          {/* Processing Message - Desktop */}
          <ProcessingMessage 
            isProcessing={loading} 
            type="editor" 
          />
          
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            multiple={true}
            onChange={handleImageUpload}
            className="sr-only"
          />

          {/* Uploaded Images Preview */}
          {images.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={image}
                    alt={`Imagem ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                {error}
              </p>
            </div>
          )}

          {previewMedia && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                Resultado recente
              </h3>
              <div
                className="relative group cursor-pointer rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-md max-w-2xl"
                onClick={() => setIsPreviewLightboxOpen(true)}
              >
                <img
                  src={previewMedia.url}
                  alt="Resultado gerado"
                  className="w-full h-auto object-cover max-h-96"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-4 py-2 bg-white/85 text-gray-900 text-sm font-semibold rounded-full">
                    Clique para ver em tela cheia
                  </span>
                </div>
              </div>
            </div>
          )}

          <Dialog open={isPreviewLightboxOpen} onOpenChange={setIsPreviewLightboxOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden p-0">
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
                    className="w-full h-auto max-h-[85vh] object-contain"
                  />
                </>
              )}
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* PackageSelectorModal */}
      <PackageSelectorModal
        isOpen={showCreditPurchase}
        onClose={() => setShowCreditPurchase(false)}
        onSuccess={() => {
          setShowCreditPurchase(false)
          invalidateBalance()
        }}
      />
    </div>
  )
}