'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Crown, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface SubscriptionGateProps {
  children: React.ReactNode
  feature?: string
  requiredPlan?: 'STARTER' | 'PREMIUM' | 'GOLD'
  fallback?: React.ReactNode
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean
  subscriptionStatus: string | null
  plan: string
  isInDevelopmentMode: boolean
}

export function SubscriptionGate({ 
  children, 
  feature = "este recurso", 
  requiredPlan = 'STARTER',
  fallback
}: SubscriptionGateProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      if (status === 'loading') return
      
      if (!session?.user) {
        router.push('/auth/signin')
        return
      }

      try {
        const response = await fetch('/api/subscription/status')
        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data)
        } else {
          console.error('Failed to fetch subscription status')
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [session, status, router])

  // Show loading state
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sua assinatura...</p>
        </div>
      </div>
    )
  }

  // Handle development mode
  if (subscriptionStatus?.isInDevelopmentMode) {
    return (
      <div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Modo de Desenvolvimento:</strong> Simulando assinatura ativa para testes.
                <br />
                <code>DEV_SIMULATE_PAID_SUBSCRIPTION=true</code>
              </p>
            </div>
          </div>
        </div>
        {children}
      </div>
    )
  }

  // Show subscription required gate
  if (!subscriptionStatus?.hasActiveSubscription) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">
                Assinatura Necessária
              </CardTitle>
              <CardDescription className="text-lg">
                Para acessar {feature}, você precisa de uma assinatura ativa
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              {/* Current Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700">Status Atual</p>
                    <p className="text-xs text-gray-500">Plano: {subscriptionStatus?.plan || 'Não definido'}</p>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {subscriptionStatus?.subscriptionStatus || 'Inativo'}
                  </Badge>
                </div>
              </div>

              {/* Features Preview */}
              <div className="grid md:grid-cols-3 gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <Crown className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Modelos de IA</p>
                    <p className="text-xs text-gray-500">1-10 modelos por mês</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Zap className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Mais Créditos</p>
                    <p className="text-xs text-gray-500">50-1000 créditos mensais</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Crown className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Alta Qualidade</p>
                    <p className="text-xs text-gray-500">Imagens em máxima resolução</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild className="flex-1">
                  <Link href="/pricing?required=true">
                    <Crown className="w-4 h-4 mr-2" />
                    Escolher Plano
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/dashboard">
                    Voltar ao Dashboard
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-gray-500">
                Todos os planos incluem garantia de 7 dias. Cancele a qualquer momento.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // User has active subscription, show protected content
  return <>{children}</>
}

/**
 * Hook for checking subscription status in components
 */
export function useSubscriptionGuard() {
  const { data: session } = useSession()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      if (!session?.user) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/subscription/status')
        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data)
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [session])

  return {
    isLoading,
    hasActiveSubscription: subscriptionStatus?.hasActiveSubscription || false,
    subscriptionStatus,
    isInDevelopmentMode: subscriptionStatus?.isInDevelopmentMode || false
  }
}