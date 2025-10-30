"use client"
import { useEffect, useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return
    if (document.getElementById('recaptcha-script')) return
    const s = document.createElement('script')
    s.id = 'recaptcha-script'
    s.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
    document.body.appendChild(s)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus(null)
    setLink(null)
    if (!email) { setError('Informe um e-mail válido.'); return }
    setLoading(true)
    try {
      let recaptchaToken: string | undefined
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      if (siteKey && (window as any).grecaptcha) {
        recaptchaToken = await new Promise<string>((resolve) => (window as any).grecaptcha.ready(() => (window as any).grecaptcha.execute(siteKey, { action: 'forgot_password' }).then(resolve)))
      }

      const res = await fetch('/api/auth/set-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar as instruções.')
      setStatus('Se o e-mail existir, enviaremos instruções para redefinir sua senha.')
      // Enquanto o e-mail não está configurado em produção, exibimos o link gerado
      if (json.url) setLink(json.url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Esqueci minha senha</h1>
        <p className="text-sm text-gray-600 mb-4">Digite seu e-mail para receber um link de redefinição de senha.</p>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {status && <div className="mb-3 text-sm text-green-600">{status}</div>}
        <form onSubmit={submit} className="space-y-3">
          <input type="email" className="w-full border rounded-md px-3 py-2" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <button disabled={loading} className="w-full rounded-md bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700">
            {loading ? 'Enviando…' : 'Enviar instruções'}
          </button>
        </form>
        {link && (
          <div className="mt-4 text-xs text-gray-700">
            <div className="mb-1">Link gerado (ambiente de testes):</div>
            <div className="break-all border rounded p-2 bg-gray-50">{link}</div>
            <button className="mt-2 rounded border px-3 py-1" onClick={() => navigator.clipboard.writeText(link)}>Copiar</button>
          </div>
        )}
      </div>
    </div>
  )
}


