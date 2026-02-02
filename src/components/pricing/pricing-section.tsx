'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Zap, Users } from 'lucide-react'
import Link from 'next/link'
import { PLANS, type Plan } from '@/config/pricing'

// Use centralized pricing configuration
const plans: Plan[] = PLANS

const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
  const savings = (monthlyPrice * 12) - annualPrice
  const monthsEquivalent = Math.round(savings / monthlyPrice)
  return { savings, monthsEquivalent }
}

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Preços Simples e Transparentes</h2>
        <p className="text-gray-600 mb-8">Escolha o plano que se encaixa nas suas necessidades</p>
        
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center mb-12">
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
        
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`border-2 relative ${
                plan.popular 
                  ? 'border-purple-500 scale-105' 
                  : 'border-gray-200'
              }`}
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
                <div className="text-base text-center text-gray-600">
                  {plan.description}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {plan.features.map((feature, index) => {
                  // Adjust credits display based on billing cycle
                  let displayFeature = feature
                  if (billingCycle === 'annual' && feature.includes('créditos/mês')) {
                    const yearlyCredits = plan.credits * 12
                    displayFeature = feature.replace(/\d+\.?\d*\s*créditos\/mês/, `${yearlyCredits.toLocaleString('pt-BR')} créditos/ano`)
                  }
                  return (
                  <div key={index} className="flex items-center">
                    <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{displayFeature}</span>
                  </div>
                  )
                })}
                <Button className="w-full mt-6" variant={plan.popular ? 'default' : 'outline'} asChild>
                  <Link href="/auth/signup">Acessar Agora</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}