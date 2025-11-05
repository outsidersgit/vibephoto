'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Image as ImageIcon, Video, Upload, X, Loader2, Copy } from 'lucide-react'
import { VIDEO_CONFIG, VideoGenerationRequest, VideoTemplate } from '@/lib/ai/video/config'
import { calculateVideoCredits, validatePrompt, getEstimatedProcessingTime, formatProcessingTime } from '@/lib/ai/video/utils'
import { useToast } from '@/hooks/use-toast'
import { GenerationResultModal } from '@/components/ui/generation-result-modal'
import { useRouter } from 'next/navigation'

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
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { data: session, status } = useSession()
  const { addToast } = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isMobile, setIsMobile] = useState(false)
  const [activeMode, setActiveMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')
  const [formData, setFormData] = useState<VideoGenerationRequest>({
    prompt: '',
    negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
    duration: VIDEO_CONFIG.defaults.duration as 5 | 10,
    aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16' | '1:1',
    quality: 'pro' as 'standard' | 'pro'
  })

  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successVideoUrl, setSuccessVideoUrl] = useState<string | null>(null)

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
  
  // CRITICAL: AGORA sim podemos fazer early returns após todos os hooks
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
    setFormData(prev => ({ ...prev, sourceImageUrl: undefined }))
    // Automatically switch back to text-to-video mode when image is removed
    setActiveMode('text-to-video')
  }

  const handleSubmit = async () => {
    setLoading(true)
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
        return
      }

      // Check credits
      const requiredCredits = calculateVideoCredits(formData.duration, 'pro')
      // Formula: credits_available = (credits_limit - credits_used) + credits_balance
      const remainingCredits = (user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0)

      if (requiredCredits > remainingCredits) {
        addToast({
          type: 'error',
          title: "Créditos insuficientes",
          description: `Você precisa de ${requiredCredits} créditos, mas tem apenas ${remainingCredits}`,
        })
        setErrors([`Você precisa de ${requiredCredits} créditos, mas tem apenas ${remainingCredits}`])
        setLoading(false)
        return
      }

      // Prepare request data
      const requestData = {
        ...formData,
        sourceImageUrl: activeMode === 'image-to-video' ? uploadedImage : undefined
      }

      console.log('🎬 [VIDEO-GENERATION] Creating video with data:', requestData)

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

      addToast({
        type: 'success',
        title: "Vídeo em processamento",
        description: `Tempo estimado: ${formatProcessingTime(getEstimatedProcessingTime(formData.duration, 'pro'))}. Você pode acompanhar o progresso na galeria.`,
      })

      // Redirect to gallery to view video progress
      setTimeout(() => {
        router.push('/gallery?tab=videos')
      }, 2000)

      // Reset form
      setFormData({
        prompt: '',
        negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
        duration: VIDEO_CONFIG.defaults.duration as 5 | 10,
        aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16' | '1:1',
        quality: 'pro' as 'standard' | 'pro'
      })
      setUploadedImage(null)
      setSelectedTemplate(null)

    } catch (error) {
      console.error('❌ [VIDEO-GENERATION] Error:', error)
      addToast({
        type: 'error',
        title: "Erro na geração de vídeo",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      setErrors([error instanceof Error ? error.message : 'Erro desconhecido'])
    } finally {
      setLoading(false)
    }
  }

  const requiredCredits = calculateVideoCredits(formData.duration, 'pro')
  const remainingCredits = (user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0)
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
                    onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) as 5 | 10 }))}
                  >
                    <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
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
                    onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value as '16:9' | '9:16' | '1:1' }))}
                  >
                    <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Paisagem)</SelectItem>
                      <SelectItem value="9:16">9:16 (Retrato)</SelectItem>
                      <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality Info */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 text-center">
                    Qualidade 1080p • Tempo estimado: {formatProcessingTime(getEstimatedProcessingTime(formData.duration, 'pro'))}
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
                className="flex-1 border border-gray-900 hover:border-[#667EEA] hover:bg-[#667EEA]/5 bg-gray-200 text-gray-900 rounded-lg py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedImage ? 'Imagem adicionada' : 'Adicionar'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canProcess}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Uploaded Image Preview */}
            {uploadedImage && (
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

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
                onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) as 5 | 10 }))}
              >
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
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
                onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value as '16:9' | '9:16' | '1:1' }))}
              >
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Paisagem)</SelectItem>
                  <SelectItem value="9:16">9:16 (Retrato)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quality Info */}
            <div className="pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-600 text-center">
                Qualidade 1080p • Tempo estimado: {formatProcessingTime(getEstimatedProcessingTime(formData.duration, 'pro'))}
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
                className="flex-1 border border-gray-900 hover:border-[#667EEA] hover:bg-[#667EEA]/5 bg-gray-200 text-gray-900 rounded-lg py-2 text-xs font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                {uploadedImage ? 'Imagem adicionada' : 'Adicionar imagem'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canProcess}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Uploaded Image Preview */}
            {uploadedImage && (
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

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

      {/* Success Modal for Video */}
      <GenerationResultModal
        open={showSuccessModal}
        onOpenChange={(open) => {
          setShowSuccessModal(open)
          if (!open) setSuccessVideoUrl(null)
        }}
        videoUrl={successVideoUrl}
        title="Vídeo Gerado"
        type="video"
      />
    </div>
  )
}
