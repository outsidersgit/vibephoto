import { requireActiveSubscription } from '@/lib/subscription'
import { getReadyModelsByUserId } from '@/lib/db/models'
import { redirect } from 'next/navigation'
import { GenerationInterface } from '@/components/generation/generation-interface'
import { VideoGenerationInterface } from '@/components/generation/video-generation-interface'
import { CreditManager } from '@/lib/credits/manager'
import { getImageGenerationCost, getVideoGenerationCost } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface GeneratePageProps {
  searchParams?: {
    model?: string
    tab?: string
    sourceImage?: string
  }
}

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const session = await requireActiveSubscription()
  const userId = session.user.id

  // Get user's ready models
  const rawModels = await getReadyModelsByUserId(userId)
  const models = rawModels.map(model => ({
    ...model,
    class: model.class as string,
    qualityScore: model.qualityScore ?? undefined
  }))

  const params = searchParams ?? {}
  const activeTab = params.tab === 'video' ? 'video' : 'image'
  const sourceImage = params.sourceImage ? decodeURIComponent(params.sourceImage) : undefined

  // Verificar se usuário tem modelos
  const hasNoModels = models.length === 0

  const userPlan = ((session.user as any).plan || 'STARTER') as Plan
  const imageCreditsNeeded = getImageGenerationCost(1)
  const videoCreditsNeeded = getVideoGenerationCost(5)

  const [imageAffordability, videoAffordability, userCredits] = await Promise.all([
    CreditManager.canUserAfford(userId, imageCreditsNeeded, userPlan),
    CreditManager.canUserAfford(userId, videoCreditsNeeded, userPlan),
    CreditManager.getUserCredits(userId, userPlan)
  ])

  const canUseImageCredits = imageAffordability.canAfford
  const canUseVideoCredits = videoAffordability.canAfford
  const currentCredits = userCredits.totalCredits

  // Select model (from URL param or first available)
  const selectedModelId = models.length > 0 && params.model && models.find(m => m.id === params.model)
    ? params.model
    : (models[0]?.id ?? '')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-0" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {activeTab === 'video' ? 'Gerar Vídeos com IA' : 'Gerar Fotos com IA'}
            </h1>

            {/* Tabs - Mobile optimized */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 -mx-4 sm:mx-0">
              {/* Tab de Imagens - desabilitada se não tiver modelos */}
              {hasNoModels ? (
                <div
                  className="flex-1 sm:flex-none py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium text-center text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                  style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                  title="Crie um modelo para gerar imagens"
                >
                  Imagens
                </div>
              ) : (
                <a
                  href="/generate"
                  className={`flex-1 sm:flex-none py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium transition-colors text-center ${
                    activeTab === 'image'
                      ? 'text-[#667EEA] border-b-2 border-[#667EEA] bg-[#667EEA]/5 dark:bg-[#667EEA]/10'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                >
                  Imagens
                </a>
              )}
              
              {/* Tab de Vídeos - sempre disponível */}
              <a
                href="/generate?tab=video"
                className={`flex-1 sm:flex-none py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium transition-colors text-center ${
                  activeTab === 'video'
                    ? 'text-[#667EEA] border-b-2 border-[#667EEA] bg-[#667EEA]/5 dark:bg-[#667EEA]/10'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Vídeos
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'image' ? (
          hasNoModels ? (
            // Mensagem quando não tem modelos e tenta acessar tab de imagens
            <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Nenhum modelo encontrado
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
                Crie um modelo com suas fotos para liberar a geração de imagens personalizadas. O processo leva apenas alguns minutos e garante resultados mais realistas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <a
                  href="/models/create"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white font-semibold shadow-lg hover:shadow-xl transition"
                >
                  Criar meu modelo agora
                </a>
                <a
                  href="/generate?tab=video"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-[#667EEA] text-[#667EEA] font-semibold hover:bg-[#667EEA]/5 transition"
                >
                  Gerar vídeos com IA
                </a>
              </div>
            </div>
          ) : (
            <GenerationInterface
              models={models}
              selectedModelId={selectedModelId}
              user={session.user}
              canUseCredits={canUseImageCredits}
            />
          )
        ) : (
          <VideoGenerationInterface
            user={session.user}
            canUseCredits={canUseVideoCredits}
            sourceImageUrl={sourceImage}
            creditsNeeded={videoCreditsNeeded}
            currentCredits={currentCredits}
          />
        )}
      </div>
    </div>
  )
}