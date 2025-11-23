'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessingMessageProps {
  message?: string
  type?: 'image' | 'video' | 'model' | 'editor' | 'package' | 'custom'
  isProcessing: boolean
  className?: string
}

/**
 * Componente de mensagem fixa durante processamento
 * Aparece abaixo do botão principal e some automaticamente quando finaliza
 */
export function ProcessingMessage({ 
  message, 
  type = 'custom',
  isProcessing,
  className 
}: ProcessingMessageProps) {
  // Não renderiza se não estiver processando
  if (!isProcessing) return null

  // Usa mensagem padrão se não fornecida
  const displayMessage = message || PROCESSING_MESSAGES[type] || PROCESSING_MESSAGES.image

  // Ícone baseado no tipo
  const Icon = Loader2

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg",
        "bg-gradient-to-r from-blue-50 to-purple-50",
        "border border-blue-200",
        "animate-in fade-in-50 slide-in-from-top-2 duration-300",
        className
      )}
    >
      <Icon className="w-5 h-5 text-blue-600 flex-shrink-0 animate-spin mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium leading-relaxed">
          {displayMessage}
        </p>
      </div>
    </div>
  )
}

/**
 * Mensagens pré-definidas para cada tipo de processamento
 */
export const PROCESSING_MESSAGES = {
  image: "Sua imagem está sendo processada. Você será avisado quando ficar pronta e pode acompanhar também na galeria.",
  video: "Seu vídeo está sendo processado. Você será avisado quando ficar pronto e pode acompanhar também na galeria.",
  model: "Estamos treinando seu modelo. Você será avisado quando estiver pronto. Acompanhe o progresso na página de Modelos.",
  editor: "Sua edição está sendo processada. Você será avisado quando ficar pronta e pode acompanhar também na galeria.",
  package: "Seu pacote de fotos está sendo gerado. Você pode acompanhar o progresso em tempo real ou continuar navegando."
} as const

/**
 * Hook para gerenciar estado de processamento
 */
export function useProcessingState() {
  return {
    isProcessing: false,
    setIsProcessing: () => {}
  }
}
