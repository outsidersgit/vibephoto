import { requireActiveSubscription } from '@/lib/subscription'
import { PaymentHistoryClient } from './payment-history-client'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'

export const metadata = {
  title: 'Histórico de Pagamentos - VibePhoto',
  description: 'Veja todo o histórico de pagamentos de assinaturas e compras'
}

// ISR: Cache de 2 minutos (Sprint 2 - Performance)
export const revalidate = 120

export default async function PaymentHistoryPage() {
  const session = await requireActiveSubscription()

  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Pagamentos</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PaymentHistoryClient userId={session.user.id} />
      </div>
    </div>
    </>
  )
}
