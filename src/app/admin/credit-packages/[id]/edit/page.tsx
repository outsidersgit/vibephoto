'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'

export default function EditCreditPackagePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Estado original para comparar mudanças
  const [originalData, setOriginalData] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    creditAmount: 0,
    price: 0,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 0
  })

  useEffect(() => {
    async function loadPackage() {
      try {
        if (!id) {
          setError('ID do pacote não fornecido')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/admin/credit-packages/${id}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Erro ao carregar pacote')
        }

        const data = await response.json()
        const pkg = data.package

        if (!pkg) {
          throw new Error('Pacote não encontrado')
        }

        // Salvar dados originais
        setOriginalData(pkg)

        // Preencher formulário
        setFormData({
          name: pkg.name || '',
          description: pkg.description || '',
          creditAmount: pkg.creditAmount || 0,
          price: pkg.price || 0,
          bonusCredits: pkg.bonusCredits || 0,
          validityMonths: pkg.validityMonths || 12,
          isActive: pkg.isActive ?? true,
          sortOrder: pkg.sortOrder || 0
        })

        setLoading(false)
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar pacote')
        setLoading(false)
      }
    }

    loadPackage()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    // Validações básicas
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      setSaving(false)
      return
    }

    if (formData.creditAmount <= 0) {
      setError('Quantidade de créditos deve ser maior que zero')
      setSaving(false)
      return
    }

    if (formData.price <= 0) {
      setError('Preço deve ser maior que zero')
      setSaving(false)
      return
    }

    try {
      // Construir objeto apenas com campos que mudaram
      const updateData: any = {}
      
      if (formData.name !== originalData.name) updateData.name = formData.name
      if (formData.description !== originalData.description) updateData.description = formData.description
      if (formData.creditAmount !== originalData.creditAmount) updateData.creditAmount = formData.creditAmount
      if (formData.price !== originalData.price) updateData.price = formData.price
      if (formData.bonusCredits !== originalData.bonusCredits) updateData.bonusCredits = formData.bonusCredits
      if (formData.validityMonths !== originalData.validityMonths) updateData.validityMonths = formData.validityMonths
      if (formData.isActive !== originalData.isActive) updateData.isActive = formData.isActive
      if (formData.sortOrder !== originalData.sortOrder) updateData.sortOrder = formData.sortOrder

      // Se não há mudanças, apenas retornar
      if (Object.keys(updateData).length === 0) {
        setSuccess('Nenhuma alteração detectada')
        setSaving(false)
        return
      }

      const response = await fetch(`/api/admin/credit-packages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar pacote')
      }

      setSuccess('Pacote atualizado com sucesso!')

      // Atualizar dados originais
      setOriginalData({ ...originalData, ...updateData })

      // Redirecionar após 1 segundo
      setTimeout(() => {
        router.push('/admin/credit-packages')
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar pacote')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este pacote? Esta ação irá desativá-lo.')) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      console.log('🗑️ [DELETE_CREDIT_PKG] Iniciando deleção do pacote:', id)

      const response = await fetch(`/api/admin/credit-packages/${id}`, {
        method: 'DELETE'
      })

      console.log('🗑️ [DELETE_CREDIT_PKG] Response status:', response.status)

      const data = await response.json()
      console.log('🗑️ [DELETE_CREDIT_PKG] Response data:', data)

      if (response.ok) {
        console.log('✅ [DELETE_CREDIT_PKG] Pacote deletado com sucesso, redirecionando...')
        router.push('/admin/credit-packages')
      } else {
        const errorMsg = data.error || 'Erro ao deletar pacote'
        console.error('❌ [DELETE_CREDIT_PKG] Erro na resposta:', errorMsg)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('❌ [DELETE_CREDIT_PKG] Erro ao deletar pacote:', err)
      setError('Erro ao deletar pacote')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando pacote...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Editar Pacote de Créditos</h2>
        <Button
          variant="outline"
          onClick={() => router.push('/admin/credit-packages')}
        >
          Voltar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID do Pacote
          </label>
          <input
            type="text"
            value={id}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">ID não pode ser alterado</p>
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
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="bg-red-500/10 border border-red-500/50 text-red-600 hover:bg-red-500/20 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deletando...' : 'Deletar'}
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

