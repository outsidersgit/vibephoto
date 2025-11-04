'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'

export default function NewCreditPackagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    creditAmount: 0,
    price: 0,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 0
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validações básicas
    if (!formData.id.trim()) {
      setError('ID é obrigatório')
      setLoading(false)
      return
    }

    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      setLoading(false)
      return
    }

    if (formData.creditAmount <= 0) {
      setError('Quantidade de créditos deve ser maior que zero')
      setLoading(false)
      return
    }

    if (formData.price <= 0) {
      setError('Preço deve ser maior que zero')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/admin/credit-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar pacote')
      }

      router.push('/admin/credit-packages')
    } catch (err: any) {
      setError(err.message || 'Erro ao criar pacote')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Criar Novo Pacote de Créditos</h2>
        <Button
          variant="outline"
          onClick={() => router.push('/admin/credit-packages')}
        >
          Cancelar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID do Pacote *
          </label>
          <input
            type="text"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="ESSENTIAL, ADVANCED, PRO, etc."
            required
          />
          <p className="text-xs text-gray-500 mt-1">Use apenas letras maiúsculas e números</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do Pacote *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Pacote Essencial"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
            placeholder="Ideal para teste e uso esporádico"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade de Créditos *
            </label>
            <NumericInput
              value={formData.creditAmount}
              onChange={(value) => setFormData({ ...formData, creditAmount: value })}
              min={1}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Créditos Bônus
            </label>
            <NumericInput
              value={formData.bonusCredits}
              onChange={(value) => setFormData({ ...formData, bonusCredits: value })}
              min={0}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preço (R$) *
            </label>
            <NumericInput
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              min={0.01}
              step={0.01}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Validade (meses)
            </label>
            <NumericInput
              value={formData.validityMonths}
              onChange={(value) => setFormData({ ...formData, validityMonths: value })}
              min={1}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ordem de Exibição
            </label>
            <NumericInput
              value={formData.sortOrder}
              onChange={(value) => setFormData({ ...formData, sortOrder: value })}
              min={0}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Menor número aparece primeiro</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.isActive ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? 'Criando...' : 'Criar Pacote'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/credit-packages')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}

