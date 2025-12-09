'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewSubscriptionPlanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [features, setFeatures] = useState<string[]>([''])

  const [formData, setFormData] = useState({
    planId: '',
    name: '',
    description: '',
    planType: 'PAID' as 'FREE' | 'PAID',
    isActive: true,
    popular: false,
    monthlyPrice: '' as string,
    annualPrice: '' as string,
    monthlyEquivalent: '' as string,
    credits: '' as string,
    models: '1' as string,
    resolution: '1024x1024',
    maxPhotos: '' as string,
    maxVideos: '' as string,
    maxModels: '' as string,
    maxStorage: '' as string
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validations
    if (!formData.planId.trim()) {
      setError('ID do plano é obrigatório')
      setLoading(false)
      return
    }

    if (!/^[A-Z_]+$/.test(formData.planId)) {
      setError('ID do plano deve conter apenas letras maiúsculas e underscores (ex: FREE_TRIAL, STARTER)')
      setLoading(false)
      return
    }

    const validFeatures = features.filter(f => f.trim().length > 0)
    if (validFeatures.length === 0) {
      setError('Adicione pelo menos uma feature')
      setLoading(false)
      return
    }

    try {
      const payload: any = {
        planId: formData.planId.toUpperCase().trim(),
        name: formData.name,
        description: formData.description,
        planType: formData.planType,
        isActive: formData.isActive,
        popular: formData.popular,
        monthlyPrice: parseFloat(formData.monthlyPrice) || 0,
        annualPrice: parseFloat(formData.annualPrice) || 0,
        monthlyEquivalent: parseFloat(formData.monthlyEquivalent) || 0,
        credits: parseInt(formData.credits) || 0,
        models: parseInt(formData.models) || 1,
        resolution: formData.resolution,
        features: validFeatures
      }

      // Convert optional limit fields
      if (formData.maxPhotos) payload.maxPhotos = parseInt(formData.maxPhotos)
      if (formData.maxVideos) payload.maxVideos = parseInt(formData.maxVideos)
      if (formData.maxModels) payload.maxModels = parseInt(formData.maxModels)
      if (formData.maxStorage) payload.maxStorage = parseInt(formData.maxStorage)

      const response = await fetch('/api/admin/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar plano')
      }

      router.push('/admin/subscription-plans')
    } catch (err: any) {
      setError(err.message || 'Erro ao criar plano')
      setLoading(false)
    }
  }

  const isFree = formData.planType === 'FREE'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Novo Plano de Assinatura</h1>
        <p className="mt-2 text-zinc-300">Crie um novo plano FREE ou PAID com configurações personalizadas</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="bg-zinc-800/80 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Informações Básicas</CardTitle>
            <CardDescription className="text-zinc-400">Configurações gerais do plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  ID do Plano *
                  <span className="text-zinc-400 font-normal ml-2">(ex: FREE_TRIAL, STARTER, PRO)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value.toUpperCase() })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                  placeholder="FREE_TRIAL"
                />
                <p className="mt-1 text-xs text-zinc-400">Identificador único (apenas letras maiúsculas e underscores)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Free Trial"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Descrição *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Ex: Perfeito para começar sua jornada com IA"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Tipo de Plano *</label>
                <select
                  required
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value as any })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="PAID">💳 PAID - Renovação mensal/anual de créditos</option>
                  <option value="FREE">🎁 FREE - Créditos únicos, sem renovação</option>
                </select>
                {isFree && (
                  <p className="mt-1 text-xs text-yellow-400">
                    ⚠️ Plano FREE: créditos entregues apenas uma vez. Usuário pode comprar pacotes avulsos depois.
                  </p>
                )}
              </div>

              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded bg-zinc-700 border-zinc-600"
                  />
                  <span className="text-sm font-medium text-white">Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                    className="rounded bg-zinc-700 border-zinc-600"
                  />
                  <span className="text-sm font-medium text-white">Popular</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="bg-zinc-800/80 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Precificação</CardTitle>
            <CardDescription className="text-zinc-400">
              Defina os valores do plano {isFree && '(pode ser R$ 0 para planos gratuitos)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Preço Mensal (R$) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Preço Anual (R$) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.annualPrice}
                  onChange={(e) => setFormData({ ...formData, annualPrice: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Equivalente Mensal (R$) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.monthlyEquivalent}
                  onChange={(e) => setFormData({ ...formData, monthlyEquivalent: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-zinc-400">Valor mensal do plano anual (anual ÷ 12)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits & Features */}
        <Card className="bg-zinc-800/80 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Créditos e Recursos</CardTitle>
            <CardDescription className="text-zinc-400">
              Configure os recursos incluídos {isFree && '(créditos serão entregues uma única vez)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Créditos {isFree ? 'Únicos' : 'Mensais'} *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="100"
                />
                {isFree && (
                  <p className="mt-1 text-xs text-yellow-400">
                    Créditos entregues apenas uma vez (sem renovação)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Modelos de IA *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.models}
                  onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Resolução *</label>
                <input
                  type="text"
                  required
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1024x1024"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Limits */}
        <Card className="bg-zinc-800/80 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Limites de Features</CardTitle>
            <CardDescription className="text-zinc-400">
              Opcional - Limites são baseados nos créditos do usuário. Deixe em branco para ilimitado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-md text-blue-200 text-sm">
              <strong>💡 Dica:</strong> Os limites são controlados pelos créditos. Usuários de planos FREE podem continuar usando o app comprando pacotes de créditos avulsos.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Máx. Fotos/Mês</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxPhotos}
                  onChange={(e) => setFormData({ ...formData, maxPhotos: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ilimitado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Máx. Vídeos/Mês</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxVideos}
                  onChange={(e) => setFormData({ ...formData, maxVideos: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ilimitado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Máx. Modelos IA</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxModels}
                  onChange={(e) => setFormData({ ...formData, maxModels: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ilimitado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Máx. Storage (GB)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxStorage}
                  onChange={(e) => setFormData({ ...formData, maxStorage: e.target.value })}
                  className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ilimitado"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features List */}
        <Card className="bg-zinc-800/80 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Features do Plano *</CardTitle>
            <CardDescription className="text-zinc-400">Lista de funcionalidades exibidas no card do plano (mantém identidade visual padrão)</CardDescription>
          </CardHeader>
          <CardContent>
            {features.map((feature, index) => (
              <div key={index} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => handleFeatureChange(index, e.target.value)}
                  className="flex-1 bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={`Feature ${index + 1} (ex: 100 créditos únicos)`}
                />
                {features.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="px-4 py-2 bg-red-900/30 border border-red-500/50 text-red-300 rounded-md hover:bg-red-900/50 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFeature}
              className="mt-2 px-4 py-2 bg-zinc-700 border border-zinc-600 text-zinc-300 rounded-md hover:bg-zinc-600 transition-colors text-sm"
            >
              + Adicionar Feature
            </button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
          >
            {loading ? 'Criando plano...' : 'Criar Plano'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
