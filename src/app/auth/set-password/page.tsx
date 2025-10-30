"use client"
import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SetPasswordPage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    const res = await fetch('/api/auth/set-password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password })
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Falha ao definir senha'); return }
    setStatus('Senha definida com sucesso. Você já pode fazer login com e-mail e senha.')
    setTimeout(() => router.push('/auth/signin'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Definir senha</h1>
        <p className="text-sm text-gray-600 mb-4">Você está definindo a senha para <b>{email}</b>. Este link expira em 30 minutos.</p>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {status && <div className="mb-3 text-sm text-green-600">{status}</div>}
        <form onSubmit={submit} className="space-y-3">
          <input type="password" className="w-full border rounded-md px-3 py-2" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} />
          <input type="password" className="w-full border rounded-md px-3 py-2" placeholder="Confirmar senha" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button className="w-full rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700">Salvar senha</button>
        </form>
        <p className="mt-4 text-xs text-gray-500">Se você não solicitou este procedimento, ignore este e-mail/link.</p>
      </div>
    </div>
  )
}


