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
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useInvalidateCredits } from '@/hooks/useCredits'
import { CREDIT_COSTS } from '@/lib/credits/pricing'

const IMAGE_EDITOR_CREDIT_COST = CREDIT_COSTS.IMAGE_EDIT_PER_IMAGE

interface ImageEditorInterfaceProps {
  preloadedImageUrl?: string
  className?: string
}

type Operation = 'edit' | 'add' | 'remove' | 'style' | 'blend'

export function ImageEditorInterface({ preloadedImageUrl, className }: ImageEditorInterfaceProps) {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { data: session, status } = useSession()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentEditIdRef = useRef<string | null>(null)
  const loadingRef = useRef<boolean>(false)
  const editFallbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { invalidateBalance } = useInvalidateCredits()

  const [operation] = useState<Operation>('edit')
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>(preloadedImageUrl ? [preloadedImageUrl] : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '9:16' | '16:9'>('1:1')
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' } | null>(null)
  const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false)
  const [currentEditId, setCurrentEditId] = useState<string | null>(null)
  const router = useRouter()
  const fileInputId = useId()

  // Sync refs with state
  useEffect(() => {
    currentEditIdRef.current = currentEditId
  }, [currentEditId])
  
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])
  
  // Função para limpar todos os campos após geração bem-sucedida
  const clearForm = () => {
    setPrompt('')
    setImages([])
    setError(null)
    setCurrentEditId(null) // Clear edit monitoring
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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

    let urlToUse: string | null = null
    let urlType: 'temporary' | 'permanent' | null = null

    // 1. Test temporary URL first
    if (temporaryUrl) {
      const isAccessible = await testUrlAccessibility(temporaryUrl)
      if (isAccessible) {
        urlToUse = temporaryUrl
        urlType = 'temporary'
      }
    }

    // 2. Fallback to permanent URL
    if (!urlToUse && permanentUrl) {
      const isAccessible = await testUrlAccessibility(permanentUrl)
      if (isAccessible) {
        urlToUse = permanentUrl
        urlType = 'permanent'
      }
    }

    // 3. Open modal with validated URL
    if (urlToUse) {
      clearEditProcessingState()

      // Update preview state and ensure lightbox starts closed
      setPreviewMedia({ url: urlToUse, type: 'image' })
      setIsPreviewLightboxOpen(false)

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })

      clearForm()
      invalidateBalance()

      console.log('✅ [IMAGE_EDITOR] Preview updated successfully')
    } else {
      console.error('❌ [IMAGE_EDITOR] NO VALID URL')
      clearEditProcessingState()

      addToast({
        title: "Aviso",
        description: "Imagem processada mas ainda não disponível. Verifique a galeria em alguns instantes.",
        type: "warning"
      })
    }
  }, [addToast, testUrlAccessibility, clearForm, clearEditProcessingState, invalidateBalance])

  const triggerEditFallback = useCallback(async (editId: string) => {
    console.warn('⏱️ [IMAGE_EDITOR] Fallback triggered to force preview display', { editId })

    const fetchEditHistoryWithRetry = async (attempts = 5): Promise<string | null> => {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await fetch(`/api/edit-history/${editId}`)
          if (response.ok) {
            const payload = await response.json()
            const editedUrl = payload?.editHistory?.editedImageUrl || null
            if (editedUrl) {
              return editedUrl
            }
          } else {
            console.warn(`⚠️ [IMAGE_EDITOR] Retry ${attempt} failed with status ${response.status}`)
          }
        } catch (error) {
          console.error(`❌ [IMAGE_EDITOR] Retry ${attempt} error:`, error)
        }

        const backoff = attempt * 1500
        await new Promise(resolve => setTimeout(resolve, backoff))
      }

      return null
    }

    try {
      const fallbackUrl = await fetchEditHistoryWithRetry()
      if (fallbackUrl) {
        console.log('✅ [IMAGE_EDITOR] Fallback located edit URL, opening preview now')
        await openModalWithValidation(fallbackUrl, fallbackUrl)
        invalidateBalance()
      } else {
        console.warn('⚠️ [IMAGE_EDITOR] Fallback could not retrieve edited image URL after retries')
        clearEditProcessingState()
      }
    } catch (error) {
      console.error('❌ [IMAGE_EDITOR] Error during fallback handling:', error)
      clearEditProcessingState()
    }
  }, [clearEditProcessingState, openModalWithValidation, invalidateBalance])

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
    console.log('🔔 [IMAGE_EDITOR] SSE event received:', {
      generationId,
      status,
      statusType: typeof status,
      currentEditId: currentEditIdRef.current,
      dataEditHistoryId: data.editHistoryId,
      dataGenerationId: data.generationId,
      hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
      hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0),
      currentLoadingState: loadingRef.current,
      allDataKeys: Object.keys(data || {}),
      fullData: JSON.stringify(data, null, 2)
    })
    
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

  // Cleanup fallback timer on unmount
  useEffect(() => {
    return () => {
      if (editFallbackTimerRef.current) {
        clearTimeout(editFallbackTimerRef.current)
        editFallbackTimerRef.current = null
      }
    }
  }, [])

  // CRITICAL: useCallback DEVE vir ANTES de qualquer early return
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        addToast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo é 10MB",
          type: "error"
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Image = e.target?.result as string
        setImages(prev => {
          if (prev.length >= 3) {
            addToast({
              title: "Limite atingido",
              description: "Máximo 3 imagens",
              type: "error"
            })
            return prev
          }

          return [...prev, base64Image]
        })
      }
      reader.readAsDataURL(file)
    })
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

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
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
      const response = await fetch('/api/ai/image-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          prompt,
          images,
          aspectRatio,
        })
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
          editFallbackTimerRef.current = setTimeout(() => {
            if (!currentEditIdRef.current) return
            triggerEditFallback(currentEditIdRef.current)
          }, 15000)
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
      
      console.log('✅ [IMAGE_EDITOR] Image processed successfully:', {
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
      
      setPreviewMedia({ url: modalUrl, type: 'image' })
      setIsPreviewLightboxOpen(false)

      console.log('✅ [IMAGE_EDITOR] Inline preview updated with', temporaryUrl ? 'temporary URL' : 'permanent URL')

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })

      clearForm()

      clearEditProcessingState()
      loadingRef.current = false
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
                    Como Funciona o Editor IA
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-200">
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Envie de 1 a 3 imagens: use 1 para editar (adicionar, remover ou alterar algo) ou até 3 para combinar e criar uma nova composição</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Você também pode criar imagens do zero! Basta digitar sua ideia no prompt e gerar, sem precisar anexar nenhuma imagem</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
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
                    {prompt.length}/2500
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
              <Textarea
                placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2500}
                className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] rounded-lg px-4 py-4 transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
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

            {/* Upload and Process Buttons - Side by side, smaller */}
            <div className="flex flex-row items-center gap-2">
              <Button
                asChild
                type="button"
                variant="outline"
                disabled={images.length >= 3 || loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <label htmlFor={fileInputId} className="flex items-center justify-center w-full cursor-pointer">
                  <ImageIcon className="w-3 h-3 mr-1.5" />
                  {images.length > 0 ? `${images.length}/3` : 'Adicionar'}
                </label>
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canProcess || loading}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {isMobile ? `Gerar (${IMAGE_EDITOR_CREDIT_COST} créditos)` : `Gerar Foto (${IMAGE_EDITOR_CREDIT_COST} créditos)`}
                  </>
                )}
              </Button>
            </div>
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
                  Como Funciona o Editor IA
                </h3>
                <ul className="space-y-2 text-sm text-gray-200 mb-4">
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span>Envie de 1 a 3 imagens: use 1 para editar (adicionar, remover ou alterar algo) ou até 3 para combinar e criar uma nova composição</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span>Você também pode criar imagens do zero! Basta digitar sua ideia no prompt e gerar, sem precisar anexar nenhuma imagem</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
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
                  {prompt.length}/2500
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
            <Textarea
              placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              maxLength={2500}
              className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20 rounded-lg px-4 py-4 shadow-sm transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              style={{
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
              }}
            />
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

          {/* Upload and Process Buttons - Side by side, smaller */}
          <div className="flex items-center gap-3">
            <Button
              asChild
              type="button"
              variant="outline"
              disabled={images.length >= 3 || loading}
              className="flex items-center gap-2 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-3 text-sm font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              <label htmlFor={fileInputId} className="flex items-center gap-2 cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {images.length > 0 ? `${images.length}/3 imagens` : 'Adicionar imagens'}
              </label>
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canProcess || loading}
              className="flex-1 sm:flex-none sm:w-auto bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  {isMobile ? `Gerar (${IMAGE_EDITOR_CREDIT_COST} créditos)` : `Gerar Foto (${IMAGE_EDITOR_CREDIT_COST} créditos)`}
                </>
              )}
            </Button>
          </div>
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
    </div>
  )
}