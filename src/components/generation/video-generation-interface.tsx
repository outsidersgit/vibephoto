'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Clock, Zap, Settings, Sparkles, Image as ImageIcon, Video, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { VIDEO_CONFIG, VideoGenerationRequest, VideoTemplate } from '@/lib/ai/video/config'
import { calculateVideoCredits, validatePrompt, getEstimatedProcessingTime, formatProcessingTime } from '@/lib/ai/video/utils'
import { useToast } from '@/hooks/use-toast'

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
  
  const [activeMode, setActiveMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')
  const [formData, setFormData] = useState<VideoGenerationRequest>({
    prompt: '',
    negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
    duration: VIDEO_CONFIG.defaults.duration as 5 | 10,
    aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16' | '1:1',
    quality: 'pro' as 'standard' | 'pro'
  })

  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

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

  const handleTemplateSelect = (template: VideoTemplate) => {
    const templateData = VIDEO_CONFIG.promptTemplates[template]
    setSelectedTemplate(template)

    setFormData(prev => ({
      ...prev,
      prompt: templateData.prompt,
      duration: templateData.recommendedDuration as 5 | 10,
      aspectRatio: templateData.recommendedAspectRatio as '16:9' | '9:16' | '1:1',
      template
    }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedImage(result)
        setFormData(prev => ({ ...prev, sourceImageUrl: result }))
      }
      reader.readAsDataURL(file)
    }
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
  const remainingCredits = user.creditsLimit - user.creditsUsed
  const hasEnoughCredits = requiredCredits <= remainingCredits

  return (
    <div className="max-w-7xl mx-auto p-6 bg-[#2C3E50] min-h-screen rounded-2xl">
      <div className="flex gap-6">
        {/* Left Column - Controls */}
        <div className="w-96 flex-shrink-0 space-y-6">
          {/* Mode Selection */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'text-to-video' | 'image-to-video')}>
                <TabsList className="grid w-full grid-cols-2 bg-[#2C3E50] border border-[#4A5F7A] rounded-xl">
                  <TabsTrigger
                    value="text-to-video"
                    className="text-sm font-medium data-[state=active]:bg-[#34495E] data-[state=active]:text-white text-gray-300 rounded-lg"
                  >
                    Texto para Vídeo
                  </TabsTrigger>
                  <TabsTrigger
                    value="image-to-video"
                    className="text-sm font-medium data-[state=active]:bg-[#34495E] data-[state=active]:text-white text-gray-300 rounded-lg"
                  >
                    Imagem para Vídeo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text-to-video" className="mt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-3">
                        Prompt do Vídeo
                      </label>
                      <Textarea
                        placeholder="Descreva o vídeo que você quer criar..."
                        value={formData.prompt}
                        onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                        rows={5}
                        maxLength={VIDEO_CONFIG.options.maxPromptLength}
                        className="resize-none text-sm bg-[#2C3E50] border-[#4A5F7A] text-white placeholder:text-gray-400 focus:border-[#5DADE2] rounded-xl"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="image-to-video" className="mt-6">
                  <div className="space-y-4">
                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-white mb-3">
                        Upload da Imagem
                      </label>
                      <div
                        className="border-2 border-dashed border-[#4A5F7A] bg-[#2C3E50] rounded-xl p-4 text-center hover:border-[#5DADE2] hover:bg-[#34495E] transition-all duration-200 cursor-pointer group"
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        {uploadedImage ? (
                          <div className="space-y-4">
                            <img
                              src={uploadedImage}
                              alt="Uploaded"
                              className="max-h-32 max-w-full mx-auto rounded-lg shadow-lg object-cover border border-[#4A5F7A]"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setUploadedImage(null)
                                setFormData(prev => ({ ...prev, sourceImageUrl: undefined }))
                              }}
                              className="text-gray-300 hover:text-red-400 border-[#4A5F7A] hover:border-red-400 bg-[#34495E] hover:bg-red-500/20"
                            >
                              Remover Imagem
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-[#5DADE2] transition-colors" />
                            <p className="text-sm font-medium text-white mb-1">
                              Arraste ou clique aqui
                            </p>
                            <p className="text-xs text-gray-400">
                              PNG, JPG, WEBP (máx. 10MB)
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              id="image-upload"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Movement Description */}
                    <div>
                      <label className="block text-sm font-semibold text-white mb-3">
                        Descrição do Movimento
                      </label>
                      <Textarea
                        placeholder="Descreva o movimento desejado..."
                        value={formData.prompt}
                        onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                        rows={4}
                        maxLength={VIDEO_CONFIG.options.maxPromptLength}
                        className="resize-none text-sm bg-[#2C3E50] border-[#4A5F7A] text-white placeholder:text-gray-400 focus:border-[#5DADE2] rounded-xl"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Video Settings */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duração
                </label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) as 5 | 10 }))}
                >
                  <SelectTrigger className="w-full h-10 bg-[#2C3E50] border-[#4A5F7A] text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#34495E] border-[#4A5F7A] rounded-xl">
                    <SelectItem value="5" className="text-white">5 segundos</SelectItem>
                    <SelectItem value="10" className="text-white">10 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Proporção
                </label>
                <Select
                  value={formData.aspectRatio}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value as '16:9' | '9:16' | '1:1' }))}
                >
                  <SelectTrigger className="w-full h-10 bg-[#2C3E50] border-[#4A5F7A] text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#34495E] border-[#4A5F7A] rounded-xl">
                    <SelectItem value="16:9" className="text-white">16:9 (Paisagem)</SelectItem>
                    <SelectItem value="9:16" className="text-white">9:16 (Retrato)</SelectItem>
                    <SelectItem value="1:1" className="text-white">1:1 (Quadrado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showAdvanced && (
                <div className="pt-4 border-t border-[#4A5F7A]">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prompt Negativo
                    </label>
                    <Textarea
                      placeholder="Elementos que você NÃO quer..."
                      value={formData.negativePrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, negativePrompt: e.target.value }))}
                      rows={3}
                      className="resize-none text-sm bg-[#2C3E50] border-[#4A5F7A] text-white placeholder:text-gray-400 focus:border-[#5DADE2] rounded-xl"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <div className="space-y-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || !canUseCredits || !hasEnoughCredits || !formData.prompt.trim()}
              className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-500 disabled:to-gray-600 text-white border-0 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] rounded-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3" />
                  Criando Vídeo...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 mr-3" />
                  Gerar Vídeo ({requiredCredits} créditos)
                </>
              )}
            </Button>

            {/* Advanced Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-gray-300 hover:text-white text-sm font-medium hover:bg-[#34495E] rounded-xl"
            >
              {showAdvanced ? 'Menos opções' : 'Mais opções'}
              {showAdvanced ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </Button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Card className="border-red-400 bg-red-500/20 rounded-2xl">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-300 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quality Info */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-300">
                Qualidade 1080p • Tempo estimado: {formatProcessingTime(getEstimatedProcessingTime(formData.duration, 'pro'))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Video Result */}
        <div className="flex-1">
          <Card className="border-[#34495E] bg-[#34495E] shadow-lg rounded-2xl h-full">
            <CardContent className="p-8">
              <div className="aspect-video bg-gradient-to-br from-[#2C3E50] to-[#34495E] rounded-2xl border-2 border-dashed border-[#4A5F7A] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#667EEA]/10 to-[#764BA2]/10"></div>
                <div className="text-center space-y-4 relative z-10">
                  <div className="p-4 bg-[#34495E] rounded-full shadow-lg mx-auto w-fit">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Resultado do Vídeo
                    </h3>
                    <p className="text-base text-gray-300 max-w-md mx-auto">
                      Seu vídeo gerado aparecerá aqui após o processamento
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}