/**
 * Componente padronizado para exibir mensagem de créditos insuficientes
 * Usado em: /generate, /generate?tab=video, /editor
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface InsufficientCreditsBannerProps {
  creditsNeeded: number
  currentCredits: number
  /** Tipo de funcionalidade bloqueada */
  feature: 'generation' | 'video' | 'edit'
  /** Se true, exibe como banner inline. Se false, exibe como página completa */
  variant?: 'inline' | 'fullpage'
}

export function InsufficientCreditsBanner({
  creditsNeeded,
  currentCredits,
  feature,
  variant = 'inline'
}: InsufficientCreditsBannerProps) {
  const featureNames = {
    generation: 'gerar imagens',
    video: 'gerar vídeos',
    edit: 'editar imagens no Studio IA'
  }

  const featureName = featureNames[feature]

  // Variante Inline (para exibir dentro da página de geração)
  if (variant === 'inline') {
    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-red-900 mb-1">
              Créditos Insuficientes
            </h3>
            <p className="text-sm text-red-700 mb-3">
              Você precisa de <strong>{creditsNeeded} créditos</strong> para {featureName}, mas tem apenas <strong>{currentCredits} créditos</strong> disponíveis.
            </p>
            <p className="text-sm text-red-600 mb-4">
              💳 Compre pacotes de créditos para continuar gerando sem limites!
            </p>
            <Link href="/billing?tab=credits">
              <Button
                size="sm"
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-medium shadow-md"
              >
                Comprar Créditos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Variante Fullpage (para bloquear completamente a página)
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-200 p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-red-900 mb-3">
            Créditos Insuficientes
          </h2>

          {/* Message */}
          <p className="text-red-700 mb-2">
            Você precisa de pelo menos <strong>{creditsNeeded} créditos</strong> para {featureName}.
          </p>
          <p className="text-red-600 text-sm mb-6">
            Saldo atual: <strong>{currentCredits} créditos</strong>
          </p>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-blue-900 mb-2">
              <strong>💡 Dica:</strong> Compre pacotes de créditos avulsos e use quando quiser, sem mensalidade!
            </p>
            <ul className="text-xs text-blue-800 space-y-1 ml-4">
              <li>✓ Créditos nunca expiram</li>
              <li>✓ Use em qualquer funcionalidade</li>
              <li>✓ Sem compromisso de assinatura</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link href="/billing?tab=credits" className="block">
              <Button
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold text-base py-6 shadow-lg"
              >
                💳 Comprar Créditos
              </Button>
            </Link>

            <Link href="/" className="block">
              <Button
                variant="ghost"
                className="w-full text-gray-600 hover:text-gray-900"
              >
                Voltar ao Início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
