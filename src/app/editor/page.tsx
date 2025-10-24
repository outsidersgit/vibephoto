import { requireActiveSubscription } from '@/lib/subscription'
import { canUserUseCredits } from '@/lib/db/users'
import { ImageEditorInterface } from '@/components/image-editor/image-editor-interface'
import { imageEditor } from '@/lib/ai/image-editor'

interface ImageEditorPageProps {
  searchParams: Promise<{
    image?: string
  }>
}

export default async function ImageEditorPage({ searchParams }: ImageEditorPageProps) {
  const session = await requireActiveSubscription()
  const userId = session.user.id

  const params = await searchParams
  const preloadedImageUrl = params.image ? decodeURIComponent(params.image) : undefined

  // Check if user has enough credits for image editing
  const canUseCredits = await canUserUseCredits(userId, 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 text-left">
          Editor de imagens
        </h1>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                Você precisa de pelo menos 1 crédito para usar o Editor IA.
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
      </main>
    </div>
  )
}

export const metadata = {
  title: 'Editor IA | VibePhoto',
  description: 'Edite suas fotos com inteligência artificial de última geração. VibePhoto oferece edição precisa, blend inteligente e qualidade superior.',
  keywords: ['editor de imagem', 'inteligência artificial', 'IA', 'edição de fotos', 'blend de imagens', 'vibephoto']
}