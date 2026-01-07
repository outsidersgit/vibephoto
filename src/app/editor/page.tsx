import { requireActiveSubscription } from '@/lib/subscription'
import { ImageEditorInterface } from '@/components/image-editor/image-editor-interface'
import { CreditManager } from '@/lib/credits/manager'
import { getImageEditCost } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'

interface ImageEditorPageProps {
  searchParams?: {
    image?: string
  }
}

export default async function ImageEditorPage({ searchParams }: ImageEditorPageProps) {
  const session = await requireActiveSubscription()
  const userId = session.user.id

  const preloadedImageUrl = searchParams?.image ? decodeURIComponent(searchParams.image) : undefined

  const creditsNeeded = getImageEditCost(1)
  const userPlan = ((session.user as any).plan || 'STARTER') as Plan
  const affordability = await CreditManager.canUserAfford(userId, creditsNeeded, userPlan)
  const canUseCredits = affordability.canAfford

  // DEBUG: Log credit check for troubleshooting
  console.log('📊 [EDITOR PAGE] Credit check:', {
    userId,
    userEmail: session.user.email,
    userPlan,
    creditsNeeded,
    canUseCredits,
    reason: affordability.reason
  })

  return (
    <>
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6">
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Studio IA
              </h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!canUseCredits ? (
            <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-xl font-semibold text-red-800 mb-2">
                  Créditos Insuficientes
                </h2>
                <p className="text-red-600 mb-4">
                  Você precisa de pelo menos {creditsNeeded} créditos para usar o Studio IA.
                </p>
                <a
                  href="/credits"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Comprar Créditos
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Image Editor Interface */}
              <ImageEditorInterface preloadedImageUrl={preloadedImageUrl} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

export const metadata = {
  title: 'Studio IA | VibePhoto',
  description: 'Crie e edite suas fotos com inteligência artificial de última geração. VibePhoto oferece criação, edição precisa, blend inteligente e qualidade superior.',
  keywords: ['studio de imagem', 'inteligência artificial', 'IA', 'criação de fotos', 'edição de fotos', 'blend de imagens', 'vibephoto']
}