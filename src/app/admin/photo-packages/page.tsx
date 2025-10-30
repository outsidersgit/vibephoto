import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = { searchParams?: Promise<{ page?: string; q?: string; status?: string; category?: string }> }

export default async function AdminPhotoPackagesPage({ searchParams }: SearchParams) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return <div className="p-6 text-sm text-gray-700">Acesso restrito ao administrador.</div>
  }
  const { page = '1', q = '', status = 'all', category = '' } = (await (searchParams || Promise.resolve({}))) || {}
  const currentPage = Math.max(1, parseInt(page || '1'))
  const PAGE_SIZE = 20
  const where: any = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' as any } },
      { description: { contains: q, mode: 'insensitive' as any } },
      { category: { contains: q, mode: 'insensitive' as any } }
    ]
  }
  if (status === 'active') where.isActive = true
  if (status === 'inactive') where.isActive = false
  if (category) where.category = { contains: category, mode: 'insensitive' as any }

  const [total, pkgs] = await Promise.all([
    prisma.photoPackage.count({ where }),
    prisma.photoPackage.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE })
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Pacotes de Fotos</h2>
        <a href="/admin/photo-packages/new" className="rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700">Novo pacote</a>
      </div>
      <form className="flex flex-col md:flex-row gap-2">
        <input name="q" defaultValue={q || ''} placeholder="Buscar por nome, descrição ou categoria..." className="w-full border rounded-md px-3 py-2" />
        <select name="status" defaultValue={status} className="border rounded-md px-3 py-2">
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <input name="category" defaultValue={category || ''} placeholder="Categoria" className="border rounded-md px-3 py-2" />
        <button className="rounded-md border px-3 py-2 text-sm">Buscar</button>
      </form>
      <div className="overflow-auto border border-gray-200 rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Preço</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pkgs.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.category || '-'}</td>
                <td className="px-3 py-2">{p.price ? `R$ ${p.price}` : '-'}</td>
                <td className="px-3 py-2">{p.isActive ? 'Ativo' : 'Inativo'}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <a className="text-gray-700 hover:underline" href={`/admin/photo-packages/${p.id}/edit`}>Editar</a>
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
          <Link className={`px-3 py-1 rounded border ${currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''}`} href={`/admin/photo-packages?page=${currentPage - 1}&q=${encodeURIComponent(q || '')}&status=${status}&category=${encodeURIComponent(category || '')}`}>Anterior</Link>
          <Link className={`px-3 py-1 rounded border ${currentPage >= totalPages ? 'opacity-50 pointer-events-none' : ''}`} href={`/admin/photo-packages?page=${currentPage + 1}&q=${encodeURIComponent(q || '')}&status=${status}&category=${encodeURIComponent(category || '')}`}>Próxima</Link>
        </div>
      </div>
    </div>
  )
}


