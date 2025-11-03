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
  const [error, setError] = useState<string | null>(null)
  const [features, setFeatures] = useState<string[]>([''])
  
  const [formData, setFormData] = useState({
    planId: 'STARTER' as 'STARTER' | 'PREMIUM' | 'GOLD',
    name: '',
    description: '',
    isActive: true,
    popular: false,
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
        const response = await fetch(`/api/admin/subscription-plans/${id}`)
        if (!response.ok) {
          throw new Error('Plano não encontrado')
        }
        
        const data = await response.json()
        const plan = data.plan
        
        setFormData({
          planId: plan.planId,
          name: plan.name,
          description: plan.description,
          isActive: plan.isActive,
          popular: plan.popular,
          color: plan.color || 'blue',
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          monthlyEquivalent: plan.monthlyEquivalent,
          credits: plan.credits,
          models: plan.models,
          resolution: plan.resolution
        })
        
        const planFeatures = Array.isArray(plan.features) 
          ? plan.features.map((f: any) => typeof f === 'string' ? f : String(f))
          : []
        
        setFeatures(planFeatures.length > 0 ? planFeatures : [''])
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
      const updateData: any = {}
      
      // Se for features, filtrar vazias
      if (field === 'features') {
        const validFeatures = Array.isArray(value) ? value.filter((f: string) => f.trim().length > 0) : []
        if (validFeatures.length === 0) {
          setError('Adicione pelo menos uma feature')
          return
        }
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

      setError(null)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar campo')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const validFeatures = features.filter(f => f.trim().length > 0)
    if (validFeatures.length === 0) {
      setError('Adicione pelo menos uma feature')
      setSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/admin/subscription-plans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          features: validFeatures
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar plano')
      }

      router.push('/admin/subscription-plans')
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar plano')
      setSaving(false)
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ID do Plano *</label>
            <select
              required
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
                handleFieldUpdate('monthlyPrice', value)
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
                handleFieldUpdate('annualPrice', value)
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
                handleFieldUpdate('monthlyEquivalent', value)
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
                handleFieldUpdate('credits', value)
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
                handleFieldUpdate('models', value)
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
          <label className="block text-sm font-medium mb-2">Features *</label>
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
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
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

