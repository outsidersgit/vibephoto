import { requireActiveSubscription } from '@/lib/subscription'
import { CreditOrdersClient } from './credit-orders-client'

export const metadata = {
  title: 'Ordens de Créditos - VibePhoto',
  description: 'Extrato detalhado de todas as movimentações de créditos'
}

export default async function CreditOrdersPage() {
  const session = await requireActiveSubscription()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Ordens de Créditos</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CreditOrdersClient userId={session.user.id} />
      </div>
    </div>
  )
}
