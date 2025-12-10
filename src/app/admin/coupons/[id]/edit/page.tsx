'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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
  durationType: 'RECURRENT' | 'FIRST_CYCLE'
  influencer: Influencer | null
  customCommissionPercentage: number | null
  customCommissionFixedValue: number | null
  applicablePlans: string[]
  isActive: boolean
  validFrom: string
  validUntil: string | null
  maxUses: number | null
  maxUsesPerUser: number | null
  totalUses: number
}

export default function EditCouponPage() {
  const router = useRouter()
  const params = useParams()
  const couponId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [coupon, setCoupon] = useState<Coupon | null>(null)

  const [formData, setFormData] = useState({
    code: '',
    type: 'DISCOUNT' as 'DISCOUNT' | 'HYBRID',
    discountType: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE',
    discountValue: '',
    durationType: 'FIRST_CYCLE' as 'RECURRENT' | 'FIRST_CYCLE',
    influencerId: '',
    commissionType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    customCommissionPercentage: '',
    customCommissionFixedValue: '',
    applicablePlans: [] as string[],
    isActive: true,
    validFrom: '',
    validUntil: '',
    maxUses: '',
    maxUsesPerUser: '1'
  })

  useEffect(() => {
    fetchCoupon()
    fetchInfluencers()
  }, [couponId])

  const fetchCoupon = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/coupons/${couponId}`)
      const data = await response.json()

      if (response.ok) {
        const c = data.coupon
        setCoupon(c)

        // Determine commission type from existing data
        const hasPercentage = c.customCommissionPercentage !== null && c.customCommissionPercentage !== undefined
        const hasFixed = c.customCommissionFixedValue !== null && c.customCommissionFixedValue !== undefined

        setFormData({
          code: c.code,
          type: c.type,
          discountType: c.discountType,
          discountValue: c.discountValue.toString(),
          durationType: c.durationType || 'FIRST_CYCLE',
          influencerId: c.influencer?.id || '',
          commissionType: hasFixed ? 'FIXED' : 'PERCENTAGE',
          customCommissionPercentage: c.customCommissionPercentage?.toString() || '',
          customCommissionFixedValue: c.customCommissionFixedValue?.toString() || '',
          applicablePlans: c.applicablePlans || [],
          isActive: c.isActive,
          validFrom: c.validFrom ? new Date(c.validFrom).toISOString().split('T')[0] : '',
          validUntil: c.validUntil ? new Date(c.validUntil).toISOString().split('T')[0] : '',
          maxUses: c.maxUses?.toString() || '',
          maxUsesPerUser: c.maxUsesPerUser?.toString() || '1'
        })
      } else {
        setError(data.error || 'Erro ao carregar cupom')
      }
    } catch (err) {
      setError('Erro ao carregar cupom')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchInfluencers = async () => {
    try {
      const response = await fetch('/api/admin/influencers')
      const data = await response.json()
      if (response.ok) {
        setInfluencers(data.influencers || [])
      }
    } catch (err) {
      console.error('Error fetching influencers:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      // Validate
      if (!formData.code.trim()) {
        setError('Código é obrigatório')
        setSaving(false)
        return
      }

      if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
        setError('Valor de desconto deve ser maior que zero')
        setSaving(false)
        return
      }

      if (formData.type === 'HYBRID' && !formData.influencerId) {
        setError('Cupom HÍBRIDO requer um influenciador vinculado')
        setSaving(false)
        return
      }

      // Validate percentage
      if (
        formData.discountType === 'PERCENTAGE' &&
        parseFloat(formData.discountValue) > 100
      ) {
        setError('Desconto percentual não pode ser maior que 100%')
        setSaving(false)
        return
      }

      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          customCommissionPercentage: formData.commissionType === 'PERCENTAGE' && formData.customCommissionPercentage
            ? parseFloat(formData.customCommissionPercentage)
            : null,
          customCommissionFixedValue: formData.commissionType === 'FIXED' && formData.customCommissionFixedValue
            ? parseFloat(formData.customCommissionFixedValue)
            : null,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          maxUsesPerUser: formData.maxUsesPerUser
            ? parseInt(formData.maxUsesPerUser)
            : 1,
          validUntil: formData.validUntil || null,
          influencerId: formData.influencerId || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/coupons')
        }, 1500)
      } else {
        setError(data.error || 'Erro ao atualizar cupom')
      }
    } catch (err) {
      setError('Erro ao atualizar cupom')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este cupom?')) {
      return
    }

    try {
      setDeleting(true)
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/admin/coupons')
      } else {
        setError(data.error || 'Erro ao deletar cupom')
      }
    } catch (err) {
      setError('Erro ao deletar cupom')
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const togglePlan = (plan: string) => {
    setFormData((prev) => ({
      ...prev,
      applicablePlans: prev.applicablePlans.includes(plan)
        ? prev.applicablePlans.filter((p) => p !== plan)
        : [...prev.applicablePlans, plan]
    }))
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-700">Carregando cupom...</div>
        </div>
      </div>
    )
  }

  if (!coupon) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          Cupom não encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/admin/coupons"
          className="mb-4 inline-flex items-center text-sm text-gray-700 hover:text-gray-900"
        >
          ← Voltar para cupons
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Editar Cupom</h1>
        <p className="mt-2 text-gray-700">
          Editando cupom: <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
        </p>
        {coupon.totalUses > 0 && (
          <div className="mt-2 text-sm text-orange-700 bg-orange-50 px-3 py-2 rounded">
            ⚠️ Este cupom já foi usado {coupon.totalUses} vez(es). Algumas alterações podem afetar usos futuros.
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8"
      >
        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-700">
            Cupom atualizado com sucesso! Redirecionando...
          </div>
        )}

        {/* Code */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Código do Cupom *
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                code: e.target.value.toUpperCase()
              }))
            }
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="DESCONTO10"
            required
          />
        </div>

        {/* Type */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Tipo de Cupom *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, type: 'DISCOUNT' }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.type === 'DISCOUNT'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold">Desconto</div>
              <div className="mt-1 text-xs opacity-70">
                Apenas desconto no preço
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, type: 'HYBRID' }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.type === 'HYBRID'
                  ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold">Híbrido</div>
              <div className="mt-1 text-xs opacity-70">
                Desconto + comissão influencer
              </div>
            </button>
          </div>
        </div>

        {/* Discount Type and Value */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Tipo de Desconto *
            </label>
            <select
              value={formData.discountType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  discountType: e.target.value as 'FIXED' | 'PERCENTAGE'
                }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
            >
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor Fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Valor do Desconto *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={formData.discountType === 'PERCENTAGE' ? '100' : undefined}
              value={formData.discountValue}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  discountValue: e.target.value
                }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Influencer (only for HYBRID) */}
        {formData.type === 'HYBRID' && (
          <>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Influenciador Vinculado *
              </label>
              <select
                value={formData.influencerId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    influencerId: e.target.value
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
                required={formData.type === 'HYBRID'}
              >
                <option value="">Selecione um influenciador</option>
                {influencers.map((inf) => (
                  <option key={inf.id} value={inf.id}>
                    {inf.user.name || inf.user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Commission Configuration */}
            {formData.influencerId && (
              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="text-sm font-semibold text-purple-900 mb-3">
                  Configuração de Comissão para este Cupom
                </h3>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Tipo de Comissão *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, commissionType: 'PERCENTAGE' }))
                      }
                      className={`rounded-lg border px-4 py-2 text-sm transition ${
                        formData.commissionType === 'PERCENTAGE'
                          ? 'border-purple-500 bg-purple-100 text-purple-700 font-semibold'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Percentual (%)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, commissionType: 'FIXED' }))
                      }
                      className={`rounded-lg border px-4 py-2 text-sm transition ${
                        formData.commissionType === 'FIXED'
                          ? 'border-purple-500 bg-purple-100 text-purple-700 font-semibold'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                {formData.commissionType === 'PERCENTAGE' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Comissão Percentual (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.customCommissionPercentage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customCommissionPercentage: e.target.value
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
                      placeholder="Ex: 10.5"
                    />
                    <p className="mt-1 text-xs text-gray-600">
                      Deixe vazio para usar comissão padrão do influenciador
                    </p>
                  </div>
                )}

                {formData.commissionType === 'FIXED' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Comissão em Valor Fixo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.customCommissionFixedValue}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customCommissionFixedValue: e.target.value
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
                      placeholder="Ex: 15.00"
                    />
                    <p className="mt-1 text-xs text-gray-600">
                      Deixe vazio para usar comissão padrão do influenciador
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Duration Type */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Duração do Desconto *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, durationType: 'RECURRENT' }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.durationType === 'RECURRENT'
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold">Recorrente</div>
              <div className="mt-1 text-xs opacity-70">
                Desconto em todas as cobranças
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, durationType: 'FIRST_CYCLE' }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.durationType === 'FIRST_CYCLE'
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold">Primeira Cobrança</div>
              <div className="mt-1 text-xs opacity-70">
                Desconto apenas no primeiro mês
              </div>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            {formData.durationType === 'RECURRENT'
              ? 'O desconto será aplicado automaticamente em todas as cobranças enquanto a assinatura estiver ativa'
              : 'O desconto será aplicado apenas na primeira cobrança. Nas próximas cobranças, o valor será automaticamente ajustado para o preço normal do plano'}
          </p>
        </div>

        {/* Applicable Plans */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Planos Aplicáveis
          </label>
          <div className="space-y-2">
            {['STARTER', 'PREMIUM', 'GOLD'].map((plan) => (
              <label
                key={plan}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={formData.applicablePlans.includes(plan)}
                  onChange={() => togglePlan(plan)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-gray-900">{plan}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Deixe vazio para aplicar a todos os planos
          </p>
        </div>

        {/* Status */}
        <div className="mb-6">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-semibold text-gray-900">
              Cupom ativo
            </span>
          </label>
        </div>

        {/* Validity Dates */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Válido Desde
            </label>
            <input
              type="date"
              value={formData.validFrom}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, validFrom: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Válido Até
            </label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, validUntil: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-600">
              Deixe vazio para sem data de expiração
            </p>
          </div>
        </div>

        {/* Usage Limits */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Máximo de Usos Totais
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxUses}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, maxUses: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
              placeholder="Ilimitado"
            />
            <p className="mt-1 text-xs text-gray-600">
              Usado {coupon.totalUses} vez(es)
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Máximo de Usos por Usuário
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxUsesPerUser}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxUsesPerUser: e.target.value
                }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving || success}
            className="flex-1 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-gray-900 transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving || success}
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-6 py-3 font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Deletando...' : 'Deletar'}
          </button>
          <Link
            href="/admin/coupons"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition hover:border-zinc-600"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
