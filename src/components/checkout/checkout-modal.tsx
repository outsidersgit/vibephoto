'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl: string
  onSuccess?: () => void
}

export function CheckoutModal({
  isOpen,
  onClose,
  checkoutUrl,
  onSuccess
}: CheckoutModalProps) {
  const [checkoutWindow, setCheckoutWindow] = useState<Window | null>(null)
  const [status, setStatus] = useState<'waiting' | 'opened' | 'completed'>('waiting')

  // Open checkout in new window
  useEffect(() => {
    if (isOpen && checkoutUrl && !checkoutWindow) {
      // Open in new window
      const newWindow = window.open(
        checkoutUrl,
        'AsaasCheckout',
        'width=800,height=900,scrollbars=yes,resizable=yes'
      )

      if (newWindow) {
        setCheckoutWindow(newWindow)
        setStatus('opened')

        // Monitor if window is closed
        const checkWindowClosed = setInterval(() => {
          if (newWindow.closed) {
            clearInterval(checkWindowClosed)
            setCheckoutWindow(null)
            // User closed the window - assume cancelled
            if (status !== 'completed') {
              console.log('⚠️ Checkout window closed by user')
            }
          }
        }, 500)

        return () => clearInterval(checkWindowClosed)
      } else {
        setStatus('waiting')
        alert('Por favor, permita pop-ups para continuar com o pagamento.')
      }
    }
  }, [isOpen, checkoutUrl, checkoutWindow, status])

  // Listen for postMessage from checkout success page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from Asaas domains
      if (!event.origin.includes('asaas.com')) return

      if (event.data.type === 'CHECKOUT_SUCCESS') {
        console.log('✅ Checkout completed successfully')
        setStatus('completed')
        onSuccess?.()
        checkoutWindow?.close()
        onClose()
      } else if (event.data.type === 'CHECKOUT_CANCEL') {
        console.log('❌ Checkout cancelled')
        checkoutWindow?.close()
        onClose()
      } else if (event.data.type === 'CHECKOUT_EXPIRED') {
        console.log('⏰ Checkout expired')
        checkoutWindow?.close()
        onClose()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSuccess, onClose, checkoutWindow])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <VibePhotoLogo size="sm" showText={false} />
          Checkout Aberto
        </DialogTitle>

        <DialogDescription className="sr-only">
          Uma nova janela foi aberta com o checkout seguro do Asaas
        </DialogDescription>

        <div className="space-y-6 py-4">
          {/* Status */}
          <div className="flex flex-col items-center gap-4 text-center">
            {status === 'opened' && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Checkout Aberto em Nova Janela
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Complete o pagamento na janela que acabou de abrir
                  </p>
                </div>
              </>
            )}

            {status === 'waiting' && (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-orange-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Preparando Checkout...
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Aguarde enquanto abrimos a página de pagamento
                  </p>
                </div>
              </>
            )}

            {status === 'completed' && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Pagamento Concluído!
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Seus créditos serão adicionados em instantes
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-700 font-medium">💡 Instruções:</p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
              <li>Uma nova janela foi aberta com o checkout</li>
              <li>Complete o pagamento nessa janela</li>
              <li>Não feche esta aba até concluir</li>
              <li>Seus créditos serão adicionados automaticamente</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (checkoutWindow && !checkoutWindow.closed) {
                  checkoutWindow.focus()
                } else {
                  window.open(checkoutUrl, 'AsaasCheckout', 'width=800,height=900')
                }
              }}
              className="flex-1"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Reabrir Checkout
            </Button>

            <Button
              onClick={onClose}
              className="flex-1"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
