import { requireActiveSubscription } from '@/lib/subscription'
import { ImageEditorInterface } from '@/components/image-editor/image-editor-interface'
import { CreditManager } from '@/lib/credits/manager'
import { getImageEditCost } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'
import { InsufficientCreditsBanner } from '@/components/ui/insufficient-credits-banner'

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

  // Get current credits for display
  const userCredits = await CreditManager.getUserCredits(userId, userPlan)
  const currentCredits = userCredits.totalCredits

  // DEBUG: Log credit check for troubleshooting
  console.log('📊 [EDITOR PAGE] Credit check:', {
    userId,
    userEmail: session.user.email,
    userPlan,
    creditsNeeded,
    currentCredits,
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
          {/* Banner de Créditos Insuficientes */}
          {!canUseCredits && (
            <InsufficientCreditsBanner
              creditsNeeded={creditsNeeded}
              currentCredits={currentCredits}
              feature="edit"
              variant="inline"
            />
          )}

          {/* Image Editor Interface */}
          <ImageEditorInterface
            preloadedImageUrl={preloadedImageUrl}
            canUseCredits={canUseCredits}
            creditsNeeded={creditsNeeded}
            currentCredits={currentCredits}
          />
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