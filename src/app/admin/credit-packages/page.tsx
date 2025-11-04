import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { CreditPackageService } from '@/lib/services/credit-package-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { searchParams?: Promise<{ status?: string }> }

export default async function AdminCreditPackagesPage({ searchParams }: SearchParams) {
  noStore()
  await requireAdmin()
  
  // Inicializar pacotes padrão se não existirem
  await CreditPackageService.initializeDefaultPackages()
  
  const { status = 'all' } = (await (searchParams || Promise.resolve({}))) || {}
  const where: any = {}
  
  if (status === 'active') where.isActive = true
  if (status === 'inactive') where.isActive = false

  const packages = await prisma.creditPackage.findMany({
    where,
    orderBy: { sortOrder: 'asc' }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Pacotes de Créditos</h2>
        <Link
          href="/admin/credit-packages/new"
          className="rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700"
        >
          Criar Novo Pacote
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Link
          href="/admin/credit-packages"
          className={`px-3 py-1 text-sm rounded ${
            status === 'all'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos
        </Link>
        <Link
          href="/admin/credit-packages?status=active"
          className={`px-3 py-1 text-sm rounded ${
            status === 'active'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Ativos
        </Link>
        <Link
          href="/admin/credit-packages?status=inactive"
          className={`px-3 py-1 text-sm rounded ${
            status === 'inactive'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inativos
        </Link>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créditos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordem</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">{pkg.id}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{pkg.name}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {pkg.creditAmount}
                  {pkg.bonusCredits > 0 && (
                    <span className="text-green-600 ml-1">+{pkg.bonusCredits} bônus</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">R$ {pkg.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{pkg.sortOrder}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      pkg.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {pkg.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/credit-packages/${pkg.id}/edit`}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {packages.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum pacote encontrado
        </div>
      )}
    </div>
  )
}

