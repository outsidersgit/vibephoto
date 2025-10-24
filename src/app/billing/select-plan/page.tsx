'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Zap, Users, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SelectPlanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PREMIUM' | 'GOLD'>('STARTER')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  
  // Check if this is a required plan selection (user tried to access protected feature)
  const isRequired = searchParams.get('required') === 'true'
  const isNewUser = searchParams.get('newuser') === 'true'
  const feature = searchParams.get('feature') || 'recursos premium'

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    router.push('/auth/signin')
    return null
  }

  const plans = [
    {
      id: 'STARTER',
      name: 'Starter',
      monthlyPrice: 89,
      annualPrice: 708,
      monthlyEquivalent: 59,
      description: 'Perfeito para começar',
      features: [
        '1 modelo de IA por mês',
        '50 créditos por mês',
        'Resolução padrão'
      ],
      popular: false,
      color: 'blue'
    },
    {
      id: 'PREMIUM',
      name: 'Premium',
      monthlyPrice: 269,
      annualPrice: 2148,
      monthlyEquivalent: 179,
      description: 'Para usuários regulares',
      features: [
        '3 modelos de IA por mês',
        '200 créditos por mês',
        'Alta resolução'
      ],
      popular: true,
      color: 'purple'
    },
    {
      id: 'GOLD',
      name: 'Gold',
      monthlyPrice: 449,
      annualPrice: 3588,
      monthlyEquivalent: 299,
      description: 'Para uso intensivo',
      features: [
        '10 modelos de IA por mês',
        '1000 créditos por mês',
        'Máxima resolução'
      ],
      popular: false,
      color: 'yellow'
    }
  ] as const

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    const savings = (monthlyPrice * 12) - annualPrice
    const monthsEquivalent = Math.round(savings / monthlyPrice)
    return { savings, monthsEquivalent }
  }

  const handlePlanSelect = (planId: 'STARTER' | 'PREMIUM' | 'GOLD') => {
    setSelectedPlan(planId)
    router.push(`/billing/upgrade?plan=${planId}&cycle=${billingCycle}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(isRequired || isNewUser) && (
          <div className={`mb-8 p-4 border rounded-lg ${
            isNewUser 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-start">
              <AlertCircle className={`w-5 h-5 mt-0.5 mr-3 ${
                isNewUser ? 'text-blue-600' : 'text-orange-600'
              }`} />
              <div>
                <h3 className={`text-sm font-medium ${
                  isNewUser ? 'text-blue-900' : 'text-orange-900'
                }`}>
                  {isNewUser ? 'Bem-vindo! Escolha Seu Plano' : 'Assinatura Necessária'}
                </h3>
                <p className={`text-sm mt-1 ${
                  isNewUser ? 'text-blue-700' : 'text-orange-700'
                }`}>
                  {isNewUser 
                    ? 'Para começar a usar as funcionalidades de IA, escolha o plano que melhor se adapta às suas necessidades.'
                    : `Para acessar ${feature}, você precisa escolher um plano e ativar sua assinatura.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Crown className="w-4 h-4 mr-2" />
            Escolha Seu Plano
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Desbloqueie Todo o Potencial da IA
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Escolha o plano ideal para suas necessidades de geração de fotos com IA. 
            Todos os planos incluem garantia de 7 dias.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-8 py-2 rounded-md text-sm font-medium transition-all relative ${
                  billingCycle === 'annual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Anual
                <span className="absolute -top-3 -right-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                  4 meses grátis
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative cursor-pointer transition-all hover:shadow-xl ${
                plan.popular 
                  ? 'border-2 border-purple-500 shadow-lg scale-105' 
                  : selectedPlan === plan.id 
                    ? 'border-2 border-blue-500' 
                    : 'border-2 border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600">
                  Mais Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                  plan.color === 'purple' 
                    ? 'bg-purple-100' 
                    : plan.color === 'yellow' 
                      ? 'bg-yellow-100' 
                      : 'bg-blue-100'
                }`}>
                  {plan.color === 'purple' && <Crown className="w-6 h-6 text-purple-600" />}
                  {plan.color === 'yellow' && <Zap className="w-6 h-6 text-yellow-600" />}
                  {plan.color === 'blue' && <Users className="w-6 h-6 text-blue-600" />}
                </div>
                
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="text-center">
                  {billingCycle === 'annual' ? (
                    <>
                      <div className="text-3xl font-bold">
                        R$ {plan.annualPrice}
                        <span className="text-sm font-normal text-gray-500">/ano</span>
                      </div>
                      <div className="text-sm text-green-600 font-medium">
                        R$ {plan.monthlyEquivalent}/mês
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        💸 Economize {calculateSavings(plan.monthlyPrice, plan.annualPrice).monthsEquivalent} meses!
                      </div>
                    </>
                  ) : (
                    <div className="text-3xl font-bold">
                      R$ {plan.monthlyPrice}
                      <span className="text-sm font-normal text-gray-500">/mês</span>
                    </div>
                  )}
                </div>
                <CardDescription className="text-base text-center">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : selectedPlan === plan.id
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : ''
                  }`}
                  variant={selectedPlan === plan.id || plan.popular ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlanSelect(plan.id)
                  }}
                >
                  {selectedPlan === plan.id ? 'Continuar' : 'Escolher Plano'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">
            Todos os planos incluem garantia de 7 dias • Cancele a qualquer momento
          </p>
          
          {!isRequired && (
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Voltar ao Dashboard
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}