'use client'

import { useState, useEffect } from 'react'
import { NumericInput } from '@/components/ui/numeric-input'

export default function UserActionsInline({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState<'none' | 'credits' | 'delete' | 'edit'>('none')
  const [delta, setDelta] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [setLink, setSetLink] = useState<string | null>(null)

  // Edit user state
  const [userData, setUserData] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [walletId, setWalletId] = useState('')

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
      setWalletId(data.influencer?.asaasWalletId || '')
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

      // Se o usuário tem influencer e o walletId foi alterado
      if (userData?.influencer && walletId && walletId !== userData.influencer.asaasWalletId) {
        const walletRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!walletRegex.test(walletId)) {
          throw new Error('Informe um Wallet ID válido (formato UUID).')
        }
        body.walletId = walletId.trim().toLowerCase()
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

  useEffect(() => {
    if (open === 'edit') {
      loadUserData()
    }
  }, [open])

  return (
    <div className="flex items-center gap-2">
      <button className="text-blue-700 hover:underline" onClick={() => setOpen('edit')}>Editar</button>
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
          <div className="bg-white rounded p-4 w-full max-w-lg">
            <div className="font-semibold mb-3">Editar Usuário</div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            {editLoading && !userData && <div className="text-sm text-gray-500">Carregando…</div>}
            {userData && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-700 mb-1">Email</div>
                  <div className="text-sm text-gray-900">{userData.email}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-1">Nome</div>
                  <div className="text-sm text-gray-900">{userData.name || '—'}</div>
                </div>
                {userData.influencer && (
                  <>
                    <div className="border-t pt-3">
                      <div className="text-sm font-semibold text-gray-900 mb-3">Dados do Influencer</div>
                      <div className="mb-3">
                        <div className="text-sm text-gray-700 mb-1">Código do Cupom</div>
                        <div className="text-sm text-gray-900">{userData.influencer.couponCode}</div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-sm text-gray-700 mb-1">Wallet ID do Asaas</label>
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
                    </div>
                  </>
                )}
                {!userData.influencer && (
                  <div className="text-sm text-gray-500 italic">
                    Este usuário não é um influencer
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={saveUser}
                disabled={editLoading || !userData?.influencer}
                className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {editLoading ? 'Salvando…' : 'Salvar'}
              </button>
              <button onClick={() => setOpen('none')} className="text-sm text-gray-700 hover:underline">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


