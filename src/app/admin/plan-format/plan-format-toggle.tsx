'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Check } from 'lucide-react'

type PlanFormatType = 'TRADITIONAL' | 'MEMBERSHIP'

export function PlanFormatToggle() {
  const [currentFormat, setCurrentFormat] = useState<PlanFormatType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Buscar formato atual
  useEffect(() => {
    async function fetchCurrentFormat() {
      try {
        const response = await fetch('/api/admin/plan-format')
        if (response.ok) {
          const data = await response.json()
          setCurrentFormat(data.format)
        } else {
          setError('Erro ao carregar formato atual')
        }
      } catch (err) {
        setError('Erro ao conectar com o servidor')
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentFormat()
  }, [])

  const handleFormatChange = async (newFormat: PlanFormatType) => {
    if (newFormat === currentFormat) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/admin/plan-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: newFormat })
      })

      if (response.ok) {
        setCurrentFormat(newFormat)
        setSuccess(true)

        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao alterar formato')
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formato Ativo</CardTitle>
        <CardDescription>
          Selecione qual formato de planos será exibido na página /pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formato A - Traditional */}
        <button
          onClick={() => handleFormatChange('TRADITIONAL')}
          disabled={saving}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            currentFormat === 'TRADITIONAL'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  currentFormat === 'TRADITIONAL'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {currentFormat === 'TRADITIONAL' && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Formato A - Tradicional
                </h3>
              </div>
              <p className="text-sm text-gray-600 ml-7">
                3 planos (Starter/Premium/Gold) × 2 ciclos (Mensal/Anual)
              </p>
            </div>
            {currentFormat === 'TRADITIONAL' && (
              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                Ativo
              </span>
            )}
          </div>
        </button>

        {/* Formato B - Membership */}
        <button
          onClick={() => handleFormatChange('MEMBERSHIP')}
          disabled={saving}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            currentFormat === 'MEMBERSHIP'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  currentFormat === 'MEMBERSHIP'
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300'
                }`}>
                  {currentFormat === 'MEMBERSHIP' && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Formato B - Membership
                </h3>
              </div>
              <p className="text-sm text-gray-600 ml-7">
                1 plano (Membership) × 3 ciclos (Trimestral/Semestral/Anual)
              </p>
            </div>
            {currentFormat === 'MEMBERSHIP' && (
              <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded">
                Ativo
              </span>
            )}
          </div>
        </button>

        {/* Mensagens de status */}
        {saving && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Alterando formato...</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded border border-green-200">
            <Check className="h-4 w-4" />
            <span>Formato alterado com sucesso! A página /pricing já reflete a mudança.</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
