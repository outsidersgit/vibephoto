'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
import { GenerationResultModal } from '@/components/ui/generation-result-modal'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'

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

  const [operation] = useState<Operation>('edit')
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>(preloadedImageUrl ? [preloadedImageUrl] : [])
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '9:16' | '16:9'>('1:1')
  const [showResultModal, setShowResultModal] = useState(false)
  const [currentEditId, setCurrentEditId] = useState<string | null>(null)
  const router = useRouter()
  
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
    setResult(null)
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

  // Função para abrir modal com validação de URL
  const openModalWithValidation = useCallback(async (
    temporaryUrl: string | null,
    permanentUrl: string | null
  ) => {
    console.log('🎯 [IMAGE_EDITOR] Opening modal with validation:', {
      hasTemporaryUrl: !!temporaryUrl,
      hasPermanentUrl: !!permanentUrl,
      temporaryUrl: temporaryUrl?.substring(0, 50) + '...',
      permanentUrl: permanentUrl?.substring(0, 50) + '...'
    })
    
    let urlToUse: string | null = null
    
    // Tentar URL temporária primeiro
    if (temporaryUrl) {
      console.log('🔍 [IMAGE_EDITOR] Validating temporary URL...')
      const isValid = await validateImageUrl(temporaryUrl)
      if (isValid) {
        urlToUse = temporaryUrl
        console.log('✅ [IMAGE_EDITOR] Temporary URL validated and will be used')
      } else {
        console.warn('⚠️ [IMAGE_EDITOR] Temporary URL validation failed, will try permanent URL')
      }
    }
    
    // Fallback para URL permanente
    if (!urlToUse && permanentUrl) {
      console.log('🔍 [IMAGE_EDITOR] Validating permanent URL...')
      const isValid = await validateImageUrl(permanentUrl)
      if (isValid) {
        urlToUse = permanentUrl
        console.log('✅ [IMAGE_EDITOR] Permanent URL validated and will be used')
      } else {
        console.error('❌ [IMAGE_EDITOR] Both URLs failed validation')
      }
    }
    
    if (urlToUse) {
      console.log('✅ [IMAGE_EDITOR] Opening modal with validated URL:', urlToUse.substring(0, 50) + '...')
      setResult(urlToUse)
      setShowResultModal(true)
      setCurrentEditId(null)
      currentEditIdRef.current = null
      
      // Clear loading state after a small delay to ensure modal is visible
      setTimeout(() => {
        setLoading(false)
        loadingRef.current = false
        console.log('✅ [IMAGE_EDITOR] Modal opened and loading cleared')
      }, 300)
      
      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })
      
      console.log('✅ [IMAGE_EDITOR] Toast de sucesso enviado')
    } else {
      console.error('❌ [IMAGE_EDITOR] No valid URL available')
      setCurrentEditId(null)
      currentEditIdRef.current = null
      setLoading(false)
      loadingRef.current = false
      
      addToast({
        title: "Aviso",
        description: "Imagem processada mas ainda não disponível. Verifique a galeria em alguns instantes.",
        type: "warning"
      })
    }
  }, [validateImageUrl, addToast])

  // Monitor async processing via SSE - use useCallback to ensure stable reference
  const handleGenerationStatusChange = useCallback((generationId: string, status: string, data: any) => {
    console.log('🔔 [IMAGE_EDITOR] ========== SSE EVENT RECEIVED ==========')
    console.log('🔔 [IMAGE_EDITOR] SSE event received:', {
      generationId,
      status,
      currentEditId: currentEditIdRef.current,
      dataEditHistoryId: data.editHistoryId,
      dataGenerationId: data.generationId,
      hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
      hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0),
      currentLoadingState: loadingRef.current,
      allDataKeys: Object.keys(data || {}),
      fullData: data
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
          
          // Accept multiple status formats: 'COMPLETED', 'COMPLETE', 'succeeded', 'completed'
          // Normalize status to uppercase for comparison
          const normalizedStatus = (status || '').toUpperCase()
          const isCompleted = normalizedStatus === 'COMPLETED' || 
                             normalizedStatus === 'COMPLETE' || 
                             normalizedStatus === 'SUCCEEDED' ||
                             status === 'succeeded' ||
                             status === 'completed'
          
          console.log('🔍 [IMAGE_EDITOR] Checking completion status:', {
            originalStatus: status,
            normalizedStatus,
            isCompleted,
            hasImageUrls: !!(data.imageUrls && data.imageUrls.length > 0),
            hasTemporaryUrls: !!(data.temporaryUrls && data.temporaryUrls.length > 0),
            imageUrlsCount: data.imageUrls?.length || 0,
            temporaryUrlsCount: data.temporaryUrls?.length || 0
          })
          
          if (isCompleted && (data.imageUrls || data.temporaryUrls)) {
            // Extract URLs: temporary for quick display, permanent as fallback
            const temporaryUrl = data.temporaryUrls && data.temporaryUrls.length > 0
              ? data.temporaryUrls[0]
              : null
            const permanentUrl = data.imageUrls && data.imageUrls.length > 0
              ? data.imageUrls[0]
              : null
            
            console.log('✅ [IMAGE_EDITOR] SSE update received with URLs:', {
              hasTemporaryUrl: !!temporaryUrl,
              hasPermanentUrl: !!permanentUrl,
              temporaryUrl: temporaryUrl?.substring(0, 50) + '...',
              permanentUrl: permanentUrl?.substring(0, 50) + '...'
            })
            
            if (temporaryUrl || permanentUrl) {
              console.log('🚀 [IMAGE_EDITOR] Calling openModalWithValidation...')
              // Use validation function to open modal (async, fire and forget)
              openModalWithValidation(temporaryUrl, permanentUrl).then(() => {
                console.log('✅ [IMAGE_EDITOR] Modal opened successfully')
              }).catch((error) => {
                console.error('❌ [IMAGE_EDITOR] Error opening modal with validation:', error)
                setLoading(false)
                loadingRef.current = false
              })
            } else {
              console.warn('⚠️ [IMAGE_EDITOR] SSE update has COMPLETED status but no image URLs')
              setLoading(false)
              loadingRef.current = false
            }
          } else if (status === 'FAILED' || status === 'failed') {
            setError(data.errorMessage || 'Erro ao processar imagem')
            setCurrentEditId(null)
            currentEditIdRef.current = null
            setLoading(false) // Clear loading state
            loadingRef.current = false
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
  }, [addToast, openModalWithValidation])
  
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
        const result = e.target?.result as string
        setImages(prev => {
          if (prev.length >= 3) {
            addToast({
              title: "Limite atingido",
              description: "Máximo 3 imagens",
              type: "error"
            })
            return prev
          }

          return [...prev, result]
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
          setCurrentEditId(data.data.editHistoryId)
          currentEditIdRef.current = data.data.editHistoryId
          console.log('✅ [IMAGE_EDITOR] Monitoring editHistoryId via SSE:', data.data.editHistoryId)
          console.log('✅ [IMAGE_EDITOR] Will match SSE events where:', {
            generationId: `=== ${data.data.editHistoryId}`,
            'data.editHistoryId': `=== ${data.data.editHistoryId}`,
            'data.generationId': `=== ${data.data.editHistoryId}`
          })
          // CRITICAL: Keep loading state true - will be cleared when SSE completes
          console.log('⏳ [IMAGE_EDITOR] Keeping loading state active until SSE completion')
        } else {
          console.warn('⚠️ [IMAGE_EDITOR] No editHistoryId in response, cannot monitor via SSE')
          setLoading(false) // Only clear loading if we can't monitor
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
      
      // Set result and open modal automatically with temporary URL
      setResult(modalUrl)
      setShowResultModal(true)
      console.log('✅ [IMAGE_EDITOR] Result URL set, opening modal automatically with', temporaryUrl ? 'temporary URL' : 'permanent URL')
      console.log('🎯 [IMAGE_EDITOR] Modal state:', {
        result: modalUrl?.substring(0, 100) + '...',
        showResultModal: true,
        hasResult: !!modalUrl
      })

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })
      
      // DON'T clear form immediately - modal needs the result URL
      // Form will be cleared when modal is closed (see onOpenChange handler)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      addToast({
        title: "Erro",
        description: errorMessage,
        type: "error"
      })
    } finally {
      setLoading(false)
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
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 3 || loading}
                className="flex-1 border border-gray-900 hover:border-[#667EEA] hover:bg-[#667EEA]/5 bg-gray-200 text-gray-900 rounded-lg py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {images.length > 0 ? `${images.length}/3` : 'Adicionar'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canProcess || loading}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Processar (15 créditos)
                  </>
                )}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={true}
              onChange={handleImageUpload}
              className="hidden"
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
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
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

          {/* Result Modal - Auto-opens when generation completes */}
          <GenerationResultModal
            open={showResultModal}
            onOpenChange={(open) => {
              setShowResultModal(open)
              if (!open) {
                // Clear form ONLY when modal is closed
                clearForm()
              }
            }}
            imageUrl={result}
            title="Imagem Processada"
            type="image"
          />
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
          <div className="flex flex-row items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 3 || loading}
              className="flex-1 border border-gray-900 hover:border-[#667EEA] hover:bg-[#667EEA]/5 bg-gray-200 text-gray-900 rounded-lg py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              <ImageIcon className="w-3 h-3 mr-1.5" />
              {images.length > 0 ? `${images.length}/3 imagens` : 'Adicionar imagem'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canProcess || loading}
              className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Processar (15 créditos)
                </>
              )}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={true}
            onChange={handleImageUpload}
            className="hidden"
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
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
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
      </div>
    </div>
  )
}