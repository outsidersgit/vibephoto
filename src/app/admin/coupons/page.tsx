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
          <div className="text-zinc-200">Carregando cupons...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Cupons de Desconto</h1>
          <p className="mt-2 text-zinc-200">
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
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400">
          {error}
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-200">Nenhum cupom cadastrado</p>
          <Link
            href="/admin/coupons/new"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            Criar Primeiro Cupom
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
          <table className="w-full">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Desconto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Planos
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Influencer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Usos
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Validade
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {coupons.map((coupon) => {
                const expired = isExpired(coupon.validUntil)
                const limitReached = coupon.maxUses && coupon.totalUses >= coupon.maxUses

                return (
                  <tr key={coupon.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-white">
                        {coupon.code}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          coupon.type === 'HYBRID'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {coupon.type === 'HYBRID' ? 'Híbrido' : 'Desconto'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">
                        {formatDiscount(coupon)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-zinc-100">
                        {formatPlans(coupon.applicablePlans)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {coupon.influencer ? (
                        <div className="text-sm">
                          <div className="text-zinc-100">
                            {coupon.influencer.user.name || 'Sem nome'}
                          </div>
                          <div className="text-xs text-zinc-300">
                            {coupon.influencer.couponCode}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                            coupon.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                          }`}
                        >
                          {coupon.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        {expired && (
                          <span className="inline-flex w-fit rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
                            Expirado
                          </span>
                        )}
                        {limitReached && (
                          <span className="inline-flex w-fit rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-400">
                            Limite atingido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">
                        {coupon.totalUses}
                        {coupon.maxUses && (
                          <span className="text-zinc-400">
                            {' '}
                            / {coupon.maxUses}
                          </span>
                        )}
                      </div>
                      {coupon.maxUsesPerUser && (
                        <div className="text-xs text-zinc-300">
                          Máx {coupon.maxUsesPerUser} por usuário
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-zinc-100">
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
