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
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '9:16' | '16:9'>('1:1')
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
          aspectRatio,
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
                      <span>Modifique, adicione, remova ou funda até 3 imagens para criar composições únicas</span>
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
              <Textarea
                placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2500}
                className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20 rounded-lg px-4 py-4 pr-12 shadow-sm transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                }}
              />
              <div className="absolute bottom-4 right-4 text-xs text-gray-600">
                {prompt.length}/2500
              </div>
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
                    <span>Modifique, adicione, remova ou funda até 3 imagens para criar composições únicas</span>
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
            <Textarea
              placeholder="Descreva o que deseja editar, adicionar ou remover da imagem..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              maxLength={2500}
              className="resize-none text-sm bg-gray-200 border border-gray-900 text-gray-900 placeholder:text-gray-500 focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20 rounded-lg px-4 py-4 pr-12 shadow-sm transition-all font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              style={{
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
              }}
            />
            <div className="absolute bottom-4 right-4 text-xs text-gray-600">
              {prompt.length}/2500
            </div>
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

          {/* Result Display - Desktop */}
          {result && (
            <div className="mt-6 space-y-4">
              <Card className="border-gray-200 bg-white rounded-xl shadow-lg">
                <CardContent className="p-6">
                  <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                    <img
                      src={result}
                      alt="Resultado processado"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="mt-4 flex gap-3 justify-center">
                    <Button
                      onClick={() => router.push('/gallery')}
                      className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                    >
                      Ver na galeria
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="border-2 border-gray-200 hover:border-[#667EEA] bg-white text-gray-700 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
                    >
                      <a href={result} download="imagem-editada.jpg">
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}