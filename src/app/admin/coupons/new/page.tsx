'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Influencer {
  id: string
  couponCode: string
  user: {
    name: string | null
    email: string
  }
}

export default function NewCouponPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [influencers, setInfluencers] = useState<Influencer[]>([])

  const [formData, setFormData] = useState({
    code: '',
    type: 'DISCOUNT' as 'DISCOUNT' | 'HYBRID',
    discountType: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE',
    discountValue: '',
    durationType: 'FIRST_CYCLE' as 'RECURRENT' | 'FIRST_CYCLE',
    splitDurationType: 'FIRST_CYCLE' as 'RECURRENT' | 'FIRST_CYCLE', // NEW: independent split duration
    influencerId: '',
    commissionType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    customCommissionPercentage: '',
    customCommissionFixedValue: '',
    applicablePlans: [] as string[],
    applicableCycles: [] as string[],
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    maxUses: '',
    maxUsesPerUser: '1'
  })

  useEffect(() => {
    fetchInfluencers()
  }, [])

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
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Validate
      if (!formData.code.trim()) {
        setError('Código é obrigatório')
        setLoading(false)
        return
      }

      if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
        setError('Valor de desconto deve ser maior que zero')
        setLoading(false)
        return
      }

      if (formData.type === 'HYBRID' && !formData.influencerId) {
        setError('Cupom HÍBRIDO requer um influenciador vinculado')
        setLoading(false)
        return
      }

      // Validate percentage
      if (
        formData.discountType === 'PERCENTAGE' &&
        parseFloat(formData.discountValue) > 100
      ) {
        setError('Desconto percentual não pode ser maior que 100%')
        setLoading(false)
        return
      }

      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          maxUsesPerUser: formData.maxUsesPerUser
            ? parseInt(formData.maxUsesPerUser)
            : 1,
          validUntil: formData.validUntil || null,
          influencerId: formData.influencerId || null,
          customCommissionPercentage: formData.customCommissionPercentage
            ? parseFloat(formData.customCommissionPercentage)
            : null,
          customCommissionFixedValue: formData.customCommissionFixedValue
            ? parseFloat(formData.customCommissionFixedValue)
            : null
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/coupons')
        }, 1500)
      } else {
        setError(data.error || 'Erro ao criar cupom')
      }
    } catch (err) {
      setError('Erro ao criar cupom')
      console.error(err)
    } finally {
      setLoading(false)
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

  const toggleCycle = (cycle: string) => {
    setFormData((prev) => ({
      ...prev,
      applicableCycles: prev.applicableCycles.includes(cycle)
        ? prev.applicableCycles.filter((c) => c !== cycle)
        : [...prev.applicableCycles, cycle]
    }))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/admin/coupons"
          className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          ← Voltar para cupons
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Novo Cupom</h1>
        <p className="mt-2 text-gray-600">
          Crie um novo cupom de desconto ou híbrido
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            Cupom criado com sucesso! Redirecionando...
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
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="DESCONTO10"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Será convertido para maiúsculas automaticamente
          </p>
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
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
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
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
              placeholder={formData.discountType === 'PERCENTAGE' ? '10' : '19.90'}
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
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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

                {formData.commissionType === 'PERCENTAGE' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Porcentagem de Comissão * (ex: 20 para 20%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.customCommissionPercentage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customCommissionPercentage: e.target.value
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="20.00"
                      required={formData.type === 'HYBRID' && !!formData.influencerId}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Valor Fixo da Comissão * (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.customCommissionFixedValue}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customCommissionFixedValue: e.target.value
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="50.00"
                      required={formData.type === 'HYBRID' && !!formData.influencerId}
                    />
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-600">
                  Esta comissão será aplicada especificamente para este cupom, sobrescrevendo a comissão padrão do influenciador.
                </p>
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
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
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
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <div className="font-semibold">Primeira Cobrança</div>
              <div className="mt-1 text-xs opacity-70">
                Desconto apenas no primeiro mês
              </div>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {formData.durationType === 'RECURRENT'
              ? 'O desconto será aplicado automaticamente em todas as cobranças enquanto a assinatura estiver ativa'
              : 'O desconto será aplicado apenas na primeira cobrança. Nas próximas cobranças, o valor será automaticamente ajustado para o preço normal do plano'}
          </p>
        </div>

        {/* Split Duration Type - Only for HYBRID coupons */}
        {formData.type === 'HYBRID' && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Duração do Split (Comissão) *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, splitDurationType: 'RECURRENT' }))
                }
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  formData.splitDurationType === 'RECURRENT'
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div className="font-semibold">Recorrente</div>
                <div className="mt-1 text-xs opacity-70">
                  Split em todas as cobranças
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, splitDurationType: 'FIRST_CYCLE' }))
                }
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  formData.splitDurationType === 'FIRST_CYCLE'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div className="font-semibold">Primeira Cobrança</div>
                <div className="mt-1 text-xs opacity-70">
                  Split apenas no primeiro mês
                </div>
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {formData.splitDurationType === 'RECURRENT'
                ? 'A comissão do influencer será aplicada em todas as cobranças enquanto a assinatura estiver ativa'
                : 'A comissão do influencer será aplicada apenas na primeira cobrança. Nas próximas cobranças, o split será automaticamente removido'}
            </p>
          </div>
        )}

        {/* Applicable Plans */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Planos Aplicáveis
          </label>
          <div className="space-y-2">
            {['STARTER', 'PREMIUM', 'GOLD'].map((plan) => (
              <label
                key={plan}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 transition hover:border-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={formData.applicablePlans.includes(plan)}
                  onChange={() => togglePlan(plan)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-white">{plan}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Deixe vazio para aplicar a todos os planos
          </p>
        </div>

        {/* Applicable Cycles */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Ciclos de Cobrança Aplicáveis
          </label>
          <div className="space-y-2">
            {[
              { value: 'MONTHLY', label: 'Mensal' },
              { value: 'ANNUAL', label: 'Anual' }
            ].map((cycle) => (
              <label
                key={cycle.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-gray-300"
              >
                <input
                  type="checkbox"
                  checked={formData.applicableCycles.includes(cycle.value)}
                  onChange={() => toggleCycle(cycle.value)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-gray-900">{cycle.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Deixe vazio para aplicar a ambos os ciclos (mensal e anual)
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
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-purple-600 focus:ring-purple-500"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
              placeholder="Ilimitado"
            />
            <p className="mt-1 text-xs text-gray-500">
              Deixe vazio para ilimitado
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none"
              placeholder="1"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || success}
            className="flex-1 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Cupom'}
          </button>
          <Link
            href="/admin/coupons"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 font-semibold text-white transition hover:border-zinc-600"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
