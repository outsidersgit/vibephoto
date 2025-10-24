'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { XCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckoutCancelPage() {
  const router = useRouter()

  useEffect(() => {
    // Send message to parent window (if in iframe)
    if (window.opener || window.parent !== window) {
      window.parent.postMessage({ type: 'CHECKOUT_CANCEL' }, window.location.origin)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 text-center border border-slate-700">
          {/* Cancel Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <XCircle className="w-12 h-12 text-yellow-400" />
          </motion.div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Checkout Cancelado
          </h1>

          {/* Description */}
          <p className="text-slate-300 mb-4">
            Você cancelou o processo de pagamento. Nenhuma cobrança foi realizada.
          </p>

          {/* Info */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-slate-300">
              <strong className="text-yellow-400">Nenhuma cobrança realizada</strong>
              <br />
              Seu pagamento foi cancelado com segurança. Você pode escolher outro método de pagamento ou voltar mais tarde.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/pricing')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              Escolher Outro Plano
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="ghost"
              className="w-full text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
