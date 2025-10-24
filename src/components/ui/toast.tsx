'use client'

import { useEffect } from 'react'
import { useToast, type Toast } from '@/hooks/use-toast'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id)
      }, toast.duration)

      return () => clearTimeout(timer)
    }
  }, [toast.duration, toast.id, onRemove])

  // Removed icons as per requirement

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          background: 'bg-gradient-to-r from-emerald-600/90 to-green-600/90',
          border: 'border-emerald-400/20',
          text: 'text-white',
          icon: 'text-emerald-200'
        }
      case 'error':
        return {
          background: 'bg-gradient-to-r from-red-600/90 to-red-700/90',
          border: 'border-red-400/20',
          text: 'text-white',
          icon: 'text-red-200'
        }
      case 'warning':
        return {
          background: 'bg-gradient-to-r from-yellow-600/90 to-orange-600/90',
          border: 'border-yellow-400/20',
          text: 'text-white',
          icon: 'text-yellow-200'
        }
      case 'info':
        return {
          background: 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90',
          border: 'border-blue-400/20',
          text: 'text-white',
          icon: 'text-blue-200'
        }
      default:
        return {
          background: 'bg-gradient-to-r from-gray-700/90 to-gray-800/90',
          border: 'border-gray-400/20',
          text: 'text-white',
          icon: 'text-gray-200'
        }
    }
  }

  const styles = getToastStyles()

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl transition-all duration-500 ease-out backdrop-blur-sm',
        'animate-in slide-in-from-right-full fade-in-0 duration-300',
        styles.background,
        styles.border,
        'font-[system-ui,-apple-system,"SF Pro Display",sans-serif]'
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {toast.title && (
              <p className={cn("text-sm font-semibold mb-1", styles.text, "font-[system-ui,-apple-system,'SF Pro Display',sans-serif]")}>
                {toast.title}
              </p>
            )}
            {toast.description && (
              <p className={cn("text-xs opacity-90 leading-relaxed", styles.text, "font-[system-ui,-apple-system,'SF Pro Display',sans-serif]")}>
                {toast.description}
              </p>
            )}
            {toast.action && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    toast.action?.onClick()
                    onRemove(toast.id)
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-all duration-200 backdrop-blur-sm"
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200"
              onClick={() => onRemove(toast.id)}
            >
              <span className="sr-only">Fechar</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Toaster() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[9999] p-6">
      <div className="flex flex-col items-end space-y-3">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </div>
  )
}