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
    influencerId: '',
    applicablePlans: [] as string[],
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/admin/coupons"
          className="mb-4 inline-flex items-center text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar para cupons
        </Link>
        <h1 className="text-3xl font-bold text-white">Novo Cupom</h1>
        <p className="mt-2 text-zinc-400">
          Crie um novo cupom de desconto ou híbrido
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900/50 p-8"
      >
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-400">
            Cupom criado com sucesso! Redirecionando...
          </div>
        )}

        {/* Code */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-white">
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 font-mono text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            placeholder="DESCONTO10"
            required
          />
          <p className="mt-1 text-xs text-zinc-500">
            Será convertido para maiúsculas automaticamente
          </p>
        </div>

        {/* Type */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-white">
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
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
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
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
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
            <label className="mb-2 block text-sm font-semibold text-white">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor Fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
              placeholder={formData.discountType === 'PERCENTAGE' ? '10' : '19.90'}
              required
            />
          </div>
        </div>

        {/* Influencer (only for HYBRID) */}
        {formData.type === 'HYBRID' && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-white">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
              required={formData.type === 'HYBRID'}
            >
              <option value="">Selecione um influenciador</option>
              {influencers.map((inf) => (
                <option key={inf.id} value={inf.id}>
                  {inf.user.name || inf.user.email} ({inf.couponCode})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Comissão será enviada para este influenciador
            </p>
          </div>
        )}

        {/* Applicable Plans */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-white">
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
          <p className="mt-1 text-xs text-zinc-500">
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
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-semibold text-white">
              Cupom ativo
            </span>
          </label>
        </div>

        {/* Validity Dates */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Válido Desde
            </label>
            <input
              type="date"
              value={formData.validFrom}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, validFrom: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Válido Até
            </label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, validUntil: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Deixe vazio para sem data de expiração
            </p>
          </div>
        </div>

        {/* Usage Limits */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Máximo de Usos Totais
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxUses}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, maxUses: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
              placeholder="Ilimitado"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Deixe vazio para ilimitado
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
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
