'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface Influencer {
  id: string
  couponCode: string
  user: {
    name: string | null
    email: string
  }
}

interface Coupon {
  id: string
  code: string
  type: 'DISCOUNT' | 'HYBRID'
  discountType: 'FIXED' | 'PERCENTAGE'
  discountValue: number
  influencer: Influencer | null
  applicablePlans: string[]
  isActive: boolean
  validFrom: string
  validUntil: string | null
  maxUses: number | null
  maxUsesPerUser: number | null
  totalUses: number
  _count: {
    usages: number
  }
  createdAt: string
}

export default function CouponsAdminPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/coupons')
      const data = await response.json()

      if (response.ok) {
        setCoupons(data.coupons)
      } else {
        setError(data.error || 'Erro ao buscar cupons')
      }
    } catch (err) {
      setError('Erro ao buscar cupons')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}%`
    }
    return formatCurrency(Number(coupon.discountValue))
  }

  const formatPlans = (plans: string[]) => {
    if (plans.length === 0) return 'Todos os planos'
    return plans.join(', ')
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sem limite'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-700">Carregando cupons...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cupons de Desconto</h1>
          <p className="mt-2 text-gray-600">
            Gerencie cupons de desconto e cupons híbridos
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
        >
          Novo Cupom
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-600">Nenhum cupom cadastrado</p>
          <Link
            href="/admin/coupons/new"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            Criar Primeiro Cupom
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Desconto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Planos
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Influencer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Usos
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Validade
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((coupon) => {
                const expired = isExpired(coupon.validUntil)
                const limitReached = coupon.maxUses && coupon.totalUses >= coupon.maxUses

                return (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-gray-900">
                        {coupon.code}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          coupon.type === 'HYBRID'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {coupon.type === 'HYBRID' ? 'Híbrido' : 'Desconto'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDiscount(coupon)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {formatPlans(coupon.applicablePlans)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {coupon.influencer ? (
                        <div className="text-sm">
                          <div className="text-gray-700">
                            {coupon.influencer.user.name || 'Sem nome'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {coupon.influencer.couponCode}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                            coupon.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {coupon.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        {expired && (
                          <span className="inline-flex w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Expirado
                          </span>
                        )}
                        {limitReached && (
                          <span className="inline-flex w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                            Limite atingido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {coupon.totalUses}
                        {coupon.maxUses && (
                          <span className="text-zinc-400">
                            {' '}
                            / {coupon.maxUses}
                          </span>
                        )}
                      </div>
                      {coupon.maxUsesPerUser && (
                        <div className="text-xs text-zinc-400">
                          Máx {coupon.maxUsesPerUser} por usuário
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {formatDate(coupon.validUntil)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/coupons/${coupon.id}/edit`}
                          className="text-sm text-blue-400 hover:text-blue-300"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
