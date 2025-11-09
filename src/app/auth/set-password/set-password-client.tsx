"use client"
import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function SetPasswordClient() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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

  const renderPasswordField = (label: string, value: string, onChange: (value: string) => void, show: boolean, toggleShow: () => void) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="w-full border rounded-md px-3 py-2 pr-10"
        placeholder={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={toggleShow}
        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Definir senha</h1>
        <p className="text-sm text-gray-600 mb-4">Você está definindo a senha para <b>{email}</b>. Este link expira em 30 minutos.</p>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {status && <div className="mb-3 text-sm text-green-600">{status}</div>}
        <form onSubmit={submit} className="space-y-3">
          {renderPasswordField('Nova senha', password, setPassword, showPassword, () => setShowPassword(prev => !prev))}
          {renderPasswordField('Confirmar senha', confirm, setConfirm, showConfirm, () => setShowConfirm(prev => !prev))}
          <button className="w-full rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700">Salvar senha</button>
        </form>
        <p className="mt-4 text-xs text-gray-500">Se você não solicitou este procedimento, ignore este e-mail/link.</p>
      </div>
    </div>
  )
}
