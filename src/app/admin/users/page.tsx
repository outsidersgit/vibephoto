import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import UserRowActions from './user-row-actions'
import UserActionsInline from './user-actions-inline'

export const dynamic = 'force-dynamic'

type SearchParams = { searchParams?: Promise<{ page?: string; q?: string; role?: string; status?: string; sort?: string; dir?: string }> }

export default async function AdminUsersPage({ searchParams }: SearchParams) {
  const params = (await (searchParams || Promise.resolve({}))) as any || {}
  const { page = '1', q = '', role = 'all', status = 'all', sort = 'createdAt', dir = 'desc' } = params
  const currentPage = Math.max(1, parseInt(page || '1'))
  const PAGE_SIZE = 20
  const where: any = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' as any } },
      { email: { contains: q, mode: 'insensitive' as any } },
      { plan: { contains: q, mode: 'insensitive' as any } },
    ]
  }
  if (role !== 'all') where.role = role
  if (status !== 'all') where.subscriptionStatus = status
  const dirVal = dir === 'asc' ? 'asc' : 'desc'
  const orderBy: any = sort === 'name' ? { name: dirVal } : { createdAt: dirVal }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    (prisma.user.findMany as any)({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        creditsUsed: true,
        creditsLimit: true,
        createdAt: true,
        role: true,
      }
    })
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const usersList = users as any[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Usuários</h2>
        <div className="flex items-center gap-2">
          <a href="/admin/users/new" className="rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700">Novo usuário</a>
        </div>
      </div>
      <form className="flex flex-col md:flex-row gap-2">
        <input name="q" defaultValue={q || ''} placeholder="Buscar por nome, email, plano..." className="w-full border rounded-md px-3 py-2" />
        <select name="role" defaultValue={role} className="border rounded-md px-3 py-2">
          <option value="all">Todos</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select name="status" defaultValue={status} className="border rounded-md px-3 py-2">
          <option value="all">Qualquer status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="PAST_DUE">PAST_DUE</option>
        </select>
        <select name="sort" defaultValue={sort} className="border rounded-md px-3 py-2">
          <option value="createdAt">Criado em</option>
          <option value="name">Nome</option>
        </select>
        <select name="dir" defaultValue={dir} className="border rounded-md px-3 py-2">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <button className="rounded-md border px-3 py-2 text-sm">Filtrar</button>
      </form>
      <div className="overflow-auto border border-gray-200 rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Plano</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Créditos</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usersList.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.name || '-'}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.plan || '-'}</td>
                <td className="px-3 py-2">{u.subscriptionStatus || '-'}</td>
                <td className="px-3 py-2">{(u.creditsLimit ?? 0) - (u.creditsUsed ?? 0)}</td>
                <td className="px-3 py-2">{new Date(u.createdAt as any).toLocaleDateString()}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <UserRowActions userId={u.id} />
                    <UserActionsInline userId={u.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>
          Página {currentPage} de {totalPages} — {total} itens
        </div>
        <div className="flex gap-2">
          <Link className={`px-3 py-1 rounded border ${currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''}`} href={`/admin/users?page=${currentPage - 1}&q=${encodeURIComponent(q || '')}&role=${role}&status=${status}&sort=${sort}&dir=${dir}`}>
            Anterior
          </Link>
          <Link className={`px-3 py-1 rounded border ${currentPage >= totalPages ? 'opacity-50 pointer-events-none' : ''}`} href={`/admin/users?page=${currentPage + 1}&q=${encodeURIComponent(q || '')}&role=${role}&status=${status}&sort=${sort}&dir=${dir}`}>
            Próxima
          </Link>
        </div>
      </div>
    </div>
  )
}


