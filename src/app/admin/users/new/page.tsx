'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [walletId, setWalletId] = useState('')
  const [commissionMode, setCommissionMode] = useState<'percentage' | 'fixed'>('percentage')
  const [commissionPercentage, setCommissionPercentage] = useState('20')
  const [commissionFixedValue, setCommissionFixedValue] = useState('')

  // Coupon configuration
  const [couponType, setCouponType] = useState<'HYBRID'>('HYBRID')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [durationType, setDurationType] = useState<'RECURRENT' | 'FIRST_CYCLE'>('FIRST_CYCLE')
  const [applicablePlans, setApplicablePlans] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1')

  const generatedDefaultCoupon = useMemo(() => {
    const seed = nameInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${seed ? seed.slice(0, 6) : 'VIBE'}${random}`
  }, [nameInput])

  const ensureCouponCode = () => {
    setCouponCode(prev => (prev ? prev.toUpperCase() : generatedDefaultCoupon))
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, any> = {
        name: (formData.get('name') as string) || undefined,
        email: formData.get('email') as string,
        role: (formData.get('role') as string) || 'user',
        plan: (formData.get('plan') as string) || undefined,
        subscriptionStatus: (formData.get('subscriptionStatus') as string) || undefined
      }
      const influencerEnabled = formData.get('isInfluencer') === 'on'

      if (influencerEnabled) {
        const coupon = (formData.get('couponCode') as string || '').trim().toUpperCase()
        const walletInput = (formData.get('walletId') as string || '').trim()

        const walletRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!walletRegex.test(walletInput)) {
          throw new Error('Informe um Wallet ID válido (formato UUID).')
        }

        const percentageValueRaw = formData.get('commissionPercentage') as string
        const fixedValueRaw = formData.get('commissionFixedValue') as string

        const percentageValue = percentageValueRaw
          ? parseFloat(percentageValueRaw.replace(',', '.'))
          : undefined
        const fixedValue = fixedValueRaw
          ? parseFloat(fixedValueRaw.replace(',', '.'))
          : undefined

        // Coupon configuration from form
        const couponDiscountValue = formData.get('discountValue') as string
        const couponDiscountType = formData.get('discountType') as string
        const couponDurationType = formData.get('durationType') as string
        const couponApplicablePlans = applicablePlans
        const couponIsActive = formData.get('couponIsActive') === 'on'
        const couponValidFrom = formData.get('validFrom') as string
        const couponValidUntil = formData.get('validUntil') as string
        const couponMaxUses = formData.get('maxUses') as string
        const couponMaxUsesPerUser = formData.get('maxUsesPerUser') as string

        body.influencer = {
          walletId: walletInput,
          couponCode: coupon || undefined,
          commissionPercentage: commissionMode === 'percentage' && Number.isFinite(percentageValue)
            ? percentageValue
            : undefined,
          commissionFixedValue: commissionMode === 'fixed' && Number.isFinite(fixedValue)
            ? fixedValue
            : undefined,
          // Coupon configuration
          coupon: {
            type: 'HYBRID',
            discountType: couponDiscountType || 'PERCENTAGE',
            discountValue: couponDiscountValue ? parseFloat(couponDiscountValue) : undefined,
            durationType: couponDurationType || 'FIRST_CYCLE',
            applicablePlans: couponApplicablePlans,
            isActive: couponIsActive,
            validFrom: couponValidFrom || undefined,
            validUntil: couponValidUntil || undefined,
            maxUses: couponMaxUses ? parseInt(couponMaxUses) : undefined,
            maxUsesPerUser: couponMaxUsesPerUser ? parseInt(couponMaxUsesPerUser) : 1
          }
        }
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Falha ao criar usuário')
      }
      router.push('/admin/users')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900">Novo Usuário</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700">Nome</label>
          <input
            name="name"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value)
            }}
            className="mt-1 w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Email</label>
          <input name="email" type="email" required className="mt-1 w-full border rounded-md px-3 py-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700">Role</label>
            <select name="role" defaultValue="user" className="mt-1 w-full border rounded-md px-3 py-2">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Plano</label>
            <input name="plan" placeholder="Ex.: FREE / PRO / PREMIUM" className="mt-1 w-full border rounded-md px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Status de Assinatura</label>
          <input name="subscriptionStatus" placeholder="Ex.: ACTIVE / CANCELLED / PAST_DUE" className="mt-1 w-full border rounded-md px-3 py-2" />
        </div>
        <div className="border rounded-md px-4 py-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isInfluencer"
              checked={isInfluencer}
              onChange={(event) => {
                const next = event.target.checked
                setIsInfluencer(next)
                if (next && !couponCode) {
                  ensureCouponCode()
                }
              }}
            />
            Este usuário é influenciador?
          </label>
          {isInfluencer && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700">Wallet ID do Asaas do influenciador</label>
                <input
                  name="walletId"
                  value={walletId}
                  onChange={(event) => setWalletId(event.target.value)}
                  onBlur={() => setWalletId((prev) => prev.trim().toLowerCase())}
                  required
                  placeholder="Ex: 154c8886-677c-141c-b3c7-65042c738580"
                  className="mt-1 w-full border rounded-md px-3 py-2 font-mono"
                  pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Peça ao influenciador para criar a conta no Asaas e fornecer o Wallet ID (formato UUID).
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-700">Código do cupom (opcional)</label>
                <div className="flex gap-2 mt-1">
                  <input
                    name="couponCode"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="EX: MARIA10"
                    className="flex-1 border rounded-md px-3 py-2 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setCouponCode(generatedDefaultCoupon)}
                    className="px-3 py-2 text-sm border rounded-md text-gray-700 hover:bg-gray-100"
                  >
                    Gerar código
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Caso deixe em branco, geraremos um código automaticamente.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Tipo de comissão</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="commissionMode"
                      value="percentage"
                      checked={commissionMode === 'percentage'}
                      onChange={() => setCommissionMode('percentage')}
                    />
                    Percentual (%)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="commissionMode"
                      value="fixed"
                      checked={commissionMode === 'fixed'}
                      onChange={() => setCommissionMode('fixed')}
                    />
                    Valor fixo (R$)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700">
                    Percentual de comissão (%)
                  </label>
                  <input
                    name="commissionPercentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionPercentage}
                    onChange={(event) => setCommissionPercentage(event.target.value)}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    disabled={commissionMode !== 'percentage'}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">
                    Valor fixo (R$)
                  </label>
                  <input
                    name="commissionFixedValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={commissionFixedValue}
                    onChange={(event) => setCommissionFixedValue(event.target.value)}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    disabled={commissionMode !== 'fixed'}
                  />
                </div>
              </div>

              {/* Coupon Configuration */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuração do Cupom de Desconto</h3>
                <p className="text-xs text-gray-500 mb-4">
                  O código de cupom será automaticamente criado como um cupom HÍBRIDO (desconto + comissão do influenciador)
                </p>

                {/* Discount Type and Value */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm text-gray-700">Tipo de Desconto</label>
                    <select
                      name="discountType"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    >
                      <option value="PERCENTAGE">Percentual (%)</option>
                      <option value="FIXED">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Valor do Desconto</label>
                    <input
                      name="discountValue"
                      type="number"
                      step="0.01"
                      min="0"
                      max={discountType === 'PERCENTAGE' ? '100' : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'PERCENTAGE' ? '10' : '19.90'}
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Duration Type */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-700 mb-2">Duração do Desconto</label>
                  <input type="hidden" name="durationType" value={durationType} />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDurationType('RECURRENT')}
                      className={`px-3 py-2 text-sm rounded border text-left ${
                        durationType === 'RECURRENT'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold">Recorrente</div>
                      <div className="text-xs opacity-70">Todas as cobranças</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationType('FIRST_CYCLE')}
                      className={`px-3 py-2 text-sm rounded border text-left ${
                        durationType === 'FIRST_CYCLE'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold">Primeira Cobrança</div>
                      <div className="text-xs opacity-70">Apenas primeiro mês</div>
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {durationType === 'RECURRENT'
                      ? 'Desconto aplicado em todas as cobranças'
                      : 'Desconto apenas na primeira cobrança, valor ajustado automaticamente depois'}
                  </p>
                </div>

                {/* Applicable Plans */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-700 mb-2">Planos Aplicáveis</label>
                  <div className="space-y-2">
                    {['STARTER', 'PREMIUM', 'GOLD'].map((plan) => (
                      <label key={plan} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={applicablePlans.includes(plan)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setApplicablePlans([...applicablePlans, plan])
                            } else {
                              setApplicablePlans(applicablePlans.filter((p) => p !== plan))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        {plan}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Deixe vazio para aplicar a todos os planos
                  </p>
                </div>

                {/* Status */}
                <div className="mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="couponIsActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Cupom ativo
                  </label>
                </div>

                {/* Validity Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm text-gray-700">Válido Desde</label>
                    <input
                      name="validFrom"
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Válido Até</label>
                    <input
                      name="validUntil"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Deixe vazio para sem data de expiração
                    </p>
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700">Máximo de Usos Totais</label>
                    <input
                      name="maxUses"
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Ilimitado"
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Deixe vazio para ilimitado
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Máximo de Usos por Usuário</label>
                    <input
                      name="maxUsesPerUser"
                      type="number"
                      min="1"
                      value={maxUsesPerUser}
                      onChange={(e) => setMaxUsesPerUser(e.target.value)}
                      placeholder="1"
                      className="mt-1 w-full border rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button disabled={loading} className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700 disabled:opacity-60">
            {loading ? 'Criando…' : 'Criar usuário'}
          </button>
          <button type="button" onClick={() => router.push('/admin/users')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
        </div>
      </form>
    </div>
  )
}


