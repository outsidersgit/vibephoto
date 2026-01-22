import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { searchParams?: Promise<{ page?: string; status?: string; type?: string }> }

export default async function AdminPaymentsPage({ searchParams }: SearchParams) {
  noStore()
  await requireAdmin()

  const params = (await (searchParams || Promise.resolve({}))) as any || {}
  const { page = '1', status = 'all', type = 'all' } = params
  const currentPage = Math.max(1, parseInt(page || '1'))
  const PAGE_SIZE = 50

  const where: any = {}
  if (status !== 'all') where.status = status
  if (type !== 'all') where.type = type

  const [total, payments, stats] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    // Estatísticas gerais
    prisma.payment.groupBy({
      by: ['status'],
      _count: true,
      _sum: { value: true }
    })
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Calcular estatísticas
  const statsMap = stats.reduce((acc, stat) => {
    acc[stat.status] = {
      count: stat._count,
      revenue: stat._sum.value || 0
    }
    return acc
  }, {} as Record<string, { count: number; revenue: number }>)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'OVERDUE': return 'bg-red-100 text-red-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cobranças</h1>
        <p className="text-sm text-gray-600 mt-1">Histórico de todas as cobranças geradas pelo Asaas</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Confirmadas</div>
          <div className="text-2xl font-bold text-green-600">
            {statsMap['CONFIRMED']?.count || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            R$ {(statsMap['CONFIRMED']?.revenue || 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-600">
            {statsMap['PENDING']?.count || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            R$ {(statsMap['PENDING']?.revenue || 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Atrasadas</div>
          <div className="text-2xl font-bold text-red-600">
            {statsMap['OVERDUE']?.count || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            R$ {(statsMap['OVERDUE']?.revenue || 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500 mt-1">
            {Object.values(statsMap).reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-col md:flex-row gap-2">
        <select name="status" defaultValue={status} className="border rounded-md px-3 py-2">
          <option value="all">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="CONFIRMED">Confirmado</option>
          <option value="OVERDUE">Atrasado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>

        <select name="type" defaultValue={type} className="border rounded-md px-3 py-2">
          <option value="all">Todos os tipos</option>
          <option value="SUBSCRIPTION">Assinatura</option>
          <option value="CREDIT_PURCHASE">Créditos</option>
        </select>

        <button className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50">
          Filtrar
        </button>
      </form>

      {/* Tabela de cobranças */}
      <div className="overflow-auto border border-gray-200 rounded-md bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Vencimento</th>
              <th className="px-3 py-2">Confirmado</th>
              <th className="px-3 py-2">Plano</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  {payment.asaasPaymentId?.slice(0, 8) || '-'}
                </td>
                <td className="px-3 py-2">
                  <div>
                    <div className="font-medium">{payment.user.name || '-'}</div>
                    <div className="text-xs text-gray-500">{payment.user.email}</div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {payment.type === 'SUBSCRIPTION' ? 'Assinatura' : 'Créditos'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  R$ {payment.value.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-3 py-2">
                  {payment.confirmedDate
                    ? new Date(payment.confirmedDate).toLocaleDateString('pt-BR')
                    : '-'}
                </td>
                <td className="px-3 py-2">
                  {payment.planType
                    ? `${payment.planType} ${payment.billingCycle === 'YEARLY' ? '(Anual)' : '(Mensal)'}`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>
          Página {currentPage} de {totalPages} — {total} itens
        </div>
        <div className="flex gap-2">
          <Link
            className={`px-3 py-1 rounded border ${currentPage <= 1 ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}
            href={`/admin/payments?page=${currentPage - 1}&status=${status}&type=${type}`}
          >
            Anterior
          </Link>
          <Link
            className={`px-3 py-1 rounded border ${currentPage >= totalPages ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}
            href={`/admin/payments?page=${currentPage + 1}&status=${status}&type=${type}`}
          >
            Próxima
          </Link>
        </div>
      </div>
    </div>
  )
}
