import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function TestImagesPage() {
  const session = await requireAuth()
  const userId = session.user.id

  // Get a few generations to test
  const testGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      AND: [
        { imageUrls: { not: null } },
        { NOT: { imageUrls: { equals: [] } } }
      ]
    },
    select: {
      id: true,
      prompt: true,
      imageUrls: true,
      thumbnailUrls: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 6
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            🖼️ Teste de Carregamento de Imagens
          </h1>
          <p className="text-gray-600 mb-4">
            Esta página testa se as imagens estão carregando corretamente do storage.
          </p>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => window.location.href = '/debug'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔧 Ir para Debug
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              🔄 Recarregar
            </button>
          </div>
        </div>

        {/* Test Images Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testGenerations.map((generation) => (
            <div key={generation.id} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium text-gray-900 mb-2 text-sm">
                {generation.prompt?.substring(0, 60)}...
              </h3>
              
              <div className="space-y-4">
                {/* Original Image */}
                {generation.imageUrls && generation.imageUrls[0] && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Imagem Original:</p>
                    <div className="relative">
                      <img
                        src={generation.imageUrls[0]}
                        alt="Generated"
                        className="w-full h-48 object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.backgroundColor = '#fee2e2'
                          target.style.color = '#dc2626'
                          target.alt = '❌ Erro ao carregar'
                        }}
                        onLoad={(e) => {
                          console.log('✅ Image loaded:', generation.imageUrls![0])
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {generation.imageUrls[0].includes('amazonaws.com') ? '☁️ S3' : 
                         generation.imageUrls[0].includes('replicate.delivery') ? '🔗 Replicate' : '❓'}
                      </div>
                    </div>
                    
                    {/* URL Info */}
                    <div className="text-xs text-gray-500">
                      <p className="break-all">
                        <strong>URL:</strong> {generation.imageUrls[0].substring(0, 80)}...
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => window.open(generation.imageUrls![0], '_blank')}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          🔗 Abrir URL
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(generation.imageUrls![0], { method: 'HEAD' })
                              alert(`Status: ${response.status} ${response.statusText}\nTamanho: ${response.headers.get('content-length')} bytes`)
                            } catch (error) {
                              alert(`Erro: ${error}`)
                            }
                          }}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        >
                          🔍 Testar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thumbnail */}
                {generation.thumbnailUrls && generation.thumbnailUrls[0] && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Thumbnail:</p>
                    <div className="relative">
                      <img
                        src={generation.thumbnailUrls[0]}
                        alt="Thumbnail"
                        className="w-full h-24 object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.backgroundColor = '#fee2e2'
                          target.style.color = '#dc2626'
                          target.alt = '❌ Thumb erro'
                        }}
                      />
                      <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                        THUMB
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Generation Info */}
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p><strong>ID:</strong> {generation.id}</p>
                <p><strong>Created:</strong> {new Date(generation.createdAt).toLocaleString()}</p>
                <p><strong>Images:</strong> {generation.imageUrls?.length || 0}</p>
                <p><strong>Thumbnails:</strong> {generation.thumbnailUrls?.length || 0}</p>
              </div>
            </div>
          ))}
        </div>

        {testGenerations.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Nenhuma geração completada encontrada para teste.</p>
          </div>
        )}
      </div>
    </div>
  )
}