'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Sparkles, Loader2, ArrowRight, ImageIcon, Wand2, Package, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'
import Link from 'next/link'

interface OnboardingStep {
  id: number
  title: string
  description: string
  action: string
  actionUrl: string
  icon: React.ReactNode
}

export default function SubscriptionSuccessPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, update: updateSession } = useSession()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [planInfo, setPlanInfo] = useState<{
    name: string
    credits: number
    cycle: string
  } | null>(null)

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Criar seu primeiro modelo',
      description: 'Faça upload de suas fotos e crie seu modelo personalizado de IA',
      action: 'Criar Modelo',
      actionUrl: '/models/create',
      icon: <ImageIcon className="w-8 h-8 text-purple-400" />
    },
    {
      id: 2,
      title: 'Gerar sua primeira imagem',
      description: 'Use seu modelo para gerar fotos incríveis com IA',
      action: 'Gerar Imagem',
      actionUrl: '/generate',
      icon: <Wand2 className="w-8 h-8 text-blue-400" />
    },
    {
      id: 3,
      title: 'Explorar pacotes temáticos',
      description: 'Descubra pacotes de fotos prontos para usar',
      action: 'Ver Pacotes',
      actionUrl: '/packages',
      icon: <Package className="w-8 h-8 text-green-400" />
    }
  ]

  useEffect(() => {
    async function loadUserData() {
      try {
        // CRITICAL: Invalidar todas as queries relacionadas a créditos e assinatura
        console.log('🔄 [SubscriptionSuccess] Invalidando queries após checkout success')
        queryClient.invalidateQueries({ queryKey: ['credits'] })
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        queryClient.invalidateQueries({ queryKey: ['user'] })
        
        // Atualizar sessão para refletir nova assinatura
        await updateSession()
        
        // Aguardar um pouco para garantir que a sessão foi atualizada
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Buscar dados atualizados da sessão (após updateSession)
        // Atualizar sessão novamente para pegar os dados mais recentes
        const updatedSession = await updateSession()
        
        // Extrair dados do usuário da sessão atualizada
        const user = updatedSession?.user || session?.user as any
        
        if (user?.plan) {
          // Usar getCreditsLimitForPlan ao invés de valores hardcoded
          const baseCredits = await getCreditsLimitForPlan(user.plan)
          
          // Multiplicar por 12 se for YEARLY
          const credits = user.billingCycle === 'YEARLY' ? baseCredits * 12 : baseCredits
          
          const planName = user.plan === 'STARTER' ? 'Starter' : user.plan === 'PREMIUM' ? 'Premium' : 'Gold'
          const cycle = user.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'
          
          setPlanInfo({
            name: planName,
            credits: credits,
            cycle: cycle
          })
          
          console.log('✅ [SubscriptionSuccess] Plan info carregado:', {
            plan: user.plan,
            billingCycle: user.billingCycle,
            credits,
            cycle
          })
        } else {
          console.warn('⚠️ [SubscriptionSuccess] Plan não encontrado na sessão. Aguardando atualização do webhook...')
          // Se não tiver plan ainda, pode ser que o webhook ainda não processou
          // Tentar novamente após alguns segundos
          setTimeout(async () => {
            const retrySession = await updateSession()
            const retryUser = retrySession?.user || session?.user as any
            if (retryUser?.plan) {
              const baseCredits = await getCreditsLimitForPlan(retryUser.plan)
              const credits = retryUser.billingCycle === 'YEARLY' ? baseCredits * 12 : baseCredits
              const planName = retryUser.plan === 'STARTER' ? 'Starter' : retryUser.plan === 'PREMIUM' ? 'Premium' : 'Gold'
              const cycle = retryUser.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'
              
              setPlanInfo({
                name: planName,
                credits: credits,
                cycle: cycle
              })
            }
          }, 3000) // Aguardar 3 segundos para webhook processar
        }
        
        setLoading(false)
      } catch (error: any) {
        console.error('❌ [SubscriptionSuccess] Erro ao carregar dados:', error)
        setLoading(false)
      }
    }

    loadUserData()

    // Verificar se deve mostrar onboarding (novos assinantes)
    // Mostrar onboarding apenas na primeira vez que acessa após pagamento
    const hasSeenOnboarding = localStorage.getItem('hasSeenSubscriptionOnboarding')
    if (!hasSeenOnboarding) {
      // Pequeno delay para melhorar UX
      setTimeout(() => setShowOnboarding(true), 1500)
    }
  }, [router, updateSession, queryClient])

  const handleSkipOnboarding = () => {
    localStorage.setItem('hasSeenSubscriptionOnboarding', 'true')
    setShowOnboarding(false)
  }

  const handleNextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSkipOnboarding()
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStartAction = (url: string) => {
    localStorage.setItem('hasSeenSubscriptionOnboarding', 'true')
    setShowOnboarding(false)
    router.push(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl w-full"
      >
        {/* Main Success Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 sm:p-8 text-center border border-slate-700 shadow-2xl mb-4">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6"
          >
            <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
          </motion.div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 px-2">
            Bem-vindo ao VibePhoto! 🎉
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-300 mb-4 sm:mb-6 px-2">
            Sua assinatura foi ativada com sucesso!
          </p>

          {/* Plan Info */}
          {planInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6 text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg sm:text-xl font-semibold text-white">Plano {planInfo.name}</h3>
                <span className="text-xs sm:text-sm text-purple-300 bg-purple-500/20 px-2 py-1 rounded-full">
                  {planInfo.cycle}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-white">{planInfo.credits.toLocaleString('pt-BR')}</span>
                <span className="text-sm sm:text-base text-slate-300">créditos disponíveis</span>
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {onboardingSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Link
                  href={step.actionUrl}
                  className="block bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg p-4 sm:p-5 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 group"
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
                    <div className="flex-shrink-0">{step.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
                        {step.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all hidden sm:block" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Button
              size="lg"
              onClick={() => router.push('/generate')}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 sm:px-8 py-6 sm:py-7 text-base sm:text-lg"
            >
              Começar a Gerar Imagens
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/')}
              className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white px-6 sm:px-8 py-6 sm:py-7 text-base sm:text-lg"
            >
              Ir para Dashboard
            </Button>
          </motion.div>
        </div>

        {/* Onboarding Modal (Mobile: Bottom Sheet, Desktop: Modal) */}
        <AnimatePresence>
          {showOnboarding && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleSkipOnboarding}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:z-40"
              />
              
              {/* Onboarding Content */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full sm:max-h-[85vh] bg-slate-800 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-700 shadow-2xl z-50 sm:z-50 overflow-hidden flex flex-col"
              >
                {/* Handle bar (mobile only) */}
                <div className="sm:hidden w-12 h-1.5 bg-slate-600 rounded-full mx-auto mt-3 mb-2" />
                
                {/* Header */}
                <div className="px-6 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Primeiros Passos</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Passo {currentStep + 1} de {onboardingSteps.length}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipOnboarding}
                    className="text-slate-400 hover:text-white hover:bg-slate-700 -mr-2"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 sm:px-8 py-3 bg-slate-800/50">
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="text-center"
                    >
                      <div className="mb-6 flex justify-center">
                        {onboardingSteps[currentStep].icon}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                        {onboardingSteps[currentStep].title}
                      </h3>
                      <p className="text-sm sm:text-base text-slate-300 mb-6">
                        {onboardingSteps[currentStep].description}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-8 py-4 sm:py-6 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={currentStep > 0 ? handlePrevStep : handleSkipOnboarding}
                    className="min-h-[44px] sm:min-h-[48px] flex-1 sm:flex-initial border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <ChevronLeft className="w-5 h-5 mr-2" />
                    {currentStep > 0 ? 'Voltar' : 'Pular'}
                  </Button>
                  
                  {currentStep < onboardingSteps.length - 1 ? (
                    <Button
                      size="lg"
                      onClick={handleNextStep}
                      className="min-h-[44px] sm:min-h-[48px] flex-1 sm:flex-initial bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
                    >
                      Próximo
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => handleStartAction(onboardingSteps[currentStep].actionUrl)}
                      className="min-h-[44px] sm:min-h-[48px] flex-1 sm:flex-initial bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
                    >
                      {onboardingSteps[currentStep].action}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
