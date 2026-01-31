'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PlanFormatSelectorProps {
  initialFormat: 'TRADITIONAL' | 'MEMBERSHIP'
}

export default function PlanFormatSelector({ initialFormat }: PlanFormatSelectorProps) {
  const router = useRouter()
  const [format, setFormat] = useState<'TRADITIONAL' | 'MEMBERSHIP'>(initialFormat)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleFormatChange = async (newFormat: 'TRADITIONAL' | 'MEMBERSHIP') => {
    if (newFormat === format) return

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/plan-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: newFormat })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao alterar formato')
      }

      setFormat(newFormat)
      setMessage({
        type: 'success',
        text: `Formato alterado para ${newFormat === 'TRADITIONAL' ? 'Traditional' : 'Membership'} com sucesso!`
      })

      // Reload page to show new plans
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Erro ao alterar formato'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Formato Ativo de Planos</h3>
          <p className="text-sm text-gray-600">
            {format === 'TRADITIONAL'
              ? 'Formato A: 3 planos (Starter, Premium, Gold) × 2 ciclos (Mensal, Anual)'
              : 'Formato B: 3 planos Membership (Trimestral, Semestral, Anual) com créditos fixos por ciclo'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleFormatChange('TRADITIONAL')}
            disabled={loading || format === 'TRADITIONAL'}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'TRADITIONAL'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Format A (Traditional)
          </button>
          <button
            onClick={() => handleFormatChange('MEMBERSHIP')}
            disabled={loading || format === 'MEMBERSHIP'}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'MEMBERSHIP'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Format B (Membership)
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-3 text-sm text-gray-600">
          ⏳ Alterando formato...
        </div>
      )}

      {message && (
        <div className={`mt-3 text-sm ${
          message.type === 'success' ? 'text-green-700' : 'text-red-700'
        }`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        ⚠️ Atenção: Assinaturas existentes não são afetadas ao trocar o formato. Apenas novos clientes verão o novo formato.
      </div>
    </div>
  )
}
