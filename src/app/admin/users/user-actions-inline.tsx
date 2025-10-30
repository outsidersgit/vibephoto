'use client'

import { useState } from 'react'

export default function UserActionsInline({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState<'none' | 'credits' | 'delete'>('none')
  const [delta, setDelta] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [setLink, setSetLink] = useState<string | null>(null)

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

  return (
    <div className="flex items-center gap-2">
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
            <input type="number" value={Number.isNaN(delta) ? 0 : delta} onChange={e => setDelta(parseInt(e.target.value || '0'))} className="w-full border rounded px-3 py-2 text-sm" placeholder="Ex.: 50 ou -50" />
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
    </div>
  )
}


