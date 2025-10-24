'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Lightbulb, Copy, RefreshCw, Sparkles, Wand2, Type, ToggleLeft, ToggleRight } from 'lucide-react'
import { PromptBuilder } from './prompt-builder'
import { getModelGender, getGenderPromptSuggestions } from '@/lib/utils/model-gender'

interface PromptInputProps {
  prompt: string
  negativePrompt: string
  onPromptChange: (prompt: string) => void
  onNegativePromptChange: (negativePrompt: string) => void
  isGenerating: boolean
  modelClass?: string
}

export function PromptInput({
  prompt,
  negativePrompt,
  onPromptChange,
  onNegativePromptChange,
  isGenerating,
  modelClass = 'MAN'
}: PromptInputProps) {
  const [showNegativePrompt, setShowNegativePrompt] = useState(false)
  const [isGuidedMode, setIsGuidedMode] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  // Get gender-based prompt suggestions
  const modelGender = getModelGender(modelClass)
  const promptSuggestions = getGenderPromptSuggestions(modelGender)

  const negativePromptSuggestions = [
    'blurry',
    'low quality',
    'distorted',
    'bad anatomy',
    'extra limbs',
    'duplicate',
    'watermark',
    'text',
    'cartoon',
    'cgi',
    '3d render',  
    'unrealistic eyes',
    'plastic skin',
    'distorted hands',
    'extra limbs',
    'anime',
    'wax',
    'smooth'
  ]

  const enhancePrompt = () => {
    if (!prompt.trim()) return
    
    const enhancements = [
      'high quality',
      'detailed',
      'professional photography',
      'natural lighting',
      'sharp focus'
    ]
    
    const randomEnhancements = enhancements
      .sort(() => 0.5 - Math.random())
      .slice(0, 2)
    
    const enhancedPrompt = `${prompt}, ${randomEnhancements.join(', ')}`
    onPromptChange(enhancedPrompt)
  }

  const addSuggestion = (suggestion: string, isNegative = false) => {
    if (isNegative) {
      const current = negativePrompt.trim()
      const newPrompt = current ? `${current}, ${suggestion}` : suggestion
      onNegativePromptChange(newPrompt)
    } else {
      const current = prompt.trim()
      const newPrompt = current ? `${current}, ${suggestion}` : suggestion
      onPromptChange(newPrompt)
    }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt)
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
    onPromptChange(generatedPrompt)
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center space-x-2 mb-2">
        <span className={`text-xs ${!isGuidedMode ? 'text-purple-400 font-medium' : 'text-gray-500'}`}>Livre</span>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          className="p-1 hover:bg-gray-700"
        >
          {isGuidedMode ? (
            <ToggleRight className="w-5 h-5 text-purple-400" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-purple-400" />
          )}
        </Button>

        <span className={`text-xs ${isGuidedMode ? 'text-purple-400 font-medium' : 'text-gray-500'}`}>Guiado</span>
      </div>

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
          <label htmlFor="prompt" className="block text-base font-semibold text-gray-200">
            Descrição da Imagem
          </label>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300 border-slate-600">
              {prompt.length}/1500
            </Badge>
            {prompt && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onPromptChange('')}
                  className="h-6 px-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs"
                  title="Limpar prompt"
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyPrompt}
                  className="h-6 px-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
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
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isGenerating}
          className="w-full px-3 py-3 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none text-white placeholder-slate-400"
          rows={3}
          maxLength={1500}
          placeholder="Descreva a foto que deseja criar... ex: 'foto profissional com roupa social, sorrindo, iluminação natural, alta qualidade'"
        />
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowNegativePrompt(!showNegativePrompt)}
              className="text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            >
              {showNegativePrompt ? 'Ocultar' : 'Mostrar'} Prompt Negativo
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            Seja específico para melhores resultados
          </p>
        </div>

        {/* Prompt Suggestions */}
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowExamples(!showExamples)}
            className="text-gray-400 hover:text-gray-200 hover:bg-gray-700 mb-2"
          >
            {showExamples ? 'Ocultar' : 'Mostrar'} sugestões
          </Button>

          {showExamples && (
            <div className="flex flex-wrap gap-2">
              {promptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => addSuggestion(suggestion, false)}
                  disabled={isGenerating}
                  className="px-3 py-1 text-sm bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-full transition-colors disabled:opacity-50 border border-purple-700/50"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Negative Prompt */}
      {showNegativePrompt && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="negative-prompt" className="block text-sm font-medium text-gray-200">
              Prompt Negativo
            </label>
            <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300 border-slate-600">
              {negativePrompt.length}/200
            </Badge>
          </div>
          
          <textarea
            id="negative-prompt"
            value={negativePrompt}
            onChange={(e) => onNegativePromptChange(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none text-white placeholder-slate-400"
            rows={2}
            maxLength={200}
            placeholder="Coisas a evitar na imagem... ex: 'blurry, low quality, distorted'"
          />
          
          <div className="mt-2">
            <p className="text-sm text-gray-300 mb-2">Exclusões comuns:</p>
            <div className="flex flex-wrap gap-2">
              {negativePromptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => addSuggestion(suggestion, true)}
                  disabled={isGenerating}
                  className="px-3 py-1 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-full transition-colors disabled:opacity-50 border border-red-700/50"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Current Prompt Display (only in guided mode) */}
      {isGuidedMode && prompt && (
        <Card className="bg-gray-700 border-slate-600">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-200">Prompt Atual</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPrompt}
                className="text-gray-400 hover:text-gray-200 hover:bg-gray-600"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {prompt}
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  )
}