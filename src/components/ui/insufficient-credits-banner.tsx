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

  // Variante Fullpage (para exibir inline com banner compacto, similar ao /generate)
  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6 shadow-sm max-w-2xl mx-auto mt-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Créditos Insuficientes
          </h3>
          <p className="text-sm text-red-700 mb-1">
            Você precisa de <strong>{creditsNeeded} créditos</strong> para {featureName}, mas tem apenas <strong>{currentCredits} créditos</strong> disponíveis.
          </p>
          <p className="text-sm text-red-600 mb-4">
            💳 Compre pacotes de créditos para continuar gerando sem limites!
          </p>

          <div className="flex gap-3">
            <Link href="/billing?tab=credits">
              <Button
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-medium shadow-md"
              >
                Comprar Créditos
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
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
