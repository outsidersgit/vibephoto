import { requireActiveSubscription } from '@/lib/subscription'
import { CreditPackagesInterface } from '@/components/credits/credit-packages-interface'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Pacotes de Créditos - VibePhoto',
  description: 'Compre créditos adicionais para criar mais fotos com IA'
}

export default async function CreditsPage() {
  noStore()
  const session = await requireActiveSubscription()
  
  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Pacotes de Créditos</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CreditPackagesInterface user={session.user} />
      </div>
    </div>
    </>
  )
}