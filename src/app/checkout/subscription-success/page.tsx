'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight, Home, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SubscriptionSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Verificar se usuário já está autenticado
    if (status === 'loading') {
      return // Aguardar carregamento da sessão
    }

    if (status === 'authenticated' && session?.user) {
      // Se já está autenticado, redirecionar para dashboard
      // O webhook pode ainda não ter processado, mas o usuário pode acessar
      router.push('/dashboard')
      return
    }

    // Se não está autenticado, mostrar página de sucesso
    setIsChecking(false)
  }, [status, session, router])

  const handleLogin = () => {
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}&paymentSuccess=true`)
  }

  const handleHome = () => {
    router.push('/')
  }

  // Mostrar loading apenas enquanto verifica sessão
  if (isChecking || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-lg w-full"
      >
        {/* Main Success Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 text-center border border-slate-700 shadow-2xl">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-green-400" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl sm:text-3xl font-bold text-white mb-3"
          >
            Pagamento Confirmado! 🎉
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-base sm:text-lg text-slate-300 mb-6"
          >
            Seu pagamento foi processado com sucesso!
          </motion.p>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-5 mb-6 text-left"
          >
            <p className="text-sm text-slate-200 leading-relaxed">
              <strong className="text-white">Próximo passo:</strong> Faça login para acessar sua conta e começar a usar todos os recursos do seu plano.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Sua assinatura será ativada automaticamente após o login.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Button
              size="lg"
              onClick={handleLogin}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-6 text-lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Fazer Login
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleHome}
              className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white px-8 py-6 text-lg"
            >
              <Home className="w-5 h-5 mr-2" />
              Ir para Home
            </Button>
          </motion.div>
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-slate-500">
            Precisa de ajuda?{' '}
            <a href="/support" className="text-purple-400 hover:text-purple-300 hover:underline">
              Entre em contato com o suporte
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}