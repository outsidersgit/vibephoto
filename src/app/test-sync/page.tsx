import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function TestSyncPage() {
  const session = await requireAuth()
  const userId = session.user.id

  // Get processing generations for debugging
  const processingGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'PROCESSING'
    },
    select: {
      id: true,
      jobId: true,
      prompt: true,
      createdAt: true,
      status: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Get recent completed generations for comparison
  const completedGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED'
    },
    select: {
      id: true,
      jobId: true,
      prompt: true,
      createdAt: true,
      completedAt: true,
      imageUrls: true
    },
    orderBy: { completedAt: 'desc' },
    take: 5
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🔄 Test Sync - Debug Generations
          </h1>

          {/* Processing Generations */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📋 Processing Generations ({processingGenerations.length})
            </h2>
            
            {processingGenerations.length === 0 ? (
              <p className="text-gray-500 italic">No processing generations found</p>
            ) : (
              <div className="space-y-4">
                {processingGenerations.map((gen) => (
                  <div key={gen.id} className="border rounded-lg p-4 bg-yellow-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {gen.prompt?.substring(0, 80)}...
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Job ID: <code className="bg-gray-200 px-1 rounded">{gen.jobId}</code>
                        </p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(gen.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Age: {Math.round((Date.now() - new Date(gen.createdAt).getTime()) / 60000)} minutes
                        </p>
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <SyncSingleButton jobId={gen.jobId!} generationId={gen.id} />
                        <CheckReplicateButton jobId={gen.jobId!} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Sync All */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">🔄 Sync Actions</h2>
            <div className="flex space-x-4">
              <SyncAllButton />
              <CheckWebhookConfigButton />
            </div>
          </div>

          {/* Recent Completed Generations */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✅ Recent Completed Generations ({completedGenerations.length})
            </h2>
            
            {completedGenerations.length === 0 ? (
              <p className="text-gray-500 italic">No completed generations found</p>
            ) : (
              <div className="space-y-3">
                {completedGenerations.map((gen) => (
                  <div key={gen.id} className="border rounded-lg p-3 bg-green-50">
                    <p className="font-medium text-gray-900 text-sm">
                      {gen.prompt?.substring(0, 60)}...
                    </p>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>
                        Completed: {gen.completedAt ? new Date(gen.completedAt).toLocaleString() : 'Unknown'}
                      </span>
                      <span>
                        Images: {gen.imageUrls ? gen.imageUrls.length : 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Client components for actions
function SyncSingleButton({ jobId, generationId }: { jobId: string, generationId: string }) {
  return (
    <button
      onClick={async () => {
        const response = await fetch(`/api/debug/generations?action=sync&jobId=${jobId}`)
        const data = await response.json()
        console.log('Single sync result:', data)
        if (data.updated) {
          window.location.reload()
        }
      }}
      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
    >
      🔄 Sync This
    </button>
  )
}

function CheckReplicateButton({ jobId }: { jobId: string }) {
  return (
    <button
      onClick={async () => {
        console.log(`Checking Replicate status for job: ${jobId}`)
        // This would open Replicate console or show status
        window.open(`https://replicate.com/predictions/${jobId}`, '_blank')
      }}
      className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
    >
      👁️ View on Replicate
    </button>
  )
}

function SyncAllButton() {
  return (
    <button
      onClick={async () => {
        console.log('Starting sync all...')
        const response = await fetch('/api/sync/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        console.log('Sync all result:', data)
        if (data.syncedCount > 0) {
          alert(`Synced ${data.syncedCount} generations!`)
          window.location.reload()
        } else {
          alert('No updates needed')
        }
      }}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
    >
      🔄 Sync All Processing
    </button>
  )
}

function CheckWebhookConfigButton() {
  return (
    <button
      onClick={async () => {
        const response = await fetch('/api/debug/generations')
        const data = await response.json()
        console.log('Webhook config:', data)
        alert(JSON.stringify(data.debug, null, 2))
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
    >
      ⚙️ Check Webhook Config
    </button>
  )
}