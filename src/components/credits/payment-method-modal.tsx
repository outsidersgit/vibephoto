import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'

export type PaymentMethod = 'PIX' | 'CREDIT_CARD'

interface PaymentMethodModalProps {
  isOpen: boolean
  packageName: string
  packagePrice: number | string
  onSelect: (method: PaymentMethod) => void
  onClose: () => void
  loading?: boolean
  loadingMethod?: PaymentMethod | null
  description?: string | null
  errorMessage?: string | null
}

export function PaymentMethodModal({
  isOpen,
  packageName,
  packagePrice,
  onSelect,
  onClose,
  loading = false,
  loadingMethod = null,
  description,
  errorMessage
}: PaymentMethodModalProps) {
  const [mounted, setMounted] = useState(false)
  const pixButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const body = document.body

    if (isOpen) {
      body.classList.add('overflow-hidden')
      // Focus first focusable element when opened
      requestAnimationFrame(() => {
        pixButtonRef.current?.focus()
      })
    } else {
      body.classList.remove('overflow-hidden')
    }

    return () => {
      body.classList.remove('overflow-hidden')
    }
  }, [isOpen, mounted])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || !isOpen) {
    return null
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-method-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl mx-4 focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="payment-method-title"
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Escolha o Método de Pagamento
        </h3>

        <p
          className="text-gray-600 mb-6"
          style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          {packageName} – R$ {packagePrice}
        </p>

        {description && (
          <p className="text-sm text-gray-500 mb-4">
            {description}
          </p>
        )}

        <div className="space-y-4 mb-6">
          <button
            ref={pixButtonRef}
            onClick={() => !loading && onSelect('PIX')}
            disabled={loading}
            className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            <div className="font-bold text-gray-900 text-lg">
              PIX
            </div>
            {loading && loadingMethod === 'PIX' && (
              <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
            )}
          </button>

          <button
            onClick={() => !loading && onSelect('CREDIT_CARD')}
            disabled={loading}
            className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            <div className="font-bold text-gray-900 text-lg">
              Cartão de Crédito
            </div>
            {loading && loadingMethod === 'CREDIT_CARD' && (
              <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
          style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
