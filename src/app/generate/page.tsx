import { requireActiveSubscription } from '@/lib/subscription'
import { getReadyModelsByUserId } from '@/lib/db/models'
import { canUserUseCredits } from '@/lib/db/users'
import { redirect } from 'next/navigation'
import { GenerationInterface } from '@/components/generation/generation-interface'
import { VideoGenerationInterface } from '@/components/generation/video-generation-interface'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'

interface GeneratePageProps {
  searchParams: Promise<{
    model?: string
    tab?: string
    sourceImage?: string
  }>
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

  // Check if user has any ready models
  if (models.length === 0) {
    redirect('/models?error=no-ready-models')
  }

  // Check if user has enough credits
  const canUseCredits = await canUserUseCredits(userId, 1)

  const params = await searchParams
  const activeTab = params.tab === 'video' ? 'video' : 'image'
  const sourceImage = params.sourceImage ? decodeURIComponent(params.sourceImage) : undefined

  // Select model (from URL param or first available)
  const selectedModelId = params.model && models.find(m => m.id === params.model)
    ? params.model
    : models[0].id

  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {activeTab === 'video' ? 'Gerar Vídeos com IA' : 'Gerar Fotos com IA'}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <a
              href="/generate"
              className={`py-4 px-6 text-sm font-medium transition-colors ${
                activeTab === 'image'
                  ? 'text-[#667EEA] border-b-2 border-[#667EEA] bg-[#667EEA]/5 dark:bg-[#667EEA]/10'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
            >
              Imagens
            </a>
            <a
              href="/generate?tab=video"
              className={`py-4 px-6 text-sm font-medium transition-colors ${
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
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'image' ? (
          <GenerationInterface
            models={models}
            selectedModelId={selectedModelId}
            user={session.user}
            canUseCredits={canUseCredits}
          />
        ) : (
          <VideoGenerationInterface
            user={session.user}
            canUseCredits={canUseCredits}
            sourceImageUrl={sourceImage}
          />
        )}
      </div>
    </div>
    </>
  )
}