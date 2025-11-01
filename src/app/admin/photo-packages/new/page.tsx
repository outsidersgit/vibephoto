'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Prompt {
  text: string
  style?: string
  description?: string
}

export default function NewPhotoPackagePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'PROFESSIONAL' as const,
    price: '',
    isActive: true,
    isPremium: false,
    prompts: [] as Prompt[]
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const price = formData.price ? parseFloat(formData.price) : null
      
      // Filtrar prompts vazios antes de enviar
      const validPrompts = formData.prompts.filter(p => p.text.trim().length > 0)
      
      const response = await fetch('/api/admin/photo-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          price: price,
          isActive: formData.isActive,
          isPremium: formData.isPremium,
          prompts: validPrompts,
          previewUrls: []
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao criar pacote')
      }

      router.push('/admin/photo-packages')
    } catch (err: any) {
      setError(err.message || 'Erro ao criar pacote')
      setIsLoading(false)
    }
  }

  const addPrompt = () => {
    setFormData({
      ...formData,
      prompts: [...formData.prompts, { text: '', style: 'photographic' }]
    })
  }

  const removePrompt = (index: number) => {
    setFormData({
      ...formData,
      prompts: formData.prompts.filter((_, i) => i !== index)
    })
  }

  const updatePrompt = (index: number, field: keyof Prompt, value: string) => {
    const updated = [...formData.prompts]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, prompts: updated })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Novo Pacote de Fotos</h2>
        <Link href="/admin/photo-packages" className="text-sm text-gray-600 hover:underline">
          ← Voltar
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-md p-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome *
          </label>
          <input
            id="name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            id="description"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Categoria *
          </label>
          <select
            id="category"
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="PROFESSIONAL">Profissional</option>
            <option value="SOCIAL">Social</option>
            <option value="THEMATIC">Temático</option>
            <option value="ARTISTIC">Artístico</option>
            <option value="FANTASY">Fantasia</option>
          </select>
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
            Preço (em créditos)
          </label>
          <input
            id="price"
            type="number"
            min="0"
            step="1"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="Ex: 400"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">Deixe vazio se o pacote for gratuito</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Ativo</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isPremium}
              onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Premium</span>
          </label>
        </div>

        {/* Prompts Section */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Prompts de Geração
            </label>
            <button
              type="button"
              onClick={addPrompt}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
            >
              + Adicionar Prompt
            </button>
          </div>
          
          {formData.prompts.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhum prompt cadastrado</p>
          ) : (
            <div className="space-y-3">
              {formData.prompts.map((prompt, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Prompt {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePrompt(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <textarea
                      value={prompt.text}
                      onChange={(e) => updatePrompt(index, 'text', e.target.value)}
                      placeholder="Descreva a imagem que será gerada..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    
                    <select
                      value={prompt.style || 'photographic'}
                      onChange={(e) => updatePrompt(index, 'style', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="photographic">Photographic</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="artistic">Artistic</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {isLoading ? 'Criando...' : 'Criar Pacote'}
          </button>
          <Link
            href="/admin/photo-packages"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}

