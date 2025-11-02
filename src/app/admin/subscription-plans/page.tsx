import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = { searchParams?: Promise<{ status?: string }> }

export default async function AdminSubscriptionPlansPage({ searchParams }: SearchParams) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return <div className="p-6 text-sm text-gray-700">Acesso restrito ao administrador.</div>
  }
  
  const { status = 'all' } = (await (searchParams || Promise.resolve({}))) || {}
  const where: any = { deletedAt: null }
  
  if (status === 'active') where.isActive = true
  if (status === 'inactive') where.isActive = false

  const plans = await prisma.subscriptionPlan.findMany({
    where,
    orderBy: [
      { popular: 'desc' },
      { monthlyPrice: 'asc' }
    ]
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Planos de Assinatura</h2>
        <Link
          href="/admin/subscription-plans/new"
          className="rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700"
        >
          Novo Plano
        </Link>
      </div>
      
      <form className="flex flex-col md:flex-row gap-2">
        <select name="status" defaultValue={status} className="border rounded-md px-3 py-2">
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button className="rounded-md border px-3 py-2 text-sm">Filtrar</button>
      </form>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan: any) => (
          <div
            key={plan.id}
            className={`border rounded-lg p-4 ${
              plan.popular ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
            } ${!plan.isActive ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                {plan.popular && (
                  <span className="inline-block mt-1 text-xs bg-purple-500 text-white px-2 py-0.5 rounded">
                    Popular
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {plan.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
            
            <div className="space-y-2 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Mensal:</span>
                <span className="font-semibold">R$ {plan.monthlyPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Anual:</span>
                <span className="font-semibold">R$ {plan.annualPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Créditos:</span>
                <span className="font-semibold">{plan.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Modelos:</span>
                <span className="font-semibold">{plan.models}</span>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <Link
                href={`/admin/subscription-plans/${plan.id}/edit`}
                className="flex-1 text-center rounded-md bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
              >
                Editar
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {plans.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum plano encontrado.
        </div>
      )}
    </div>
  )
}

