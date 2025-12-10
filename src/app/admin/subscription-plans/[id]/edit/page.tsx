'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'

export default function EditSubscriptionPlanPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [features, setFeatures] = useState<string[]>([''])
  
  // Estado original para comparar mudanças
  const [originalData, setOriginalData] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    planId: 'STARTER' as 'STARTER' | 'PREMIUM' | 'GOLD',
    name: '',
    description: '',
    isActive: true,
    popular: false,
    displayOrder: 0,
    color: 'blue' as 'blue' | 'purple' | 'yellow',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyEquivalent: 0,
    credits: 0,
    models: 1,
    resolution: '1024x1024'
  })

  useEffect(() => {
    async function loadPlan() {
      try {
        if (!id) {
          setError('ID do plano não fornecido')
          setLoading(false)
          return
        }

        console.log('📋 [EDIT_PLAN] Loading plan with id:', id)
        const response = await fetch(`/api/admin/subscription-plans/${id}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ [EDIT_PLAN] Failed to load plan:', errorData)
          throw new Error(errorData.error || 'Plano não encontrado')
        }
        
        const data = await response.json()
        const plan = data.plan

        if (!plan) {
          throw new Error('Plano não encontrado nos dados retornados')
        }

        console.log('✅ [EDIT_PLAN] Plan loaded:', { id: plan.id, planId: plan.planId, name: plan.name })
        
        const loadedFormData = {
          planId: plan.planId,
          name: plan.name || '',
          description: plan.description || '',
          isActive: plan.isActive !== undefined ? plan.isActive : true,
          popular: plan.popular !== undefined ? plan.popular : false,
          displayOrder: plan.displayOrder !== undefined ? plan.displayOrder : 0,
          color: (plan.color || 'blue') as 'blue' | 'purple' | 'yellow',
          monthlyPrice: plan.monthlyPrice || 0,
          annualPrice: plan.annualPrice || 0,
          monthlyEquivalent: plan.monthlyEquivalent || 0,
          credits: plan.credits || 0,
          models: plan.models || 1,
          resolution: plan.resolution || '1024x1024'
        }
        
        setFormData(loadedFormData)
        
        const planFeatures = Array.isArray(plan.features) 
          ? plan.features.map((f: any) => typeof f === 'string' ? f : String(f))
          : []
        
        setFeatures(planFeatures.length > 0 ? planFeatures : [''])
        
        // Salvar dados originais para comparação (após carregar todos os dados)
        setOriginalData({
          ...loadedFormData,
          features: planFeatures.length > 0 ? planFeatures : []
        })
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar plano')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadPlan()
    }
  }, [id])

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...features]
    newFeatures[index] = value
    setFeatures(newFeatures)
  }

  const addFeature = () => {
    setFeatures([...features, ''])
  }

  const removeFeature = (index: number) => {
    const newFeatures = features.filter((_, i) => i !== index)
    if (newFeatures.length === 0) {
      setFeatures([''])
    } else {
      setFeatures(newFeatures)
    }
  }

  const handleFieldUpdate = async (field: string, value: any) => {
    try {
      setError(null)
      setSuccess(null)
      
      const updateData: any = {}
      
      // Se for features, filtrar vazias mas permitir salvar mesmo se vazio (será validado apenas na criação)
      if (field === 'features') {
        const validFeatures = Array.isArray(value) ? value.filter((f: string) => f.trim().length > 0) : []
        // Em edição, permitir features vazias (será validado apenas na criação)
        updateData.features = validFeatures
      } else {
        updateData[field] = value
      }

      const response = await fetch(`/api/admin/subscription-plans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar campo')
      }

      // Atualizar estado local
      if (field === 'features') {
        setFeatures(Array.isArray(value) ? value : [value])
      } else {
        setFormData({ ...formData, [field]: value })
      }

      setSuccess('Campo atualizado com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar campo')
    }
  }

  // Verificar se houve alterações
  const hasChanges = () => {
    if (!originalData) return false

    // Comparar campos básicos
    const basicFieldsChanged =
      formData.name !== originalData.name ||
      formData.description !== originalData.description ||
      formData.isActive !== originalData.isActive ||
      formData.popular !== originalData.popular ||
      formData.displayOrder !== originalData.displayOrder ||
      formData.color !== originalData.color ||
      formData.monthlyPrice !== originalData.monthlyPrice ||
      formData.annualPrice !== originalData.annualPrice ||
      formData.monthlyEquivalent !== originalData.monthlyEquivalent ||
      formData.credits !== originalData.credits ||
      formData.models !== originalData.models ||
      formData.resolution !== originalData.resolution

    // Comparar features
    const originalFeatures = Array.isArray(originalData.features) ? originalData.features : []
    const currentFeatures = features.filter(f => f.trim().length > 0)
    const featuresChanged = JSON.stringify(originalFeatures.sort()) !== JSON.stringify(currentFeatures.sort())

    return basicFieldsChanged || featuresChanged
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Se não houver alterações, não fazer nada (mas não gerar erro)
    if (!hasChanges()) {
      setSuccess('Nenhuma alteração detectada. Dados mantidos.')
      setTimeout(() => setSuccess(null), 3000)
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Preparar dados para atualização (apenas campos que foram alterados)
      const updateData: any = {}

      if (formData.name !== originalData.name) updateData.name = formData.name
      if (formData.description !== originalData.description) updateData.description = formData.description
      if (formData.isActive !== originalData.isActive) updateData.isActive = formData.isActive
      if (formData.popular !== originalData.popular) updateData.popular = formData.popular
      if (formData.displayOrder !== originalData.displayOrder) updateData.displayOrder = formData.displayOrder
      if (formData.color !== originalData.color) updateData.color = formData.color
      if (formData.monthlyPrice !== originalData.monthlyPrice) updateData.monthlyPrice = formData.monthlyPrice
      if (formData.annualPrice !== originalData.annualPrice) updateData.annualPrice = formData.annualPrice
      if (formData.monthlyEquivalent !== originalData.monthlyEquivalent) updateData.monthlyEquivalent = formData.monthlyEquivalent
      if (formData.credits !== originalData.credits) updateData.credits = formData.credits
      if (formData.models !== originalData.models) updateData.models = formData.models
      if (formData.resolution !== originalData.resolution) updateData.resolution = formData.resolution
      
      // Features
      const originalFeatures = Array.isArray(originalData.features) ? originalData.features : []
      const currentFeatures = features.filter(f => f.trim().length > 0)
      const featuresChanged = JSON.stringify(originalFeatures.sort()) !== JSON.stringify(currentFeatures.sort())
      if (featuresChanged) {
        updateData.features = currentFeatures
      }

      // Se não houver nada para atualizar (não deveria chegar aqui, mas segurança)
      if (Object.keys(updateData).length === 0) {
        setSuccess('Nenhuma alteração detectada. Dados mantidos.')
        setSaving(false)
        return
      }

      const response = await fetch(`/api/admin/subscription-plans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        // Se houver detalhes de validação, mostrar mensagens mais específicas
        if (data.issues && Array.isArray(data.issues)) {
          const issuesText = data.issues.map((issue: any) => {
            const field = issue.path?.join('.') || 'campo'
            return `${field}: ${issue.message}`
          }).join(', ')
          throw new Error(`Erro de validação: ${issuesText}`)
        }
        throw new Error(data.error || 'Erro ao atualizar plano')
      }

      // Atualizar dados originais após sucesso
      setOriginalData({
        ...formData,
        features: currentFeatures
      })

      setSuccess('Plano atualizado com sucesso!')
      setTimeout(() => {
        router.push('/admin/subscription-plans')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar plano')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este plano? Esta ação irá desativá-lo.')) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      console.log('🗑️ [DELETE_PLAN] Iniciando deleção do plano:', id)

      const response = await fetch(`/api/admin/subscription-plans/${id}`, {
        method: 'DELETE'
      })

      console.log('🗑️ [DELETE_PLAN] Response status:', response.status)

      const data = await response.json()
      console.log('🗑️ [DELETE_PLAN] Response data:', data)

      if (response.ok) {
        console.log('✅ [DELETE_PLAN] Plano deletado com sucesso, redirecionando...')
        router.push('/admin/subscription-plans')
      } else {
        const errorMsg = data.error || 'Erro ao deletar plano'
        console.error('❌ [DELETE_PLAN] Erro na resposta:', errorMsg)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('❌ [DELETE_PLAN] Erro ao deletar plano:', err)
      setError('Erro ao deletar plano')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar Plano de Assinatura</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ID do Plano</label>
            <select
              disabled
              value={formData.planId}
              className="w-full border rounded-md px-3 py-2 bg-gray-100"
            >
              <option value="STARTER">STARTER</option>
              <option value="PREMIUM">PREMIUM</option>
              <option value="GOLD">GOLD</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">ID do plano não pode ser alterado</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  handleFieldUpdate('name', e.target.value.trim())
                }
              }}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value })
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                handleFieldUpdate('description', e.target.value.trim())
              }
            }}
            className="w-full border rounded-md px-3 py-2"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Preço Mensal (R$)</label>
            <NumericInput
              value={formData.monthlyPrice}
              onChange={(value) => {
                setFormData({ ...formData, monthlyPrice: value })
              }}
              onBlur={() => {
                if (formData.monthlyPrice !== originalData?.monthlyPrice) {
                  handleFieldUpdate('monthlyPrice', formData.monthlyPrice)
                }
              }}
              allowDecimal={true}
              placeholder="0.00"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Preço Anual (R$)</label>
            <NumericInput
              value={formData.annualPrice}
              onChange={(value) => {
                setFormData({ ...formData, annualPrice: value })
              }}
              onBlur={() => {
                if (formData.annualPrice !== originalData?.annualPrice) {
                  handleFieldUpdate('annualPrice', formData.annualPrice)
                }
              }}
              allowDecimal={true}
              placeholder="0.00"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Equivalente Mensal (R$)</label>
            <NumericInput
              value={formData.monthlyEquivalent}
              onChange={(value) => {
                setFormData({ ...formData, monthlyEquivalent: value })
              }}
              onBlur={() => {
                if (formData.monthlyEquivalent !== originalData?.monthlyEquivalent) {
                  handleFieldUpdate('monthlyEquivalent', formData.monthlyEquivalent)
                }
              }}
              allowDecimal={true}
              placeholder="0.00"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Créditos</label>
            <NumericInput
              value={formData.credits}
              onChange={(value) => {
                setFormData({ ...formData, credits: value })
              }}
              onBlur={() => {
                if (formData.credits !== originalData?.credits) {
                  handleFieldUpdate('credits', formData.credits)
                }
              }}
              placeholder="0"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modelos Incluídos</label>
            <NumericInput
              value={formData.models}
              onChange={(value) => {
                setFormData({ ...formData, models: value })
              }}
              onBlur={() => {
                if (formData.models !== originalData?.models) {
                  handleFieldUpdate('models', formData.models)
                }
              }}
              placeholder="0"
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Resolução</label>
            <input
              type="text"
              value={formData.resolution}
              onChange={(e) => {
                setFormData({ ...formData, resolution: e.target.value })
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  handleFieldUpdate('resolution', e.target.value.trim())
                }
              }}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <select
              value={formData.color}
              onChange={(e) => {
                const newColor = e.target.value as any
                setFormData({ ...formData, color: newColor })
                handleFieldUpdate('color', newColor)
              }}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="blue">Azul</option>
              <option value="purple">Roxo</option>
              <option value="yellow">Amarelo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ordem de Exibição</label>
            <NumericInput
              value={formData.displayOrder}
              onChange={(value) => {
                setFormData({ ...formData, displayOrder: value })
              }}
              onBlur={() => {
                if (formData.displayOrder !== originalData?.displayOrder) {
                  handleFieldUpdate('displayOrder', formData.displayOrder)
                }
              }}
              min={0}
              className="w-32"
            />
            <p className="mt-1 text-xs text-gray-600">Menor número aparece primeiro</p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => {
                  const newValue = e.target.checked
                  setFormData({ ...formData, isActive: newValue })
                  handleFieldUpdate('isActive', newValue)
                }}
                className="rounded"
              />
              <span className="text-sm font-medium">Ativo</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.popular}
                onChange={(e) => {
                  const newValue = e.target.checked
                  setFormData({ ...formData, popular: newValue })
                  handleFieldUpdate('popular', newValue)
                }}
                className="rounded"
              />
              <span className="text-sm font-medium">Popular</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Features</label>
          {features.map((feature, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={feature}
                onChange={(e) => handleFeatureChange(index, e.target.value)}
                onBlur={() => {
                  const validFeatures = features.filter(f => f.trim().length > 0)
                  if (validFeatures.length > 0) {
                    handleFieldUpdate('features', validFeatures)
                  }
                }}
                className="flex-1 border rounded-md px-3 py-2"
              />
              {features.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addFeature}
            className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            + Adicionar Feature
          </button>
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={saving || (!hasChanges() && originalData !== null)}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : hasChanges() ? 'Salvar Alterações' : 'Nenhuma Alteração'}
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
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}

