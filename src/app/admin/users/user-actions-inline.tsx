'use client'

import { useState, useEffect } from 'react'
import { NumericInput } from '@/components/ui/numeric-input'

export default function UserActionsInline({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState<'none' | 'credits' | 'delete' | 'edit' | 'subscription'>('none')
  const [delta, setDelta] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [setLink, setSetLink] = useState<string | null>(null)

  // Edit user state
  const [userData, setUserData] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [walletId, setWalletId] = useState('')
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [commissionMode, setCommissionMode] = useState<'percentage' | 'fixed'>('percentage')
  const [commissionPercentage, setCommissionPercentage] = useState('20')
  const [commissionFixedValue, setCommissionFixedValue] = useState('')

  // Subscription status state
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('ACTIVE')
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  async function adjustCredits() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason: 'Ajuste rápido' })
      })
      if (!res.ok) throw new Error('Falha ao ajustar créditos')
      setOpen('none')
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function removeUser() {
    if (!confirm('Excluir este usuário?')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      })
      if (!res.ok) throw new Error('Falha ao excluir usuário')
      setOpen('none')
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendSetPassword() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/set-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao gerar link')
      setSetLink(json.url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function loadUserData() {
    setEditLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/details`)
      if (!res.ok) throw new Error('Falha ao carregar dados do usuário')
      const data = await res.json()
      setUserData(data)
      setIsInfluencer(!!data.influencer)
      setWalletId(data.influencer?.asaasWalletId || '')
      setCouponCode(data.influencer?.couponCode || '')

      if (data.influencer?.commissionPercentage) {
        setCommissionMode('percentage')
        setCommissionPercentage(String(data.influencer.commissionPercentage))
      } else if (data.influencer?.commissionFixedValue) {
        setCommissionMode('fixed')
        setCommissionFixedValue(String(data.influencer.commissionFixedValue))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEditLoading(false)
    }
  }

  async function saveUser() {
    setEditLoading(true)
    setError(null)
    try {
      const body: any = {}

      // Se está habilitando influencer
      if (isInfluencer && !userData?.influencer) {
        // Criar novo influencer - validações
        const walletRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!walletId || !walletId.trim()) {
          throw new Error('Wallet ID é obrigatório para criar influencer')
        }
        if (!walletRegex.test(walletId)) {
          throw new Error('Informe um Wallet ID válido (formato UUID).')
        }
        if (!couponCode || !couponCode.trim()) {
          throw new Error('Código do cupom é obrigatório')
        }

        body.createInfluencer = true
        body.walletId = walletId.trim().toLowerCase()
        body.couponCode = couponCode.trim().toUpperCase()

        if (commissionMode === 'percentage') {
          const percentage = parseFloat(commissionPercentage)
          if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            throw new Error('Percentual de comissão inválido (deve ser entre 0 e 100)')
          }
          body.commissionPercentage = percentage
        } else {
          const fixed = parseFloat(commissionFixedValue)
          if (isNaN(fixed) || fixed <= 0) {
            throw new Error('Valor fixo de comissão inválido')
          }
          body.commissionFixedValue = fixed
        }
      }
      // Se já é influencer e está editando
      else if (isInfluencer && userData?.influencer) {
        const walletRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!walletId || !walletId.trim()) {
          throw new Error('Wallet ID é obrigatório')
        }
        if (!walletRegex.test(walletId)) {
          throw new Error('Informe um Wallet ID válido (formato UUID).')
        }

        // Atualizar apenas se mudou
        if (walletId !== userData.influencer.asaasWalletId) {
          body.walletId = walletId.trim().toLowerCase()
        }
      }

      if (Object.keys(body).length === 0) {
        setOpen('none')
        return
      }

      const res = await fetch(`/api/admin/users/${userId}/influencer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao atualizar dados')
      }
      setOpen('none')
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEditLoading(false)
    }
  }

  async function updateSubscriptionStatus() {
    if (!confirm(`Alterar status de assinatura para ${subscriptionStatus}?`)) return
    setSubscriptionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionStatus })
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao atualizar status')
      }
      setOpen('none')
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  useEffect(() => {
    if (open === 'edit') {
      loadUserData()
    }
  }, [open])

  return (
    <div className="flex items-center gap-2">
      <button className="text-blue-700 hover:underline" onClick={() => setOpen('edit')}>Editar</button>
      <button className="text-green-700 hover:underline" onClick={() => setOpen('subscription')}>Status Assinatura</button>
      <button className="text-purple-700 hover:underline" onClick={() => setOpen('credits')}>Ajustar créditos</button>
      <button className="text-red-600 hover:underline" onClick={() => setOpen('delete')}>Excluir</button>
      <button className="text-gray-700 hover:underline" onClick={sendSetPassword} disabled={sending}>
        {sending ? 'Gerando…' : 'Enviar link definir senha'}
      </button>
      {setLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-lg">
            <div className="font-semibold mb-2">Link para definir senha</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            <div className="text-xs break-all border rounded p-2 bg-gray-50 mb-3">{setLink}</div>
            <button className="rounded border px-3 py-1 text-sm mb-3" onClick={() => { navigator.clipboard.writeText(setLink) }}>Copiar link</button>
            <div className="text-sm text-gray-700 mb-2">Mensagem sugerida:</div>
            <textarea className="w-full border rounded p-2 text-sm" rows={5} readOnly value={`Olá! Seu acesso ao VibePhoto foi criado. Você pode entrar de duas formas:\n\n1) Login com Google (recomendado): use o mesmo e-mail (${email}).\n2) Definir uma senha: acesse o link abaixo em até 30 minutos e crie sua senha. Depois, pode usar e-mail/senha normalmente.\n\nLink: ${setLink}\n\nQualquer dúvida, me avise!`} />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => setSetLink(null)} className="rounded border px-3 py-2 text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
      {open === 'credits' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-sm">
            <div className="font-semibold mb-2">Ajustar créditos</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            <NumericInput
              value={Number.isNaN(delta) ? 0 : delta}
              onChange={(value) => setDelta(value)}
              allowNegative={true}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Ex.: 50 ou -50"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={adjustCredits} disabled={loading} className="rounded border px-3 py-2 text-sm">{loading ? 'Aplicando…' : 'Aplicar'}</button>
              <button onClick={() => setOpen('none')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {open === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-sm">
            <div className="font-semibold mb-2">Excluir usuário</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            <p className="text-sm text-gray-600 mb-3">Esta ação é irreversível.</p>
            <div className="flex items-center gap-2">
              <button onClick={removeUser} disabled={loading} className="rounded border border-red-300 text-red-700 px-3 py-2 text-sm">{loading ? 'Excluindo…' : 'Excluir'}</button>
              <button onClick={() => setOpen('none')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {open === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="font-semibold mb-3">Editar Usuário</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            {editLoading && !userData && <div className="text-sm text-gray-500">Carregando…</div>}
            {userData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-gray-700 mb-1">Email</div>
                    <div className="text-sm text-gray-900">{userData.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-1">Nome</div>
                    <div className="text-sm text-gray-900">{userData.name || '—'}</div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                    <input
                      type="checkbox"
                      checked={isInfluencer}
                      onChange={(e) => setIsInfluencer(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-semibold">Este usuário é influenciador/parceiro</span>
                  </label>

                  {isInfluencer && (
                    <div className="space-y-3 pl-6">
                      {!userData.influencer && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800 mb-3">
                          ℹ️ Você está criando um novo perfil de influencer para este usuário
                        </div>
                      )}

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Código do Cupom {!userData.influencer && <span className="text-red-600">*</span>}
                        </label>
                        {userData.influencer ? (
                          <div className="text-sm text-gray-900 font-mono">{userData.influencer.couponCode}</div>
                        ) : (
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="Ex: MARIA10"
                            className="w-full border rounded-md px-3 py-2 text-sm uppercase"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Wallet ID do Asaas <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={walletId}
                          onChange={(e) => setWalletId(e.target.value)}
                          onBlur={() => setWalletId((prev) => prev.trim().toLowerCase())}
                          placeholder="Ex: 154c8886-677c-141c-b3c7-65042c738580"
                          className="w-full border rounded-md px-3 py-2 font-mono text-sm"
                          pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Formato UUID válido necessário
                        </p>
                      </div>

                      {!userData.influencer && (
                        <>
                          <div>
                            <label className="block text-sm text-gray-700 mb-2">Tipo de comissão</label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  value="percentage"
                                  checked={commissionMode === 'percentage'}
                                  onChange={() => setCommissionMode('percentage')}
                                />
                                Percentual (%)
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  value="fixed"
                                  checked={commissionMode === 'fixed'}
                                  onChange={() => setCommissionMode('fixed')}
                                />
                                Valor fixo (R$)
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Percentual de comissão (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={commissionPercentage}
                                onChange={(e) => setCommissionPercentage(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                disabled={commissionMode !== 'percentage'}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Valor fixo (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={commissionFixedValue}
                                onChange={(e) => setCommissionFixedValue(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                disabled={commissionMode !== 'fixed'}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {userData.influencer && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm text-gray-700 mb-1">Comissão (%)</div>
                            <div className="text-sm text-gray-900">{userData.influencer.commissionPercentage || '—'}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-700 mb-1">Comissão Fixa (R$)</div>
                            <div className="text-sm text-gray-900">{userData.influencer.commissionFixedValue || '—'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={saveUser}
                disabled={editLoading}
                className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {editLoading ? 'Salvando…' : 'Salvar'}
              </button>
              <button onClick={() => setOpen('none')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {open === 'subscription' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-sm">
            <div className="font-semibold mb-2">Alterar Status de Assinatura</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            <div className="mb-3">
              <label className="block text-sm text-gray-700 mb-1">Novo Status</label>
              <select
                value={subscriptionStatus}
                onChange={(e) => setSubscriptionStatus(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="ACTIVE">ACTIVE - Acesso ativo</option>
                <option value="CANCELLED">CANCELLED - Assinatura cancelada</option>
                <option value="EXPIRED">EXPIRED - Assinatura expirada</option>
                <option value="OVERDUE">OVERDUE - Pagamento atrasado</option>
                <option value="PENDING">PENDING - Aguardando pagamento</option>
              </select>
            </div>
            <div className="text-xs text-gray-600 mb-3">
              ⚠️ Alterar para ACTIVE dá acesso imediato ao sistema.
              CANCELLED/EXPIRED/OVERDUE bloqueiam o acesso.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={updateSubscriptionStatus}
                disabled={subscriptionLoading}
                className="rounded bg-green-600 text-white px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-60"
              >
                {subscriptionLoading ? 'Atualizando…' : 'Atualizar'}
              </button>
              <button onClick={() => setOpen('none')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


