'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Image as ImageIcon
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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

  const [operation] = useState<Operation>('edit')
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>(preloadedImageUrl ? [preloadedImageUrl] : [])
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const router = useRouter()
  
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

  const handleSubmit = async () => {
    if (!images.length && !prompt.trim()) {
      addToast({
        title: "Erro",
        description: "Adicione uma imagem ou descreva o que deseja fazer",
        type: "error"
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/image-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          prompt,
          images,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar imagem')
      }

      const data = await response.json()
      setResult(data.resultUrl)
      
      // Show result modal on mobile
      if (isMobile) {
        setShowResultModal(true)
      }

      addToast({
        title: "Sucesso!",
        description: "Imagem processada e salva com sucesso",
        type: "success"
      })
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
          {/* Mobile: Single prompt box centered */}
          <div className="space-y-4">
            {/* Prompt Input - ChatGPT style */}
            <div className="relative">
              <Textarea
                placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2500}
                className="resize-none text-sm bg-white border-2 border-gray-200 rounded-2xl px-4 py-4 pr-12 shadow-sm focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20 transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
              <div className="absolute bottom-4 right-4 text-xs text-gray-400">
                {prompt.length}/2500
              </div>
            </div>

            {/* Upload Button - Secondary, below prompt */}
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 3 || loading}
              className="w-full border-2 border-gray-200 hover:border-[#667EEA] hover:bg-[#667EEA]/5 rounded-xl py-3 text-sm font-medium transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {images.length > 0 ? `${images.length}/3 imagens` : 'Adicionar imagem'}
            </Button>
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

            {/* Process Button - Fixed below prompt */}
            <Button
              onClick={handleSubmit}
              disabled={!canProcess}
              className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Processar imagem (15 créditos)
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600 font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Result Modal */}
          <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Imagem Processada
                </DialogTitle>
                <DialogDescription className="font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Sua imagem foi processada com sucesso!
                </DialogDescription>
              </DialogHeader>
              {result && (
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={result}
                      alt="Resultado processado"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push('/gallery')}
                      className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                    >
                      Ver na galeria
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="flex-1 border-2 border-gray-200 hover:border-[#667EEA] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                    >
                      <a href={result} download="imagem-editada.jpg">
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  // Desktop Layout - Keep current design
  return (
    <div className="max-w-7xl mx-auto p-6 bg-[#2C3E50] min-h-screen rounded-2xl">
      <div className="flex gap-6">
        {/* Left Column - Controls */}
        <div className="w-96 flex-shrink-0 space-y-6">
          {/* Informações do Editor */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl shadow-lg">
            <CardContent className="p-6 space-y-5">
              <div className="text-sm text-gray-200 leading-relaxed font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                <p className="mb-4 font-medium">
                  Com o Editor IA você pode transformar suas imagens de qualquer forma:
                </p>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-start gap-3">
                    <Edit3 className="w-4 h-4 mt-0.5 text-[#5DADE2] flex-shrink-0" />
                    <span className="font-medium"><strong>Modificar elementos</strong> existentes na imagem</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Plus className="w-4 h-4 mt-0.5 text-[#5DADE2] flex-shrink-0" />
                    <span className="font-medium"><strong>Adicionar objetos</strong> ou elementos novos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Minus className="w-4 h-4 mt-0.5 text-[#5DADE2] flex-shrink-0" />
                    <span className="font-medium"><strong>Remover partes</strong> indesejadas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Blend className="w-4 h-4 mt-0.5 text-[#5DADE2] flex-shrink-0" />
                    <span className="font-medium"><strong>Fundir até 3 fotos</strong> para criar composições únicas</span>
                  </li>
                </ul>
                <p className="mt-4 text-xs text-gray-400 font-medium">
                  Simplesmente carregue suas imagens e descreva o que você quer fazer!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                Upload de Imagens
                <Badge variant="secondary" className="ml-2 text-xs bg-[#5DADE2]/20 text-[#5DADE2] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  até 3 imagens
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-[#4A5F7A] bg-[#2C3E50] rounded-xl p-6 text-center hover:border-[#5DADE2] hover:bg-[#34495E] transition-all duration-200 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {images.length === 0 ? (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3 group-hover:text-[#5DADE2] transition-colors" />
                    <p className="text-sm font-medium text-white mb-1 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                      Arraste ou clique aqui
                    </p>
                    <p className="text-xs text-gray-400 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                      PNG, JPG, WEBP (máx. 10MB)
                    </p>
                  </>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={true}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Uploaded Images */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image}
                        alt={`Imagem ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-[#4A5F7A]"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Input */}
          <Card className="border-[#34495E] bg-[#34495E] rounded-2xl shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                Descrição da Edição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Descreva o que você quer fazer com a imagem..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2500}
                className="resize-none text-sm bg-[#2C3E50] border-[#4A5F7A] text-white placeholder:text-gray-400 focus:border-[#5DADE2] rounded-xl font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              />
            </CardContent>
          </Card>

          {/* Process Button */}
          <Button
            onClick={handleSubmit}
            disabled={!canProcess}
            className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 disabled:from-gray-500 disabled:to-gray-600 text-white border-0 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] rounded-lg font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Edit3 className="w-5 h-5 mr-3" />
                Processar Imagem (15 créditos)
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Card className="border-red-400 bg-red-500/20 rounded-2xl">
              <CardContent className="p-4">
                <div className="text-sm text-red-300 flex items-start gap-2 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Result */}
        <div className="flex-1">
          <Card className="border-[#34495E] bg-[#34495E] shadow-lg rounded-2xl h-full">
            <CardContent className="p-8">
              <div className="aspect-square bg-gradient-to-br from-[#2C3E50] to-[#34495E] rounded-2xl border-2 border-dashed border-[#4A5F7A] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#667EEA]/10 to-[#764BA2]/10"></div>
                {result ? (
                  <div className="relative z-10 w-full h-full flex flex-col">
                    <img
                      src={result}
                      alt="Resultado processado"
                      className="flex-1 object-contain rounded-xl"
                    />
                    <div className="mt-4 flex justify-center">
                      <Button
                        asChild
                        className="bg-[#5DADE2] hover:bg-[#4A90C2] text-white rounded-xl"
                      >
                        <a href={result} download="imagem-editada.jpg">
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Imagem
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 relative z-10">
                    <div className="p-4 bg-[#34495E] rounded-full shadow-lg mx-auto w-fit">
                      <Edit3 className="w-12 h-12 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                        Resultado da Edição
                      </h3>
                      <p className="text-base text-gray-300 max-w-md mx-auto font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                        Sua imagem editada aparecerá aqui após o processamento
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}