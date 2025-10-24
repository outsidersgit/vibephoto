'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, Play, Clock, Zap, Settings, Sparkles, Image as ImageIcon, Video } from 'lucide-react'
import { VIDEO_CONFIG, VideoGenerationRequest, VideoTemplate } from '@/lib/ai/video/config'
import { calculateVideoCredits, formatProcessingTime, validatePrompt } from '@/lib/ai/video/utils'

interface VideoModalProps {
  isOpen: boolean
  mode?: 'image-to-video' | 'text-to-video' // Video creation mode
  sourceImageUrl?: string // Optional for text-to-video
  sourceGeneration?: any
  onClose: () => void
  onCreateVideo: (request: VideoGenerationRequest) => void
  userPlan: string
}

export function VideoModal({
  isOpen,
  mode = 'image-to-video', // Default for backward compatibility
  sourceImageUrl,
  sourceGeneration,
  onClose,
  onCreateVideo,
  userPlan
}: VideoModalProps) {
  const [formData, setFormData] = useState<VideoGenerationRequest>({
    sourceImageUrl: mode === 'image-to-video' ? sourceImageUrl : undefined,
    prompt: '',
    negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
    duration: VIDEO_CONFIG.defaults.duration as 5 | 10,
    aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16' | '1:1',
    quality: VIDEO_CONFIG.defaults.quality as 'standard' | 'pro'
  })

  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageInfo, setImageInfo] = useState({ width: 0, height: 0 })
  const [errors, setErrors] = useState<string[]>([])

  // Load image information (only for image-to-video mode)
  useEffect(() => {
    if (mode === 'image-to-video' && sourceImageUrl) {
      const img = new Image()
      img.onload = () => {
        setImageInfo({ width: img.width, height: img.height })
        
        // Auto-suggest aspect ratio based on image dimensions
        const ratio = img.width / img.height
        if (ratio > 1.5) {
          setFormData(prev => ({ ...prev, aspectRatio: '16:9' }))
        } else if (ratio < 0.75) {
          setFormData(prev => ({ ...prev, aspectRatio: '9:16' }))
        } else {
          setFormData(prev => ({ ...prev, aspectRatio: '1:1' }))
        }
      }
      img.src = sourceImageUrl
    }
  }, [mode, sourceImageUrl])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        sourceImageUrl: mode === 'image-to-video' ? sourceImageUrl : undefined,
        prompt: '',
        negativePrompt: VIDEO_CONFIG.defaults.negativePrompt,
        duration: VIDEO_CONFIG.defaults.duration as 5 | 10,
        aspectRatio: VIDEO_CONFIG.defaults.aspectRatio as '16:9' | '9:16' | '1:1',
        quality: VIDEO_CONFIG.defaults.quality as 'standard' | 'pro'
      })
      setSelectedTemplate(null)
      setShowAdvanced(false)
      setErrors([])
    }
  }, [isOpen, mode, sourceImageUrl])

  if (!isOpen) return null

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

  const handleSubmit = async () => {
    console.log('🎬 [VIDEO-MODAL] Starting video creation process')
    console.log('🎬 [VIDEO-MODAL] Form data:', formData)
    
    setLoading(true)
    setErrors([])

    // Validate form
    const promptValidation = validatePrompt(formData.prompt)
    console.log('🎬 [VIDEO-MODAL] Prompt validation:', promptValidation)
    
    if (!promptValidation.isValid) {
      console.error('❌ [VIDEO-MODAL] Prompt validation failed:', promptValidation.reason)
      setErrors([promptValidation.reason!])
      setLoading(false)
      return
    }

    try {
      console.log('🎬 [VIDEO-MODAL] Calling onCreateVideo with data:', formData)
      await onCreateVideo(formData)
      console.log('✅ [VIDEO-MODAL] Video creation successful, closing modal')
      onClose()
    } catch (error) {
      console.error('❌ [VIDEO-MODAL] Video creation error:', error)
      console.error('❌ [VIDEO-MODAL] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      setErrors([error instanceof Error ? error.message : 'Erro ao criar vídeo'])
    } finally {
      console.log('🎬 [VIDEO-MODAL] Setting loading to false')
      setLoading(false)
    }
  }

  const creditsNeeded = calculateVideoCredits(formData.duration, formData.quality)
  const estimatedTime = formatProcessingTime(
    VIDEO_CONFIG.estimatedTimes[formData.quality][formData.duration]
  )

  const planLimits = VIDEO_CONFIG.planLimits[userPlan as keyof typeof VIDEO_CONFIG.planLimits] || VIDEO_CONFIG.planLimits.STARTER

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Video className="w-6 h-6 mr-2 text-purple-600" />
            {mode === 'text-to-video' ? 'Criar Vídeo com Texto' : 'Criar Vídeo com IA'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preview section - conditional based on mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mode === 'image-to-video' && sourceImageUrl ? (
              <div className="space-y-2">
                <h3 className="font-medium flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Imagem Base ({imageInfo.width}x{imageInfo.height})
                </h3>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={sourceImageUrl} 
                    alt="Imagem base para vídeo" 
                    className="w-full h-full object-cover"
                  />
                </div>
                {sourceGeneration && (
                  <p className="text-sm text-gray-600">
                    📝 {sourceGeneration.prompt?.substring(0, 100)}...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-medium flex items-center">
                  <Video className="w-4 h-4 mr-2" />
                  Criação com Texto
                </h3>
                <div className={`${
                  formData.aspectRatio === '16:9' ? 'aspect-video' : 
                  formData.aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                  'aspect-square'
                } bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-300`}>
                  <div className="text-center">
                    <Video className="w-12 h-12 mx-auto mb-2 text-blue-500" />
                    <p className="text-sm text-gray-600">
                      Vídeo gerado apenas com texto
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Descreva a cena desejada
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="font-medium flex items-center">
                <Play className="w-4 h-4 mr-2 text-purple-600" />
                Resultado ({formData.aspectRatio} • {formData.duration}s • {formData.quality})
              </h3>
              <div className={`${
                formData.aspectRatio === '16:9' ? 'aspect-video' : 
                formData.aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                'aspect-square'
              } bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg flex items-center justify-center border-2 border-dashed border-purple-300`}>
                <div className="text-center">
                  <Video className="w-12 h-12 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm text-gray-600">
                    Vídeo {formData.duration}s • {formData.quality === 'pro' ? '1080p' : '720p'}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    {estimatedTime} de processamento
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Templates e Configurações */}
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="custom">Personalizado</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(VIDEO_CONFIG.promptTemplates).map(([key, template]) => (
                  <Card 
                    key={key}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate === key ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                    }`}
                    onClick={() => handleTemplateSelect(key as VideoTemplate)}
                  >
                    <CardContent className="p-4">
                      <h4 className="font-medium text-sm mb-2">{template.name}</h4>
                      <p className="text-xs text-gray-600 mb-3">{template.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="secondary">{template.recommendedDuration}s</Badge>
                        <Badge variant="outline">{template.recommendedAspectRatio}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              {/* Prompt personalizado */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Descreva o movimento/animação desejada
                </label>
                <Textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Ex: gentle camera pan left, subtle breathing motion, leaves swaying in the wind..."
                  className="min-h-[100px]"
                  maxLength={VIDEO_CONFIG.options.maxPromptLength}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formData.prompt.length}/{VIDEO_CONFIG.options.maxPromptLength} caracteres</span>
                  <span>💡 Seja específico sobre o movimento desejado</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Configurações principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Duração */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Duração</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_CONFIG.options.durations.map((duration) => (
                  <Button
                    key={duration}
                    variant={formData.duration === duration ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, duration }))}
                    className="relative"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    {duration}s
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {calculateVideoCredits(duration, formData.quality)}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {/* Formato */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Formato</label>
              <div className="grid grid-cols-3 gap-2">
                {VIDEO_CONFIG.options.aspectRatios.map((ratio) => (
                  <Button
                    key={ratio}
                    variant={formData.aspectRatio === ratio ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, aspectRatio: ratio }))}
                    className="text-xs"
                  >
                    {ratio}
                  </Button>
                ))}
              </div>
            </div>

            {/* Qualidade */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Qualidade</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_CONFIG.options.qualities.map((quality) => (
                  <Button
                    key={quality}
                    variant={formData.quality === quality ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, quality }))}
                    className="relative text-xs"
                    disabled={quality === 'pro' && !planLimits.allowPro}
                  >
                    {quality === 'pro' ? <Sparkles className="w-4 h-4 mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                    {VIDEO_CONFIG.qualityPresets[quality].name}
                    {quality === 'pro' && !planLimits.allowPro && (
                      <Badge variant="secondary" className="ml-1 text-xs">Pro</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Configurações avançadas */}
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações Avançadas
              {showAdvanced ? ' ▲' : ' ▼'}
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Prompt Negativo (opcional)
                  </label>
                  <Textarea
                    value={formData.negativePrompt || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, negativePrompt: e.target.value }))}
                    placeholder="Coisas que você NÃO quer ver no vídeo..."
                    className="min-h-[80px]"
                    maxLength={VIDEO_CONFIG.options.maxNegativePromptLength}
                  />
                  <p className="text-xs text-gray-500">
                    Ajuda a evitar elementos indesejados no vídeo
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Erros */}
          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-700">
                {errors.map((error, index) => (
                  <p key={index} className="text-sm">❌ {error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Informações do processo */}
          <div className="p-4 bg-purple-50 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Créditos necessários:</span>
              <Badge className="bg-purple-600">{creditsNeeded} créditos</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tempo estimado:</span>
              <span className="text-sm">{estimatedTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Resolução:</span>
              <span className="text-sm">{VIDEO_CONFIG.qualityPresets[formData.quality].resolution}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Plano atual:</span>
              <Badge variant="outline">{userPlan}</Badge>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !formData.prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Criando...
                </div>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Criar Vídeo ({creditsNeeded} créditos)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}