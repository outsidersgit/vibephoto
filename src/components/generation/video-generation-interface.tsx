'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Image as ImageIcon, Video, Upload, X, Loader2, Copy, Download } from 'lucide-react'
import { VIDEO_CONFIG, VideoGenerationRequest, VideoTemplate } from '@/lib/ai/video/config'
import { calculateVideoCredits, validatePrompt, getEstimatedProcessingTime, formatProcessingTime } from '@/lib/ai/video/utils'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useInvalidateCredits, useCreditBalance } from '@/hooks/useCredits'
import { ProcessingMessage } from '@/components/ui/processing-message'

interface VideoGenerationInterfaceProps {
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
  }
  canUseCredits: boolean
  sourceImageUrl?: string
}

export function VideoGenerationInterface({ user, canUseCredits, sourceImageUrl }: VideoGenerationInterfaceProps) {
  console.log('🧭 [VIDEO_GENERATION_INTERFACE] render start')
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastFrameInputRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef(false)
  
  const [isMobile, setIsMobile] = useState(false)
  const [activeMode, setActiveMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')
  const [formData, setFormData] = useState<VideoGenerationRequest>({
    prompt: '',
    negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
    duration: VIDEO_CONFIG.defaults.duration as 4 | 6 | 8,
    aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16',
    resolution: VIDEO_CONFIG.defaults.resolution as '720p' | '1080p',
    generateAudio: VIDEO_CONFIG.defaults.generateAudio,
    quality: 'pro' as 'standard' | 'pro'
  })

  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedLastFrame, setUploadedLastFrame] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'video' } | null>(null)
  const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false)
  const [monitoringVideoId, setMonitoringVideoId] = useState<string | null>(null)
  const { invalidateBalance } = useInvalidateCredits()
  
  // CRITICAL: Use hook to fetch credit balance (handles expired credits correctly)
  const { data: creditBalance } = useCreditBalance()
  
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Auto-scroll to preview when it appears (same as image generation)
  useEffect(() => {
    if (previewMedia && previewContainerRef.current) {
      previewContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [previewMedia])

  const resetFormAfterSuccess = () => {
    setFormData({
      prompt: '',
      negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
      duration: VIDEO_CONFIG.defaults.duration as 4 | 6 | 8,
      aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16',
      resolution: VIDEO_CONFIG.defaults.resolution as '720p' | '1080p',
      generateAudio: VIDEO_CONFIG.defaults.generateAudio,
      quality: 'pro'
    })
    setSelectedTemplate(null)
    setUploadedImage(null)
    setUploadedLastFrame(null)
    setErrors([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (lastFrameInputRef.current) {
      lastFrameInputRef.current.value = ''
    }
  }
  
  // Função para validar se uma URL de vídeo está acessível
  const validateVideoUrl = useCallback(async (url: string, maxRetries = 3): Promise<boolean> => {
    console.log(`🔍 [VIDEO_GENERATION] Validating video URL (attempt 1/${maxRetries}):`, url.substring(0, 100) + '...')
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Para vídeos, tentar fazer HEAD request primeiro
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' })
        
        // Se no-cors não funciona, tentar carregar vídeo
        const video = document.createElement('video')
        video.preload = 'metadata'
        
        const isValid = await new Promise<boolean>((resolve) => {
          let resolved = false
          
          video.onloadedmetadata = () => {
            if (!resolved) {
              resolved = true
              console.log(`✅ [VIDEO_GENERATION] Video URL validated successfully (attempt ${attempt})`)
              resolve(true)
            }
          }
          
          video.onerror = () => {
            if (!resolved) {
              resolved = true
              console.warn(`⚠️ [VIDEO_GENERATION] Video URL validation failed (attempt ${attempt})`)
              resolve(false)
            }
          }
          
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              console.warn(`⏱️ [VIDEO_GENERATION] Video URL validation timeout (attempt ${attempt})`)
              resolve(false)
            }
          }, 5000)
          
          video.src = url
        })
        
        if (isValid) {
          return true
        }
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ [VIDEO_GENERATION] Retrying validation in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        console.error(`❌ [VIDEO_GENERATION] Error validating URL (attempt ${attempt}):`, error)
        if (attempt === maxRetries) {
          return false
        }
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    return false
  }, [])

  // Função para validar se vídeo está acessível
  const testVideoUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const video = document.createElement('video')
      return await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000)
        video.onloadedmetadata = () => { clearTimeout(timeout); resolve(true) }
        video.onerror = () => { clearTimeout(timeout); resolve(false) }
        video.src = url
      })
    } catch {
      return false
    }
  }, [])

  // Função para abrir modal com validação de URL
  const openModalWithValidation = useCallback(async (
    temporaryUrl: string | null,
    permanentUrl: string | null
  ) => {
    console.log('🎯 [VIDEO_GENERATION] Validating URLs for modal...')

    let urlToUse: string | null = null

    // Test temporary URL first
    if (temporaryUrl && await testVideoUrl(temporaryUrl)) {
      urlToUse = temporaryUrl
      console.log('✅ [VIDEO_GENERATION] Using temporary URL')
    } else if (permanentUrl && await testVideoUrl(permanentUrl)) {
      urlToUse = permanentUrl
      console.log('✅ [VIDEO_GENERATION] Using permanent URL')
    }

    if (urlToUse) {
      setPreviewMedia({ url: urlToUse, type: 'video' })
      setIsPreviewLightboxOpen(false)
      setMonitoringVideoId(null)

      addToast({
        type: 'success',
        title: "🎉 Vídeo pronto!",
        description: "Seu vídeo foi gerado com sucesso!",
      })

      resetFormAfterSuccess()
      loadingRef.current = false
      setLoading(false)
      invalidateBalance()
    } else {
      console.error('❌ [VIDEO_GENERATION] No valid URL')
      setMonitoringVideoId(null)
      addToast({
        type: 'warning',
        title: 'Aviso',
        description: 'Vídeo processado mas ainda não disponível. Verifique a galeria em alguns instantes.',
      })
      loadingRef.current = false
      setLoading(false)
    }
  }, [addToast, testVideoUrl, resetFormAfterSuccess, invalidateBalance])
  
  // Monitor video generation status and open modal when completed
  const monitorVideoGeneration = (videoId: string) => {
    setMonitoringVideoId(videoId)
    
    const checkStatus = async () => {
      try {
        // Fetch video status from API
        const response = await fetch(`/api/video/status/${videoId}`)
        if (!response.ok) {
          // If endpoint doesn't exist, try alternative approach
          console.log('⚠️ Video status endpoint not found, trying alternative...')
          // Continue monitoring - will check via polling
          setTimeout(checkStatus, 5000)
          return
        }
        
        const data = await response.json()
        
        // Extract URLs: temporary for quick display, permanent as fallback
        const temporaryUrl = data.temporaryVideoUrl || null
        const permanentUrl = data.videoUrl || null
        
        if (data.status === 'COMPLETED' && (temporaryUrl || permanentUrl)) {
          // Video completed - open modal with validation
          console.log('🎯 [VIDEO_GENERATION] Opening modal with validation:', {
            hasTemporary: !!temporaryUrl,
            hasPermanent: !!permanentUrl,
            temporaryUrl: temporaryUrl?.substring(0, 50) + '...',
            permanentUrl: permanentUrl?.substring(0, 50) + '...',
            videoId
          })
          // Use validation function to open modal (async, fire and forget)
          openModalWithValidation(temporaryUrl, permanentUrl).catch((error) => {
            console.error('❌ [VIDEO_GENERATION] Error opening modal with validation:', error)
            setMonitoringVideoId(null)
          })
        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          // Video failed - stop monitoring
          setMonitoringVideoId(null)
          loadingRef.current = false
          setLoading(false)
          addToast({
            type: 'error',
            title: "Erro na geração",
            description: data.errorMessage || "Falha ao gerar o vídeo",
          })
        } else {
          // Still processing - check again in 5 seconds
          setTimeout(checkStatus, 5000)
        }
      } catch (error) {
        console.error('Error checking video status:', error)
        // Retry after 5 seconds
        setTimeout(checkStatus, 5000)
      }
    }
    
    // Start checking after 10 seconds (videos take longer)
    setTimeout(checkStatus, 10000)
  }

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Pre-load source image if provided via URL parameter
  useEffect(() => {
    if (sourceImageUrl) {
      setUploadedImage(sourceImageUrl)
      setActiveMode('image-to-video')
      setFormData(prev => ({ ...prev, sourceImageUrl }))
    }
  }, [sourceImageUrl])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedImage(result)
        setFormData(prev => ({ ...prev, sourceImageUrl: result }))
        // Automatically switch to image-to-video mode when image is uploaded
        setActiveMode('image-to-video')
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setUploadedImage(null)
    setFormData(prev => ({ ...prev, sourceImageUrl: undefined, image: undefined }))
    // Automatically switch back to text-to-video mode when image is removed
    setActiveMode('text-to-video')
  }

  const handleLastFrameUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedLastFrame(result)
        setFormData(prev => ({ ...prev, lastFrame: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLastFrame = () => {
    setUploadedLastFrame(null)
    setFormData(prev => ({ ...prev, lastFrame: undefined }))
    if (lastFrameInputRef.current) {
      lastFrameInputRef.current.value = ''
    }
  }

  // Helper: Convert base64 to File
  const base64ToFile = (base64: string, filename: string): File => {
    const arr = base64.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  }

  // Helper: Upload image to S3
  const uploadImageToS3 = async (base64Image: string, filename: string): Promise<string> => {
    const file = base64ToFile(base64Image, filename)
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'images')
    formData.append('category', 'images')
    formData.append('useStandardizedStructure', 'true')

    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      throw new Error(errorData.error || 'Falha no upload da imagem')
    }

    const uploadResult = await uploadResponse.json()
    return uploadResult.data.url
  }

  const handleSubmit = async () => {
    setLoading(true)
    loadingRef.current = true
    setErrors([])

    try {
      // Validate prompt
      const promptValidation = validatePrompt(formData.prompt)
      if (!promptValidation.isValid) {
        addToast({
          type: 'error',
          title: "Prompt inválido",
          description: promptValidation.reason || 'Por favor, verifique seu prompt.',
        })
        setErrors([promptValidation.reason || 'Prompt inválido'])
        setLoading(false)
        loadingRef.current = false
        return
      }

      // Check credits
      const requiredCredits = calculateVideoCredits(formData.duration, formData.resolution || '1080p')
      // CRITICAL: Use creditBalance from API (handles expired credits correctly)
      // Fallback to manual calculation if API data not available yet
      const remainingCredits = creditBalance?.totalCredits ?? 
        ((user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0))

      if (requiredCredits > remainingCredits) {
        addToast({
          type: 'error',
          title: "Créditos insuficientes",
          description: `Você precisa de ${requiredCredits} créditos, mas tem apenas ${remainingCredits}`,
        })
        setErrors([`Você precisa de ${requiredCredits} créditos, mas tem apenas ${remainingCredits}`])
        setLoading(false)
        loadingRef.current = false
        return
      }

      // 🚀 Upload images to S3 BEFORE sending generation request
      let sourceImageUrl: string | undefined
      let lastFrameUrl: string | undefined

      try {
        // Upload source image if present
        if (activeMode === 'image-to-video' && uploadedImage) {
          console.log('📤 [VIDEO-GENERATION] Uploading source image to S3...')
          sourceImageUrl = await uploadImageToS3(uploadedImage, `video-source-${Date.now()}.jpg`)
          console.log('✅ [VIDEO-GENERATION] Source image uploaded:', sourceImageUrl)
        }

        // Upload last frame if present
        if (uploadedLastFrame) {
          console.log('📤 [VIDEO-GENERATION] Uploading last frame to S3...')
          lastFrameUrl = await uploadImageToS3(uploadedLastFrame, `video-lastframe-${Date.now()}.jpg`)
          console.log('✅ [VIDEO-GENERATION] Last frame uploaded:', lastFrameUrl)
        }
      } catch (uploadError) {
        console.error('❌ [VIDEO-GENERATION] Image upload failed:', uploadError)
        addToast({
          type: 'error',
          title: "Erro no upload de imagens",
          description: uploadError instanceof Error ? uploadError.message : 'Erro desconhecido',
        })
        setLoading(false)
        loadingRef.current = false
        return
      }

      // Prepare request data with S3 URLs (not base64)
      const requestData = {
        ...formData,
        sourceImageUrl,
        lastFrame: lastFrameUrl,
        // Remove base64 images from request
        image: undefined,
        generateAudio: formData.generateAudio !== false
      }

      console.log('🎬 [VIDEO-GENERATION] Creating video with data:', {
        ...requestData,
        sourceImageUrl: sourceImageUrl ? sourceImageUrl.substring(0, 50) + '...' : undefined,
        lastFrame: lastFrameUrl ? lastFrameUrl.substring(0, 50) + '...' : undefined
      })

      const response = await fetch('/api/ai/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar vídeo')
      }

      const result = await response.json()
      console.log('✅ [VIDEO-GENERATION] Video generation started:', result)

      // Store video generation ID for monitoring
      const videoGenerationId = result.videoGenerationId || result.videoGeneration?.id || result.id
      
      if (!videoGenerationId) {
        throw new Error('ID da geração de vídeo não foi retornado')
      }

      addToast({
        type: 'success',
        title: "Vídeo em processamento",
        description: `Tempo estimado: ${formatProcessingTime(getEstimatedProcessingTime(formData.duration, formData.resolution || '1080p'))}. O modal abrirá automaticamente quando estiver pronto.`,
      })

      // Clear form immediately after starting generation
      setFormData({
        prompt: '',
        negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
        duration: VIDEO_CONFIG.defaults.duration as 4 | 6 | 8,
        aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16',
        resolution: VIDEO_CONFIG.defaults.resolution as '720p' | '1080p',
        generateAudio: VIDEO_CONFIG.defaults.generateAudio,
        quality: 'pro' as 'standard' | 'pro'
      })
      setUploadedImage(null)
      setUploadedLastFrame(null)
      setSelectedTemplate(null)
      setActiveMode('text-to-video')

      // Monitor video status and open modal when completed
      monitorVideoGeneration(videoGenerationId)

    } catch (error) {
      console.error('❌ [VIDEO-GENERATION] Error:', error)
      addToast({
        type: 'error',
        title: "Erro na geração de vídeo",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      setErrors([error instanceof Error ? error.message : 'Erro desconhecido'])
      loadingRef.current = false
    } finally {
      if (!loadingRef.current) {
      setLoading(false)
      }
    }
  }

  const handleDownloadPreview = useCallback(async () => {
    if (!previewMedia?.url) return

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const cleanUrl = previewMedia.url.split('?')[0]
      let extension = 'mp4'

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
          videoUrl: previewMedia.url, // Use videoUrl instead of imageUrl for videos
          filename: `vibephoto-video-${timestamp}.${extension}`
        })
      })

      if (!proxyResponse.ok) {
        throw new Error(`Failed to download preview: ${proxyResponse.status}`)
      }

      const blob = await proxyResponse.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `vibephoto-video-${timestamp}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('❌ [VIDEO_GENERATION] Failed to download preview:', error)
      addToast({
        type: 'error',
        title: 'Falha no download',
        description: 'Não foi possível baixar o vídeo gerado. Tente novamente.'
      })
    }
  }, [previewMedia, addToast])

  const requiredCredits = calculateVideoCredits(formData.duration, formData.resolution || '1080p')
  // CRITICAL: Use creditBalance from API (handles expired credits correctly)
  // Fallback to manual calculation if API data not available yet
  const remainingCredits = creditBalance?.totalCredits ?? 
    ((user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0))
  const hasEnoughCredits = requiredCredits <= remainingCredits
  const canProcess = formData.prompt.trim() && !loading && canUseCredits && hasEnoughCredits

  const copyPrompt = () => {
    navigator.clipboard.writeText(formData.prompt)
    addToast({
      title: "Copiado!",
      description: "Prompt copiado para a área de transferência",
      type: "success"
    })
  }

  // Mobile Layout - Similar to editor
  if (isMobile) {
  return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-4 py-0">
          {/* Mobile: Info Card */}
          <div className="mb-4">
            <Card className="border-[#2C3E50] bg-[#2C3E50] rounded-lg shadow-lg">
              <CardContent className="p-4">
                <div className="text-sm text-white leading-relaxed font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  <h3 className="text-base font-bold text-white mb-3">
                    Como Gerar Vídeos com IA
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-200">
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Você pode gerar vídeos a partir de texto ou usando uma imagem de referência</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-white mr-2">•</span>
                      <span>Descreva o movimento e a ação desejada no prompt para criar vídeos únicos</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile: Settings Card */}
          <div className="mb-4">
            <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
              <CardContent className="p-4 space-y-3">
              {/* Duration */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duração
                  </label>
                    <Select
                      value={formData.duration.toString()}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) as 4 | 6 | 8 }))}
                    >
                    <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 segundos</SelectItem>
                      <SelectItem value="6">6 segundos</SelectItem>
                      <SelectItem value="8">8 segundos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

              {/* Aspect Ratio */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proporção
                  </label>
                    <Select
                      value={formData.aspectRatio}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value as '16:9' | '9:16' }))}
                    >
                    <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Paisagem)</SelectItem>
                      <SelectItem value="9:16">9:16 (Retrato)</SelectItem>
                    </SelectContent>
                  </Select>
                    </div>

                {/* Generate Audio */}
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.generateAudio !== false}
                      onChange={(e) => setFormData(prev => ({ ...prev, generateAudio: e.target.checked }))}
                      className="w-4 h-4 text-[#667EEA] bg-gray-200 border-gray-900 rounded focus:ring-[#667EEA] focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Gerar com áudio</span>
                  </label>
                </div>

                {/* Quality Info */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 text-center">
                    Qualidade 1080p • Tempo estimado: {formatProcessingTime(getEstimatedProcessingTime(formData.duration, formData.resolution || '1080p'))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile: Prompt and Controls */}
          <div className="space-y-3">
            {/* Prompt Input */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Descrição
                      </label>
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-gray-600">
                    {formData.prompt.length}/{VIDEO_CONFIG.options.maxPromptLength}
                  </div>
                  {formData.prompt && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, prompt: '' }))}
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
                placeholder={uploadedImage 
                  ? "Descreva o movimento desejado para o vídeo..."
                  : "Descreva o vídeo que você quer criar..."
                }
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                rows={4}
                maxLength={VIDEO_CONFIG.options.maxPromptLength}
                className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] rounded-lg px-4 py-4 transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
            </div>

            {/* Upload and Process Buttons - Side by side, smaller */}
            <div className="flex flex-row items-center gap-2">
                            <Button
                type="button"
                              variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedImage ? 'Imagem adicionada' : 'Adicionar imagem inicial'}
              </Button>
              <Button
                type="button"
                              variant="outline"
                onClick={() => lastFrameInputRef.current?.click()}
                disabled={loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedLastFrame ? 'Última imagem adicionada' : 'Adicionar última imagem'}
              </Button>
                          </div>
            <div className="flex flex-row items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!canProcess}
                className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Gerar ({requiredCredits} créditos)
                  </>
                )}
                            </Button>
                          </div>

            {/* Processing Message - Mobile */}
            <ProcessingMessage 
              isProcessing={loading} 
              type="video" 
            />

                            <input
              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
            />
            <input
              ref={lastFrameInputRef}
              type="file"
              accept="image/*"
              onChange={handleLastFrameUpload}
              className="hidden"
            />

            {/* Uploaded Images Preview */}
            <div className="flex gap-3">
            {uploadedImage && (
              <div className="relative inline-block">
                <img
                  src={uploadedImage}
                  alt="Imagem inicial"
                  className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-600 text-center mt-1">Inicial</p>
              </div>
            )}
            {uploadedLastFrame && (
              <div className="relative inline-block">
                <img
                  src={uploadedLastFrame}
                  alt="Última imagem"
                  className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  onClick={removeLastFrame}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-600 text-center mt-1">Final</p>
              </div>
            )}
            </div>

            {/* Error Display */}
            {errors.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600 font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                      {error}
                    </p>
                  ))}
                </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
    )
  }

  // Desktop Layout - Editor style with white background
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Info Card - Dark theme */}
        <div className="mb-6">
          <Card className="border-[#2C3E50] bg-[#2C3E50] rounded-lg shadow-lg">
            <CardContent className="p-4">
              <div className="text-sm text-white leading-relaxed font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                <h3 className="text-base font-bold text-white mb-3">
                  Como Gerar Vídeos com IA
                </h3>
                <ul className="space-y-2 text-sm text-gray-200">
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Texto para vídeo:</strong> Descreva o movimento e a ação desejada no prompt para criar vídeos únicos a partir do zero</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Imagem inicial (opcional):</strong> Adicione uma imagem de referência para iniciar o vídeo a partir dessa imagem, criando animação e movimento</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Imagem final (opcional):</strong> Quando usado junto com a imagem inicial, cria uma transição suave entre as duas imagens (interpolação), perfeito para transformações e morphing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Áudio:</strong> Gere vídeos com ou sem áudio sincronizado automaticamente com o movimento visual</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-white mr-2">•</span>
                    <span><strong>Durações:</strong> Escolha entre 4s, 6s ou 8s de vídeo em alta qualidade (1080p)</span>
                  </li>
                </ul>
                  </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid Layout: Settings on the left, Prompt and buttons below */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Settings (no card wrapper) */}
          <div className="lg:col-span-1 space-y-4">
            {/* Duration */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duração
                </label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) as 4 | 6 | 8 }))}
                >
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 segundos</SelectItem>
                  <SelectItem value="6">6 segundos</SelectItem>
                  <SelectItem value="8">8 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {/* Aspect Ratio */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proporção
                </label>
                <Select
                  value={formData.aspectRatio}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value as '16:9' | '9:16' }))}
                >
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Paisagem)</SelectItem>
                  <SelectItem value="9:16">9:16 (Retrato)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {/* Generate Audio */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.generateAudio !== false}
                  onChange={(e) => setFormData(prev => ({ ...prev, generateAudio: e.target.checked }))}
                  className="w-4 h-4 text-[#667EEA] bg-gray-200 border-gray-900 rounded focus:ring-[#667EEA] focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">Gerar com áudio</span>
              </label>
            </div>

            {/* Quality Info */}
            <div className="pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-600 text-center">
                Qualidade 1080p • Tempo estimado: {formatProcessingTime(getEstimatedProcessingTime(formData.duration, formData.resolution || '1080p'))}
              </div>
            </div>
          </div>

          {/* Right Column - Prompt and Actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Prompt Input */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Descrição
                    </label>
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-gray-600">
                    {formData.prompt.length}/{VIDEO_CONFIG.options.maxPromptLength}
                  </div>
                  {formData.prompt && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, prompt: '' }))}
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
                placeholder={uploadedImage 
                  ? "Descreva o movimento desejado para o vídeo..."
                  : "Descreva o vídeo que você quer criar..."
                }
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                rows={5}
                maxLength={VIDEO_CONFIG.options.maxPromptLength}
                className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] rounded-lg px-4 py-4 transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
            </div>

            {/* Upload and Process Buttons - Side by side */}
            <div className="flex flex-row items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-3 text-sm font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedImage ? 'Imagem inicial adicionada' : 'Adicionar imagem inicial'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => lastFrameInputRef.current?.click()}
                disabled={loading}
                className="flex-1 border border-gray-900 bg-white hover:border-[#667EEA] hover:bg-[#667EEA]/5 text-gray-900 rounded-lg px-4 py-3 text-sm font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedLastFrame ? 'Última imagem adicionada' : 'Adicionar última imagem'}
              </Button>
            </div>
            <div className="flex flex-row items-center gap-2">
            <Button
              onClick={handleSubmit}
                disabled={!canProcess}
                className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              {loading ? (
                <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Processando...
                </>
              ) : (
                <>
                  Gerar Vídeo ({requiredCredits} créditos)
                </>
              )}
            </Button>
            </div>

            {/* Processing Message - Desktop */}
            <ProcessingMessage 
              isProcessing={loading} 
              type="video" 
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              ref={lastFrameInputRef}
              type="file"
              accept="image/*"
              onChange={handleLastFrameUpload}
              className="hidden"
            />

            {/* Uploaded Images Preview */}
            <div className="flex gap-3">
            {uploadedImage && (
              <div className="relative inline-block">
                <img
                  src={uploadedImage}
                  alt="Imagem inicial"
                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-600 text-center mt-1">Inicial</p>
          </div>
            )}
            {uploadedLastFrame && (
              <div className="relative inline-block">
                <img
                  src={uploadedLastFrame}
                  alt="Última imagem"
                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  onClick={removeLastFrame}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-600 text-center mt-1">Final</p>
              </div>
            )}
            </div>

            {/* Error Display */}
          {errors.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600 font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
                  </div>

      {/* Preview Block - Centralized, same format as image generation */}
      {previewMedia && (
        <div ref={previewContainerRef} className="mt-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
            Resultado recente
          </h3>
          <div className="max-w-3xl mx-auto">
            <div
              className="relative group cursor-pointer rounded-2xl overflow-hidden border border-gray-200 bg-black shadow-md"
              onClick={() => setIsPreviewLightboxOpen(true)}
            >
              <video
                src={previewMedia.url}
                className="w-full h-auto object-cover max-h-96"
                controls
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-4 py-2 bg-white/85 text-gray-900 text-sm font-semibold rounded-full">
                  Clique para ver em tela cheia
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isPreviewLightboxOpen} onOpenChange={setIsPreviewLightboxOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden p-0 bg-black">
          {previewMedia?.type === 'video' && (
            <>
              <button
                type="button"
                onClick={handleDownloadPreview}
                className="absolute right-16 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-900 shadow-sm transition-all duration-200 ease-in-out hover:bg-white hover:ring-2 hover:ring-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
              >
                <Download className="w-3 h-3" />
                Baixar
              </button>
              <video src={previewMedia.url} className="w-full h-auto max-h-[85vh]" controls autoPlay />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
