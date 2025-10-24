import { requireActiveSubscription } from '@/lib/subscription'
import { CreditsDashboard } from '@/components/credits/credits-dashboard'

export const metadata = {
  title: 'Dashboard de Créditos - VibePhoto',
  description: 'Painel completo para gerenciar e monitorar seus créditos'
}

export default async function CreditsDashboardPage() {
  const session = await requireActiveSubscription()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <CreditsDashboard user={session.user} />
    </div>
  )
}