'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { X, Upload, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react'
import { GenderTabs } from '@/components/admin/gender-tabs'

interface Prompt {
  text: string
  style?: string
  description?: string
  seed?: number
}

type GenderType = 'MALE' | 'FEMALE'

export default function EditPhotoPackagePage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const id = params.id as string
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingPreviews, setUploadingPreviews] = useState(false)
  const [error, setError] = useState('')

  // Estados separados por gênero para NOVAS imagens
  const [newPreviewImagesMale, setNewPreviewImagesMale] = useState<File[]>([])
  const [newPreviewImagesFemale, setNewPreviewImagesFemale] = useState<File[]>([])

  // URLs existentes no banco
  const [existingPreviewUrlsMale, setExistingPreviewUrlsMale] = useState<string[]>([])
  const [existingPreviewUrlsFemale, setExistingPreviewUrlsFemale] = useState<string[]>([])

  // Previews para exibição (existentes + novas)
  const [previewPreviewsMale, setPreviewPreviewsMale] = useState<{ url: string; index: number; isExisting: boolean }[]>([])
  const [previewPreviewsFemale, setPreviewPreviewsFemale] = useState<{ url: string; index: number; isExisting: boolean }[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'PROFESSIONAL' as const,
    price: '',
    isActive: true,
    isPremium: false,
    promptsMale: [] as Prompt[],
    promptsFemale: [] as Prompt[]
  })

  useEffect(() => {
    async function loadPackage() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/admin/photo-packages`)
        if (!response.ok) throw new Error('Erro ao carregar pacotes')

        const data = await response.json()
        const pkg = data.packages?.find((p: any) => p.id === id)

        if (!pkg) {
          setError('Pacote não encontrado')
          return
        }

        // Carregar dados básicos
        setFormData({
          name: pkg.name || '',
          description: pkg.description || '',
          category: pkg.category || 'PROFESSIONAL',
          price: pkg.price?.toString() || '',
          isActive: pkg.isActive !== undefined ? pkg.isActive : true,
          isPremium: pkg.isPremium !== undefined ? pkg.isPremium : false,
          promptsMale: (pkg.promptsMale && Array.isArray(pkg.promptsMale) && pkg.promptsMale.length > 0)
            ? pkg.promptsMale
            : (pkg.prompts || []),
          promptsFemale: (pkg.promptsFemale && Array.isArray(pkg.promptsFemale) && pkg.promptsFemale.length > 0)
            ? pkg.promptsFemale
            : (pkg.prompts || [])
        })

        // Carregar preview URLs existentes (com fallback)
        const existingMale = (pkg.previewUrlsMale && Array.isArray(pkg.previewUrlsMale) && pkg.previewUrlsMale.length > 0)
          ? pkg.previewUrlsMale
          : (pkg.previewUrls || [])

        const existingFemale = (pkg.previewUrlsFemale && Array.isArray(pkg.previewUrlsFemale) && pkg.previewUrlsFemale.length > 0)
          ? pkg.previewUrlsFemale
          : (pkg.previewUrls || [])

        setExistingPreviewUrlsMale(existingMale)
        setExistingPreviewUrlsFemale(existingFemale)

        // Criar previews para exibição
        setPreviewPreviewsMale(existingMale.map((url, idx) => ({ url, index: idx, isExisting: true })))
        setPreviewPreviewsFemale(existingFemale.map((url, idx) => ({ url, index: idx, isExisting: true })))

        console.log('📦 Pacote carregado:', {
          id: pkg.id,
          name: pkg.name,
          promptsMaleCount: pkg.promptsMale?.length || 0,
          promptsFemaleCount: pkg.promptsFemale?.length || 0,
          previewsMaleCount: existingMale.length,
          previewsFemaleCount: existingFemale.length
        })
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar pacote')
      } finally {
        setIsLoading(false)
      }
    }

    loadPackage()
  }, [id])

  const handlePreviewImageChange = (e: React.ChangeEvent<HTMLInputElement>, gender: GenderType) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(f => f.type.startsWith('image/'))

    if (gender === 'MALE') {
      const currentImages = [...newPreviewImagesMale, ...validFiles]
      setNewPreviewImagesMale(currentImages)

      // Criar previews das novas imagens
      validFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const url = e.target?.result as string
          setPreviewPreviewsMale(prev => [...prev, {
            url,
            index: prev.length,
            isExisting: false
          }])
        }
        reader.readAsDataURL(file)
      })
    } else {
      const currentImages = [...newPreviewImagesFemale, ...validFiles]
      setNewPreviewImagesFemale(currentImages)

      validFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const url = e.target?.result as string
          setPreviewPreviewsFemale(prev => [...prev, {
            url,
            index: prev.length,
            isExisting: false
          }])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removePreviewImage = (index: number, gender: GenderType) => {
    if (gender === 'MALE') {
      const preview = previewPreviewsMale[index]
      if (preview.isExisting) {
        // Remover da lista de existentes
        setExistingPreviewUrlsMale(prev => prev.filter((_, i) => i !== index))
      } else {
        // Remover da lista de novas
        const existingCount = existingPreviewUrlsMale.length
        const newIndex = index - existingCount
        setNewPreviewImagesMale(prev => prev.filter((_, i) => i !== newIndex))
      }
      setPreviewPreviewsMale(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, index: i })))
    } else {
      const preview = previewPreviewsFemale[index]
      if (preview.isExisting) {
        setExistingPreviewUrlsFemale(prev => prev.filter((_, i) => i !== index))
      } else {
        const existingCount = existingPreviewUrlsFemale.length
        const newIndex = index - existingCount
        setNewPreviewImagesFemale(prev => prev.filter((_, i) => i !== newIndex))
      }
      setPreviewPreviewsFemale(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, index: i })))
    }
  }

  const uploadPreviewImages = async (images: File[], gender: GenderType): Promise<string[]> => {
    if (images.length === 0) return []

    try {
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id || 'admin',
          files: images.map((file) => ({
            name: file.name,
            type: file.type,
            category: 'preview'
          })),
          prefix: `package-previews/${gender.toLowerCase()}`
        })
      })

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao pré-assinar uploads')
      }

      const presignData = await presignRes.json()
      const uploads = presignData.uploads as Array<{ uploadUrl: string; publicUrl: string }>

      await Promise.all(uploads.map((u, idx) => {
        const file = images[idx]
        return fetch(u.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        }).then(res => {
          if (!res.ok) throw new Error(`Falha ao subir arquivo: ${file.name}`)
        })
      }))

      return uploads.map(u => u.publicUrl)
    } catch (error) {
      console.error('Erro ao fazer upload de preview images:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')

    try {
      setUploadingPreviews(true)

      // Upload de novas imagens
      const [newMaleUrls, newFemaleUrls] = await Promise.all([
        uploadPreviewImages(newPreviewImagesMale, 'MALE'),
        uploadPreviewImages(newPreviewImagesFemale, 'FEMALE')
      ])

      setUploadingPreviews(false)

      // Combinar URLs existentes + novas
      const finalMaleUrls = [...existingPreviewUrlsMale, ...newMaleUrls]
      const finalFemaleUrls = [...existingPreviewUrlsFemale, ...newFemaleUrls]

      const price = formData.price ? parseFloat(formData.price) : null

      // Filtrar prompts vazios
      const validPromptsMale = formData.promptsMale.filter(p => p.text.trim().length > 0)
      const validPromptsFemale = formData.promptsFemale.filter(p => p.text.trim().length > 0)

      if (validPromptsMale.length === 0 || validPromptsFemale.length === 0) {
        throw new Error('Você precisa ter pelo menos 1 prompt para cada gênero')
      }

      const response = await fetch('/api/admin/photo-packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          price: price,
          isActive: formData.isActive,
          isPremium: formData.isPremium,
          gender: 'BOTH',
          promptsMale: validPromptsMale,
          promptsFemale: validPromptsFemale,
          previewUrlsMale: finalMaleUrls,
          previewUrlsFemale: finalFemaleUrls,
          // Legacy fields
          prompts: validPromptsMale,
          previewUrls: finalMaleUrls
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao atualizar pacote')
      }

      router.push('/admin/photo-packages')
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar pacote')
      setIsSaving(false)
      setUploadingPreviews(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este pacote? Esta ação irá desativá-lo.')) {
      return
    }

    try {
      setDeleting(true)
      setError('')

      console.log('🗑️ [DELETE_PHOTO_PKG] Iniciando deleção do pacote:', id)

      const response = await fetch('/api/admin/photo-packages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      console.log('🗑️ [DELETE_PHOTO_PKG] Response status:', response.status)

      const data = await response.json()
      console.log('🗑️ [DELETE_PHOTO_PKG] Response data:', data)

      if (response.ok) {
        console.log('✅ [DELETE_PHOTO_PKG] Pacote deletado com sucesso, redirecionando...')
        router.push('/admin/photo-packages')
      } else {
        const errorMsg = data.error || 'Erro ao deletar pacote'
        console.error('❌ [DELETE_PHOTO_PKG] Erro na resposta:', errorMsg)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('❌ [DELETE_PHOTO_PKG] Erro ao deletar pacote:', err)
      setError('Erro ao deletar pacote')
    } finally {
      setDeleting(false)
    }
  }

  const addPrompt = (gender: GenderType) => {
    if (gender === 'MALE') {
      setFormData({
        ...formData,
        promptsMale: [...formData.promptsMale, { text: '', style: 'photographic', seed: Math.floor(Math.random() * 1000000) }]
      })
    } else {
      setFormData({
        ...formData,
        promptsFemale: [...formData.promptsFemale, { text: '', style: 'photographic', seed: Math.floor(Math.random() * 1000000) }]
      })
    }
  }

  const removePrompt = (index: number, gender: GenderType) => {
    if (gender === 'MALE') {
      setFormData({
        ...formData,
        promptsMale: formData.promptsMale.filter((_, i) => i !== index)
      })
    } else {
      setFormData({
        ...formData,
        promptsFemale: formData.promptsFemale.filter((_, i) => i !== index)
      })
    }
  }

  const updatePrompt = (index: number, field: keyof Prompt, value: string | number | undefined, gender: GenderType) => {
    if (gender === 'MALE') {
      const updated = [...formData.promptsMale]
      updated[index] = { ...updated[index], [field]: value }
      setFormData({ ...formData, promptsMale: updated })
    } else {
      const updated = [...formData.promptsFemale]
      updated[index] = { ...updated[index], [field]: value }
      setFormData({ ...formData, promptsFemale: updated })
    }
  }

  const clearPrompt = (index: number, gender: GenderType) => {
    if (gender === 'MALE') {
      const updated = [...formData.promptsMale]
      updated[index] = { text: '', style: 'photographic', seed: undefined }
      setFormData({ ...formData, promptsMale: updated })
    } else {
      const updated = [...formData.promptsFemale]
      updated[index] = { text: '', style: 'photographic', seed: undefined }
      setFormData({ ...formData, promptsFemale: updated })
    }
  }

  const renderGenderContent = (gender: GenderType) => {
    const previewPreviews = gender === 'MALE' ? previewPreviewsMale : previewPreviewsFemale
    const prompts = gender === 'MALE' ? formData.promptsMale : formData.promptsFemale

    return (
      <div className="space-y-6">
        {/* Preview Images Section */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Imagens de Preview - {gender === 'MALE' ? 'Masculino' : 'Feminino'}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {previewPreviews.filter(p => p.isExisting).length} imagens existentes, adicione mais se desejar
          </p>

          {/* Preview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {previewPreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {preview.isExisting && (
                  <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                    Existente
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePreviewImage(index, gender)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Add Image Slot */}
            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors">
              <Upload className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-xs text-gray-500 text-center px-2">Adicionar</span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={(e) => handlePreviewImageChange(e, gender)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Prompts Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Prompts de Geração - {gender === 'MALE' ? 'Masculino' : 'Feminino'}
            </label>
            <button
              type="button"
              onClick={() => addPrompt(gender)}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
            >
              + Adicionar Prompt
            </button>
          </div>

          {prompts.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhum prompt cadastrado</p>
          ) : (
            <div className="space-y-3">
              {prompts.map((prompt, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Prompt {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => clearPrompt(index, gender)}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => removePrompt(index, gender)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={prompt.text}
                      onChange={(e) => updatePrompt(index, 'text', e.target.value, gender)}
                      placeholder="Descreva a imagem que será gerada..."
                      rows={3}
                      maxLength={4000}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />

                    <select
                      value={prompt.style || 'photographic'}
                      onChange={(e) => updatePrompt(index, 'style', e.target.value, gender)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="photographic">Photographic</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="artistic">Artistic</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Seed (Reprodutibilidade)
                      </label>
                      <input
                        type="number"
                        value={prompt.seed ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          updatePrompt(index, 'seed', val === '' ? undefined : parseInt(val) || 0, gender)
                        }}
                        placeholder="0"
                        min={0}
                        max={4294967295}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Editar Pacote de Fotos</h2>
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
        {/* Informações Básicas */}
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
            <option value="LIFESTYLE">Lifestyle</option>
            <option value="CREATIVE">Criativo</option>
            <option value="FASHION">Fashion</option>
            <option value="PREMIUM">Premium</option>
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

        {/* Tabs de Gênero */}
        <div className="border-t pt-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Prompts e Previews por Gênero
          </h3>

          <GenderTabs
            maleContent={renderGenderContent('MALE')}
            femaleContent={renderGenderContent('FEMALE')}
          />
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <button
            type="submit"
            disabled={isSaving || uploadingPreviews}
            className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploadingPreviews ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fazendo upload...
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || isSaving || uploadingPreviews}
            className="rounded-md bg-red-500/10 border border-red-500/50 text-red-600 px-4 py-2 text-sm hover:bg-red-500/20 hover:border-red-500 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deletando...
              </>
            ) : (
              'Deletar'
            )}
          </button>
          <Link
            href="/admin/photo-packages"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 inline-flex items-center"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
