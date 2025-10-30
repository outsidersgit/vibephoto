'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      const body = {
        name: (formData.get('name') as string) || undefined,
        email: formData.get('email') as string,
        role: (formData.get('role') as string) || 'user',
        plan: (formData.get('plan') as string) || undefined,
        subscriptionStatus: (formData.get('subscriptionStatus') as string) || undefined,
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
          <input name="name" className="mt-1 w-full border rounded-md px-3 py-2" />
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


