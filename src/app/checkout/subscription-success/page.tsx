'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { CheckCircle, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

function SubscriptionSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Timeout de segurança: se passar 2 segundos, mostrar página mesmo assim
    const timeoutId = setTimeout(() => {
      console.log('⏱️ [SubscriptionSuccess] Timeout de segurança - mostrando página')
      setIsChecking(false)
    }, 2000)

    // Verificar se usuário já está autenticado
    if (status === 'loading') {
      // Aguardar carregamento da sessão, mas timeout garantirá que página seja mostrada
      return () => {
        clearTimeout(timeoutId)
      }
    }

    // Limpar timeout se a verificação completou
    clearTimeout(timeoutId)

    // Verificar se deve redirecionar (apenas se usuário estiver autenticado E tiver plano ativo)
    if (status === 'authenticated' && session?.user) {
      const user = session.user as any
      const subscriptionStatus = user?.subscriptionStatus
      
      // Redirecionar apenas se tiver plano ativo
      if (subscriptionStatus === 'ACTIVE') {
        console.log('✅ [SubscriptionSuccess] Usuário autenticado com plano ativo - redirecionando para dashboard')
        router.push('/dashboard')
        return
      }
      
      // Se está autenticado mas não tem plano ativo, mostrar página de sucesso
      console.log('ℹ️ [SubscriptionSuccess] Usuário autenticado mas sem plano ativo - mostrando página de sucesso')
    } else {
      // Se não está autenticado, mostrar página de sucesso
      console.log('ℹ️ [SubscriptionSuccess] Usuário não autenticado - mostrando página de sucesso')
    }

    setIsChecking(false)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [status, session, router, searchParams])

  const handleLogin = () => {
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}&paymentSuccess=true`)
  }

  // Mostrar loading apenas enquanto verifica sessão (com timeout mais curto)
  if (isChecking && status === 'loading') {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-purple-400/30"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4 sm:p-6 pt-24 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-2xl w-full relative z-10"
      >
        {/* Main Success Card */}
        <div 
          className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-center border shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 50%, rgba(30, 41, 59, 0.8) 100%)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
          }}
        >
          {/* Shine effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Title with inline icon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            {/* Success Icon - smaller and inline */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                delay: 0.2, 
                type: 'spring', 
                stiffness: 200,
                damping: 15
              }}
              className="relative"
            >
              <div className="relative w-10 h-10">
                {/* Pulsing glow effect */}
                <motion.div
                  className="absolute inset-0 bg-green-500/30 rounded-full blur-md"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.7, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                {/* Icon container */}
                <div className="relative w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center border border-green-500/30 shadow-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" strokeWidth={2.5} />
                </div>
              </div>
            </motion.div>
            
            <h1
              className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
              style={{
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: '1.2'
              }}
            >
              Pagamento Confirmado!
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed max-w-md mx-auto"
          >
            Seu pagamento foi processado com sucesso! Sua assinatura será ativada automaticamente após o login.
          </motion.p>

          {/* Info Box - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="relative mb-8 rounded-xl p-6 text-left overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <div className="relative z-10">
              <p className="text-sm font-semibold text-white mb-2">
                Próximo passo
              </p>
              <p className="text-sm text-slate-200 leading-relaxed">
                Caso não seja redirecionado automaticamente, faça o login para acessar sua conta e começar a usar todos os recursos do seu plano.
              </p>
            </div>
            {/* Animated gradient overlay */}
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(135deg, transparent 0%, rgba(139, 92, 246, 0.2) 50%, transparent 100%)',
              }}
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 2,
                ease: "linear"
              }}
            />
          </motion.div>

          {/* CTA Button - Enhanced */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center items-center"
          >
            <Button
              size="lg"
              onClick={handleLogin}
              className="group relative w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-6 text-base shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 overflow-hidden"
            >
              {/* Button shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6 }}
              />
              <span className="relative flex items-center">
                <LogIn className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
                Fazer Login
              </span>
            </Button>
          </motion.div>
        </div>

        {/* Footer Info - Enhanced */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-slate-500">
            Precisa de ajuda?{' '}
            <a 
              href="/support" 
              className="text-purple-400 hover:text-purple-300 hover:underline transition-colors font-medium"
            >
              Entre em contato com o suporte
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4 -mt-20">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-purple-400/30"></div>
        </div>
      </div>
    }>
      <SubscriptionSuccessContent />
    </Suspense>
  )
}