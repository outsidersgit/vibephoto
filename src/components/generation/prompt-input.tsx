'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Copy } from 'lucide-react'
import { PromptBuilder } from './prompt-builder'

interface PromptInputProps {
  prompt: string
  negativePrompt: string
  onPromptChange: (prompt: string) => void
  isGenerating: boolean
  modelClass?: string
}

export function PromptInput({
  prompt,
  negativePrompt,
  onPromptChange,
  isGenerating,
  modelClass = 'MAN'
}: PromptInputProps) {
  const [isGuidedMode, setIsGuidedMode] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const adjustPromptHeight = () => {
    const el = promptRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 600) + 'px'
  }
  useEffect(() => { adjustPromptHeight() }, [prompt])

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
                  {prompt.length}/2500
                </div>
                {prompt && (
                  <>
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
            
            <textarea
              id="prompt"
              value={prompt}
              ref={promptRef}
              onChange={(e) => { onPromptChange(e.target.value); adjustPromptHeight() }}
              disabled={isGenerating}
              className="w-full px-3 py-3 bg-gray-200 border border-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[#667EEA] focus:border-[#667EEA] resize-none text-gray-900 placeholder:text-gray-500"
              rows={3}
              maxLength={2500}
              placeholder="Descreva a foto que deseja criar... ex: 'foto profissional com roupa social, sorrindo, iluminação natural, alta qualidade'"
              style={{
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
              }}
            />
            <div className="mt-2 text-xs text-gray-500">Seja específico para melhores resultados. Exemplos: iluminação, ambiente, lente, estilo.</div>
          </div>
        </>
      )}

      {/* Current Prompt Display (only in guided mode) */}
      {isGuidedMode && prompt && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Prompt Atual</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPrompt}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {prompt}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}