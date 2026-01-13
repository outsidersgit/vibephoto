'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface PromptOptimizerProps {
  currentPrompt: string
  onOptimizedPrompt: (optimizedPrompt: string) => void
  type?: 'image' | 'video'
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'inline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Reusable Prompt Optimizer Button Component
 * Uses Gemini 2.5 Flash Lite to enhance user prompts
 */
export function PromptOptimizer({
  currentPrompt,
  onOptimizedPrompt,
  type = 'image',
  className,
  variant = 'outline',
  size = 'default'
}: PromptOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const { addToast } = useToast()

  const handleOptimize = async () => {
    if (!currentPrompt || currentPrompt.trim().length === 0) {
      addToast({
        title: 'Prompt vazio',
        description: 'Digite um prompt antes de otimizar',
        type: 'warning'
      })
      return
    }

    if (currentPrompt.length > 1000) {
      addToast({
        title: 'Prompt muito longo',
        description: 'O prompt deve ter no máximo 1000 caracteres',
        type: 'error'
      })
      return
    }

    setIsOptimizing(true)

    try {
      const response = await fetch('/api/ai/optimize-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: currentPrompt.trim(),
          type
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao otimizar prompt')
      }

      if (data.success && data.data?.optimized) {
        onOptimizedPrompt(data.data.optimized)

        addToast({
          title: 'Prompt otimizado!',
          description: 'Seu prompt foi aprimorado com detalhes adicionais',
          type: 'success'
        })
      } else {
        throw new Error('Resposta inválida do servidor')
      }
    } catch (error) {
      console.error('Erro ao otimizar prompt:', error)
      addToast({
        title: 'Erro ao otimizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        type: 'error'
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  // Inline variant for inside textarea
  if (variant === 'inline') {
    return (
      <button
        onClick={handleOptimize}
        disabled={isOptimizing || !currentPrompt}
        type="button"
        className={`absolute bottom-3 right-3 px-3 py-2 rounded-md transition-all flex items-center gap-2 text-sm ${
          isOptimizing || !currentPrompt
            ? 'text-gray-400 cursor-not-allowed opacity-50'
            : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
        } ${className || ''}`}
        title={isOptimizing ? 'Otimizando...' : 'Otimizar prompt com IA'}
      >
        {isOptimizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Otimizando...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Otimizar prompt</span>
          </>
        )}
      </button>
    )
  }

  // Default button variant
  return (
    <Button
      onClick={handleOptimize}
      disabled={isOptimizing || !currentPrompt}
      variant={variant}
      size={size}
      className={className}
      type="button"
    >
      {isOptimizing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Otimizando...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Otimizar Prompt
        </>
      )}
    </Button>
  )
}
