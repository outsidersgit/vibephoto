import { requireActiveSubscription } from '@/lib/subscription'
import { PackagesPageClient } from './packages-client'

// ISR: Revalidar a cada 30 minutos (Fase 2 - Otimização de Performance)
export const revalidate = 1800

export default async function PackagesPage() {
  const session = await requireActiveSubscription()

  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Pacotes de Fotos</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area with Dark Theme */}
      <div className="bg-gray-900 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PackagesPageClient />
        </div>
      </div>
    </div>
  )
}