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
  const [commissionPercentage, setCommissionPercentage] = useState('20')
  const [commissionFixedValue, setCommissionFixedValue] = useState('')
  const [influencerDocument, setInfluencerDocument] = useState('')
  const [influencerPostalCode, setInfluencerPostalCode] = useState('')
  const [influencerIncomeValue, setInfluencerIncomeValue] = useState('1000')
  const [influencerPhone, setInfluencerPhone] = useState('')

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
        const commissionPercentageValue = formData.get('commissionPercentage') as string
        const commissionFixedValueInput = formData.get('commissionFixedValue') as string
        const document = (formData.get('influencerDocument') as string || '').trim()
        const postalCode = (formData.get('influencerPostalCode') as string || '').trim()
        const incomeValueRaw = formData.get('influencerIncomeValue') as string
        const phone = (formData.get('influencerPhone') as string || '').trim()
        const coupon = (formData.get('couponCode') as string || '').trim().toUpperCase()

        const cleanDocument = document.replace(/\D/g, '')
        if (cleanDocument.length < 11) {
          throw new Error('Informe um CPF/CNPJ válido para o influenciador.')
        }

        const cleanPostalCode = postalCode.replace(/\D/g, '')
        if (cleanPostalCode.length !== 8) {
          throw new Error('Informe um CEP válido para o influenciador.')
        }

        const incomeValue = parseFloat((incomeValueRaw || '').replace(',', '.'))
        if (!Number.isFinite(incomeValue) || incomeValue <= 0) {
          throw new Error('Informe a renda mensal (incomeValue) do influenciador.')
        }

        const commissionPercentageNumber = commissionPercentageValue
          ? parseFloat(commissionPercentageValue.replace(',', '.'))
          : undefined
        const commissionFixedNumber = commissionFixedValueInput
          ? parseFloat(commissionFixedValueInput.replace(',', '.'))
          : undefined

        body.cpfCnpj = cleanDocument
        body.postalCode = cleanPostalCode
        if (phone) {
          body.phone = phone
        }

        body.influencer = {
          couponCode: coupon || generatedDefaultCoupon,
          commissionPercentage: Number.isFinite(commissionPercentageNumber) ? commissionPercentageNumber : undefined,
          commissionFixedValue: Number.isFinite(commissionFixedNumber) ? commissionFixedNumber : undefined,
          cpfCnpj: cleanDocument,
          postalCode: cleanPostalCode,
          incomeValue,
          phone,
          personType: cleanDocument.length > 11 ? 'JURIDICA' : 'FISICA'
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
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Código do cupom</label>
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700">Percentual comissão (%)</label>
                  <input
                    name="commissionPercentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionPercentage}
                    onChange={(event) => setCommissionPercentage(event.target.value)}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Valor fixo (R$)</label>
                  <input
                    name="commissionFixedValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={commissionFixedValue}
                    onChange={(event) => setCommissionFixedValue(event.target.value)}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md px-3 py-2 text-sm">
                <p className="font-semibold">Informe sempre um CEP válido</p>
                <p className="mt-1">
                  O <code className="font-mono text-xs">postalCode</code> informado precisa ser válido para que o Asaas cadastre
                  a cidade corretamente. Caso não seja localizado, a API retornará erro <code className="font-mono text-xs">400</code>.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700">CPF/CNPJ</label>
                  <input
                    name="influencerDocument"
                    value={influencerDocument}
                    onChange={(event) => setInfluencerDocument(event.target.value)}
                    placeholder="Somente números"
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">CEP</label>
                  <input
                    name="influencerPostalCode"
                    value={influencerPostalCode}
                    onChange={(event) => setInfluencerPostalCode(event.target.value)}
                    placeholder="00000-000"
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700">Renda mensal (incomeValue)</label>
                  <input
                    name="influencerIncomeValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={influencerIncomeValue}
                    onChange={(event) => setInfluencerIncomeValue(event.target.value)}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Telefone (opcional)</label>
                  <input
                    name="influencerPhone"
                    value={influencerPhone}
                    onChange={(event) => setInfluencerPhone(event.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1 w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="border border-rose-300 bg-rose-50 text-rose-900 rounded-md px-3 py-2 text-sm">
                <p className="font-semibold">Atenção</p>
                <p className="mt-1">
                  Informe a renda mensal no campo acima. O Asaas exige o envio do campo <code className="font-mono text-xs">incomeValue</code> para
                  criação de subcontas a partir de 30/05/24.
                </p>
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


