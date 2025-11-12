'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type DeleteModelVariant = 'primary' | 'menu'

interface DeleteModelActionProps {
  modelId: string
  variant?: DeleteModelVariant
  className?: string
  confirmMessage?: string
  loadingLabel?: string
  label?: string
  redirectTo?: string
  stopPropagation?: boolean
  onLoadingChange?: (loading: boolean) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
  onSettled?: () => void
}

export function DeleteModelAction({
  modelId,
  variant = 'primary',
  className,
  confirmMessage = 'Tem certeza que deseja excluir este modelo? Esta ação não pode ser desfeita.',
  loadingLabel = 'Excluindo...',
  label = 'Excluir modelo',
  redirectTo,
  stopPropagation = true,
  onLoadingChange,
  onSuccess,
  onError,
  onSettled
}: DeleteModelActionProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) {
        event.stopPropagation()
        event.preventDefault()
      }

      if (loading) return

      const confirmed = confirm(confirmMessage)
      if (!confirmed) {
        return
      }

      setLoading(true)
      onLoadingChange?.(true)

      try {
        const response = await fetch(`/api/models/${modelId}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('Falha ao excluir o modelo.')
        }

        onSuccess?.()

        if (redirectTo) {
          router.push(redirectTo)
        } else {
          router.refresh()
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error('Erro ao excluir modelo:', err)
        alert('Não foi possível excluir o modelo. Tente novamente.')
        onError?.(err)
      } finally {
        setLoading(false)
        onLoadingChange?.(false)
        onSettled?.()
      }
    },
    [
      stopPropagation,
      loading,
      confirmMessage,
      modelId,
      onLoadingChange,
      onSuccess,
      redirectTo,
      router,
      onError,
      onSettled
    ]
  )

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className={cn(
          'flex items-center px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 w-full text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
          className
        )}
      >
        <Trash2 className="w-3.5 h-3.5 mr-2" />
        {loading ? loadingLabel : label}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={handleDelete}
      disabled={loading}
      className={cn(
        'w-full bg-red-600 hover:bg-red-500 text-white border-2 border-red-500 hover:border-red-400 py-3 font-medium transition-all duration-200 shadow-sm justify-start disabled:opacity-70 disabled:cursor-not-allowed',
        className
      )}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      {loading ? loadingLabel : label}
    </Button>
  )
}

