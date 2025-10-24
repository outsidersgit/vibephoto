'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { CheckCircle, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Atualizar sessão para refletir nova assinatura
    updateSession()

    // Send message to parent window (if in iframe)
    if (window.opener || window.parent !== window) {
      window.parent.postMessage({ type: 'CHECKOUT_SUCCESS' }, window.location.origin)
    }

    // Countdown para redirecionar automaticamente
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          router.push('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [router, updateSession])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 text-center border border-slate-700">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-green-400" />
          </motion.div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Pagamento Confirmado!
          </h1>

          {/* Description */}
          <p className="text-slate-300 mb-6">
            Sua assinatura foi ativada com sucesso e você já pode usar todos os recursos do seu plano!
          </p>

          {/* Success Info */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-green-400 font-semibold mb-3 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              O que acontece agora?
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Sua assinatura está ativa imediatamente</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Seus créditos já estão disponíveis</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Você receberá um email de confirmação</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Pode começar a gerar imagens agora</span>
              </li>
            </ul>
          </div>

          {/* Redirect Message with Countdown */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin mr-2" />
              <p className="text-sm text-slate-300">
                Redirecionando em <strong className="text-blue-400">{countdown}s</strong>
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Ir Agora
            </Button>
          </div>

          {/* Manual Redirect Button */}
          <p className="text-xs text-slate-500 text-center">
            Precisa de ajuda?{' '}
            <a href="/support" className="text-blue-400 hover:underline">
              Contate o suporte
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
