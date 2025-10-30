import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminRetentionPage() {
  const now = new Date()
  const thirty = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [newUsers, cancelled] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: thirty } } }),
    prisma.user.count({ where: { subscriptionStatus: 'CANCELLED' as any } })
  ])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Retenção</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Novos usuários (30d)</div>
          <div className="text-2xl font-semibold text-gray-900">{newUsers}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Cancelados</div>
          <div className="text-2xl font-semibold text-gray-900">{cancelled}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Retenção (ilustrativo)</div>
          <div className="text-2xl font-semibold text-gray-900">—</div>
        </div>
      </div>
      <p className="text-sm text-gray-500">Séries temporais e coortes podem ser adicionadas conforme necessidade.</p>
    </div>
  )
}


