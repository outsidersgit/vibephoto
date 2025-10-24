import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function DebugPage() {
  const session = await requireAuth()
  const userId = session.user.id

  // Get problematic generations
  const problematicGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      jobId: { not: null },
      OR: [
        { imageUrls: { equals: [] } },
        { imageUrls: null },
        { 
          imageUrls: {
            path: ['0'],
            string_contains: 'replicate.delivery'
          }
        }
      ]
    },
    select: {
      id: true,
      jobId: true,
      prompt: true,
      createdAt: true,
      completedAt: true,
      imageUrls: true,
      thumbnailUrls: true,
      status: true,
      errorMessage: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Get healthy generations for comparison
  const healthyGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      AND: [
        { imageUrls: { not: null } },
        { NOT: { imageUrls: { equals: [] } } },
        { 
          NOT: {
            imageUrls: {
              path: ['0'],
              string_contains: 'replicate.delivery'
            }
          }
        }
      ]
    },
    select: {
      id: true,
      prompt: true,
      createdAt: true,
      completedAt: true,
      imageUrls: true,
      thumbnailUrls: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            🔧 Debug - Image Storage Issues
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{problematicGenerations.length}</div>
              <div className="text-sm text-red-700">Gerações com problemas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{healthyGenerations.length}</div>
              <div className="text-sm text-green-700">Gerações saudáveis</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">AWS S3</div>
              <div className="text-sm text-blue-700">Storage Provider</div>
            </div>
          </div>
        </div>

        {/* Emergency Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">🚨 Ações de Emergência</h2>
          <div className="flex flex-wrap gap-4">
            <EmergencyRecoveryButton />
            <FixS3PermissionsButton />
            <TestStorageButton />
            <SyncAllButton />
            <CheckS3Button />
          </div>
        </div>

        {/* Problematic Generations */}
        {problematicGenerations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">
              ❌ Gerações com Problemas ({problematicGenerations.length})
            </h2>
            <div className="space-y-4">
              {problematicGenerations.map((gen) => (
                <div key={gen.id} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {gen.prompt?.substring(0, 80)}...
                      </p>
                      <div className="text-xs text-gray-600 mt-2 space-y-1">
                        <p><strong>ID:</strong> {gen.id}</p>
                        <p><strong>Job ID:</strong> <code className="bg-gray-200 px-1 rounded">{gen.jobId}</code></p>
                        <p><strong>Created:</strong> {new Date(gen.createdAt).toLocaleString()}</p>
                        <p><strong>Completed:</strong> {gen.completedAt ? new Date(gen.completedAt).toLocaleString() : 'N/A'}</p>
                        <p><strong>Images:</strong> {gen.imageUrls ? gen.imageUrls.length : 0}</p>
                        {gen.imageUrls && gen.imageUrls.length > 0 && (
                          <p><strong>First URL:</strong> <code className="text-xs">{gen.imageUrls[0].substring(0, 60)}...</code></p>
                        )}
                        {gen.errorMessage && (
                          <p><strong>Error:</strong> <span className="text-red-600">{gen.errorMessage}</span></p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <RecoverSingleButton jobId={gen.jobId!} generationId={gen.id} />
                      <ViewReplicateButton jobId={gen.jobId!} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Healthy Generations */}
        {healthyGenerations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">
              ✅ Gerações Saudáveis ({healthyGenerations.length})
            </h2>
            <div className="space-y-3">
              {healthyGenerations.map((gen) => (
                <div key={gen.id} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50">
                  <p className="font-medium text-gray-900 text-sm">
                    {gen.prompt?.substring(0, 60)}...
                  </p>
                  <div className="text-xs text-gray-600 mt-1 flex justify-between">
                    <span>Images: {gen.imageUrls ? gen.imageUrls.length : 0}</span>
                    <span>Completed: {gen.completedAt ? new Date(gen.completedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  {gen.imageUrls && gen.imageUrls[0] && (
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>Storage:</strong> {gen.imageUrls[0].includes('amazonaws.com') ? '☁️ AWS S3' : '🔗 Other'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// Client components for actions
function EmergencyRecoveryButton() {
  return (
    <button
      onClick={async () => {
        if (confirm('🚨 Executar recuperação de emergência?\n\nIsso vai tentar recuperar todas as imagens de gerações completadas com URLs expiradas.')) {
          const response = await fetch('/api/emergency-recovery', { method: 'POST' })
          const data = await response.json()
          alert(`Resultado:\n- Recuperadas: ${data.recoveredCount}\n- Erros: ${data.errorCount}\n- Total processadas: ${data.totalProcessed}`)
          if (data.recoveredCount > 0) {
            window.location.reload()
          }
        }
      }}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      🚨 Recovery Emergência
    </button>
  )
}

function FixS3PermissionsButton() {
  return (
    <button
      onClick={async () => {
        if (confirm('🔧 Corrigir permissões do S3?\n\nIsso vai tornar todas as imagens do S3 públicas e acessíveis.')) {
          const response = await fetch('/api/fix-s3-permissions', { method: 'POST' })
          const data = await response.json()
          alert(`Resultado:\n- Permissões corrigidas: ${data.fixedCount}\n- Erros: ${data.errorCount}\n- Total gerações: ${data.totalGenerations}`)
          if (data.fixedCount > 0) {
            window.location.reload()
          }
        }
      }}
      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
    >
      🔧 Fix S3 Permissions
    </button>
  )
}

function TestStorageButton() {
  return (
    <button
      onClick={async () => {
        // Test image URL from Replicate
        const testUrl = 'https://pbxt.replicate.delivery/1vYsHCvMTPeGJJhbHvKkLWqPJhLJCQGDe9vcP2JJY0JXCtYTA/out-0.png'
        console.log('Testing storage with URL:', testUrl)
        alert('Check console for storage test results')
      }}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      🧪 Test Storage
    </button>
  )
}

function SyncAllButton() {
  return (
    <button
      onClick={async () => {
        const response = await fetch('/api/sync/generations', { method: 'POST' })
        const data = await response.json()
        alert(`Sync completado:\n- Sincronizadas: ${data.syncedCount}\n- Erros: ${data.errorCount}`)
        if (data.syncedCount > 0) {
          window.location.reload()
        }
      }}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
    >
      🔄 Sync All
    </button>
  )
}

function CheckS3Button() {
  return (
    <button
      onClick={async () => {
        const config = {
          provider: process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'aws',
          hasAWSKey: !!process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
          bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'ensaio-fotos-prod'
        }
        alert(`Configuração S3:\n${JSON.stringify(config, null, 2)}`)
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
    >
      ☁️ Check S3 Config
    </button>
  )
}

function RecoverSingleButton({ jobId, generationId }: { jobId: string, generationId: string }) {
  return (
    <button
      onClick={async () => {
        console.log(`Recovering single generation: ${generationId} (job: ${jobId})`)
        const response = await fetch(`/api/debug/generations?action=sync&jobId=${jobId}`)
        const data = await response.json()
        console.log('Single recovery result:', data)
        if (data.updated) {
          alert('✅ Geração recuperada com sucesso!')
          window.location.reload()
        } else {
          alert(`❌ Falha na recuperação: ${data.error || 'Sem atualizações necessárias'}`)
        }
      }}
      className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
    >
      🔧 Recover
    </button>
  )
}

function ViewReplicateButton({ jobId }: { jobId: string }) {
  return (
    <button
      onClick={() => {
        window.open(`https://replicate.com/predictions/${jobId}`, '_blank')
      }}
      className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
    >
      👁️ Replicate
    </button>
  )
}