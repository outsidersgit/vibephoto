'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Copy } from 'lucide-react'
import { PromptBuilder } from './prompt-builder'
import { SafeTextarea } from '@/components/ui/safe-textarea'
import { useToast } from '@/hooks/use-toast'
import { PromptOptimizer } from '@/components/ui/prompt-optimizer'

interface PromptInputProps {
  prompt: string
  negativePrompt: string
  onPromptChange: (prompt: string) => void
  isGenerating: boolean
  modelClass?: string
  onLastBlockSelected?: (isSelected: boolean) => void
  onModeChange?: (isGuidedMode: boolean) => void
}

export function PromptInput({
  prompt,
  negativePrompt,
  onPromptChange,
  isGenerating,
  modelClass = 'MAN',
  onLastBlockSelected,
  onModeChange
}: PromptInputProps) {
  const [isGuidedMode, setIsGuidedMode] = useState(false)
  const { addToast } = useToast()

  // Notify parent when mode changes
  useEffect(() => {
    onModeChange?.(isGuidedMode)
  }, [isGuidedMode, onModeChange])
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const adjustPromptHeight = () => {
    const el = promptRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 600) + 'px'
  }
  useEffect(() => { adjustPromptHeight() }, [prompt])

  // Handler para sanitização no Safari
  const handleSanitizedChange = (value: string, wasSanitized: boolean) => {
    if (wasSanitized) {
      addToast({
        title: "Texto ajustado",
        description: "Alguns caracteres foram removidos para compatibilidade com seu navegador",
        type: "info"
      })
    }
  }

  const toggleMode = () => {
    const newMode = !isGuidedMode
    setIsGuidedMode(newMode)

    // Scroll to Prompt Builder when guided mode is selected
    if (newMode) {
      setTimeout(() => {
        const promptBuilderElement = document.querySelector('.prompt-builder-container')
        if (promptBuilderElement) {
          const rect = promptBuilderElement.getBoundingClientRect()
          const offset = window.pageYOffset + rect.top - 100 // 100px from top

          window.scrollTo({
            top: offset,
            behavior: 'smooth'
          })
        }
      }, 100)
    }
  }

  const handleGuidedPrompt = (generatedPrompt: string) => {
    console.log('📝 [PROMPT_INPUT] Updating prompt from guided mode:', generatedPrompt.substring(0, 100) + '...')
    onPromptChange(generatedPrompt)
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt)
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center mb-2 border-b border-gray-300">
        <button
          type="button"
          onClick={() => setIsGuidedMode(false)}
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors font-medium ${
            !isGuidedMode
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Modo Livre
        </button>
        <button
          type="button"
          onClick={() => setIsGuidedMode(true)}
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors font-medium ${
            isGuidedMode
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Modo Guiado
        </button>
      </div>
      <p className="text-xs text-gray-500 -mt-1 mb-2">
        {isGuidedMode
          ? 'Modo guiado: combine blocos (estilo, luz, câmera) para montar o prompt perfeito, sem precisar escrever tudo.'
          : 'Modo livre: escreva seu prompt manualmente com total controle. Dica: detalhe estilo, iluminação, lente e ambiente.'}
      </p>

      {/* Guided Mode - Prompt Builder */}
      {isGuidedMode ? (
        <div className="prompt-builder-container">
          <PromptBuilder
            onPromptGenerated={handleGuidedPrompt}
            onLastBlockSelected={onLastBlockSelected}
            modelClass={modelClass}
          />
        </div>
      ) : (
        <>
          {/* Free Mode - Manual Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="prompt" className="block text-base font-semibold text-gray-900">
                Descrição da Imagem
              </label>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-600">
                  {prompt.length}/4000
                </div>
                {prompt && (
                  <>
                    <PromptOptimizer
                      currentPrompt={prompt}
                      onOptimizedPrompt={onPromptChange}
                      type="image"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-3 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onPromptChange('')}
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
            
            <SafeTextarea
              id="prompt"
              value={prompt}
              ref={promptRef}
              onChange={(e) => { onPromptChange(e.target.value); adjustPromptHeight() }}
              onSanitizedChange={handleSanitizedChange}
              disabled={isGenerating}
              className="w-full px-3 py-3 bg-gray-200 border border-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] resize-none text-gray-900 placeholder:text-gray-500"
              rows={3}
              maxLength={4000}
              placeholder="Descreva a foto que deseja criar... ex: 'foto profissional com roupa social, sorrindo, iluminação natural, alta qualidade'"
              style={{
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
              }}
            />
            <div className="mt-2 text-xs text-gray-500">Seja específico para melhores resultados. Exemplos: iluminação, ambiente, lente, estilo.</div>
          </div>
        </>
      )}

    </div>
  )
}