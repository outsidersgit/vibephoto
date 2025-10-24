'use client'

import { Check, Sparkles, Crown, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from '@/components/ui/premium-card'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import Link from 'next/link'

interface PricingPlan {
  name: string
  price: string
  originalPrice?: string
  description: string
  features: string[]
  popular?: boolean
  premium?: boolean
  ctaText: string
  ctaHref: string
}

export function PremiumPricing() {
  const plans: PricingPlan[] = [
    {
      name: 'Starter',
      price: 'R$ 29',
      originalPrice: 'R$ 49',
      description: 'Perfeito para começar com IA',
      features: [
        '50 gerações por mês',
        '1 modelo personalizado',
        'Qualidade HD',
        'Processamento padrão',
        'Suporte por email',
        'Templates básicos'
      ],
      ctaText: 'Começar Agora',
      ctaHref: '/auth/signup?plan=starter'
    },
    {
      name: 'Premium',
      price: 'R$ 79',
      originalPrice: 'R$ 99',
      description: 'Ideal para criadores de conteúdo',
      features: [
        '200 gerações por mês',
        '5 modelos personalizados',
        'Qualidade 4K',
        'Processamento prioritário',
        'Suporte prioritário',
        'Templates premium',
        'Edição avançada',
        'Exportação em lote'
      ],
      popular: true,
      ctaText: 'Mais Popular',
      ctaHref: '/auth/signup?plan=premium'
    },
    {
      name: 'Gold',
      price: 'R$ 149',
      originalPrice: 'R$ 199',
      description: 'Para profissionais e agências',
      features: [
        '1000 gerações por mês',
        '20 modelos personalizados',
        'Qualidade 8K',
        'Processamento rápido',
        'Suporte 24/7',
        'Templates exclusivos',
        'IA avançada',
        'API access',
        'Marca branca',
        'Analytics detalhado'
      ],
      premium: true,
      ctaText: 'Máxima Qualidade',
      ctaHref: '/auth/signup?plan=gold'
    }
  ]

  return (
    <section className="py-24 px-4 bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Preços Especiais de Lançamento
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Escolha Seu <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Plano Perfeito</span>
          </h2>
          
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Todos os planos incluem acesso completo à nossa tecnologia de IA avançada. 
            Comece grátis e faça upgrade quando quiser.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${plan.popular ? 'lg:-mt-4 lg:scale-105' : ''}`}
            >
              <PremiumCard 
                className={`h-full ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200' 
                    : plan.premium
                    ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200'
                    : ''
                }`}
                hoverable
                glowing={plan.popular || plan.premium}
                borderBeam={plan.popular}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                      ⭐ Mais Popular
                    </div>
                  </div>
                )}

                {/* Premium Badge */}
                {plan.premium && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center">
                      <Crown className="w-4 h-4 mr-2" />
                      Premium
                    </div>
                  </div>
                )}

                <PremiumCardHeader className="text-center pt-8">
                  <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                      : plan.premium
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                      : 'bg-gradient-to-r from-slate-500 to-slate-600'
                  }`}>
                    {plan.popular ? (
                      <Sparkles className="w-8 h-8 text-white" />
                    ) : plan.premium ? (
                      <Crown className="w-8 h-8 text-white" />
                    ) : (
                      <Zap className="w-8 h-8 text-white" />
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                      <span className="text-slate-600">/mês</span>
                    </div>
                    
                    {plan.originalPrice && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg text-slate-400 line-through">{plan.originalPrice}</span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm font-semibold">
                          {Math.round((1 - parseInt(plan.price.replace('R$ ', '')) / parseInt(plan.originalPrice.replace('R$ ', ''))) * 100)}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-slate-600 mb-6">{plan.description}</p>
                </PremiumCardHeader>

                <PremiumCardContent>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          plan.popular 
                            ? 'bg-purple-100 text-purple-600' 
                            : plan.premium
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.ctaHref} className="block">
                    {plan.popular ? (
                      <ShimmerButton 
                        className="w-full py-3 text-lg font-semibold"
                        background="linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)"
                      >
                        {plan.ctaText}
                        <Sparkles className="ml-2 w-5 h-5" />
                      </ShimmerButton>
                    ) : plan.premium ? (
                      <ShimmerButton 
                        className="w-full py-3 text-lg font-semibold"
                        background="linear-gradient(135deg, #f59e0b 0%, #eab308 100%)"
                      >
                        {plan.ctaText}
                        <Crown className="ml-2 w-5 h-5" />
                      </ShimmerButton>
                    ) : (
                      <button className="w-full py-3 text-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all duration-300">
                        {plan.ctaText}
                      </button>
                    )}
                  </Link>
                </PremiumCardContent>
              </PremiumCard>
            </motion.div>
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="inline-flex items-center gap-6 px-6 py-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Sem compromisso</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Cancele quando quiser</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Suporte 24/7</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}