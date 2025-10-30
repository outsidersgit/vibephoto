import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Charts from './charts'

export const dynamic = 'force-dynamic'

async function getKpis() {
  const [users, gens, models, purchases] = await Promise.all([
    prisma.user.count(),
    prisma.generation.count(),
    prisma.aIModel.count(),
    prisma.creditTransaction.count()
  ])
  return { users, gens, models, purchases }
}

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return <div className="p-6 text-sm text-gray-700">Acesso restrito ao administrador.</div>
  }
  const kpis = await getKpis()
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Usuários', value: kpis.users },
          { label: 'Gerações', value: kpis.gens },
          { label: 'Modelos', value: kpis.models },
          { label: 'Transações de Créditos', value: kpis.purchases }
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{c.value}</div>
          </div>
        ))}
      </div>
      <Charts />
    </div>
  )
}


