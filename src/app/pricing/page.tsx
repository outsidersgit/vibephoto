'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, ArrowRight, AlertCircle, Calendar, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { PLANS, type Plan } from '@/config/pricing'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { useAuthGuard } from '@/hooks/useAuthGuard'

// Exemplos de uso da IA - Carrossel
const aiExamples = [
  {
    title: "Redes Sociais",
    description: "Conteúdo profissional para destacar seu feed.",
    image: "/examples/card-instagram-redes-sociais.jpg"
  },
  {
    title: "Campanhas Publicitárias",
    description: "Imagens comerciais que vendem por si só.",
    image: "/examples/card-fotos-profissionais.jpg"
  },
  {
    title: "Selfies de IA",
    description: "Você em qualquer cenário, pose ou estilo.",
    image: "/examples/card-selfies-ia.jpg"
  },
  {
    title: "Fotos de CEO",
    description: "Retratos executivos com presença e impacto.",
    image: "/examples/card-fotos-ceo.jpg"
  },
  {
    title: "Artísticas & Conceituais",
    description: "Exploração criativa sem limites.",
    image: "/examples/card-artisticas-conceituais.jpg"
  },
  {
    title: "Obras Reinventadas",
    description: "Ícones visuais recriados com a força da IA.",
    image: "/examples/card-obras-reinventadas.jpg"
  },
  {
    title: "Filosofia em imagem",
    description: "Ideias profundas ganham forma visual.",
    image: "/examples/card-filosofia-imagem.jpg"
  },
  {
    title: "Fitness & Lifestyle",
    description: "Fotos motivacionais com energia e estilo.",
    image: "/examples/card-fitness-lifestyle.jpg"
  },
  {
    title: "Urbano & Street",
    description: "Autenticidade e atitude em cada clique.",
    image: "/examples/card-urbano-street.jpg"
  },
  {
    title: "Nômade Digital",
    description: "Profissionalismo em qualquer lugar do mundo.",
    image: "/examples/card-nomade-digital.jpg"
  },
  {
    title: "Moda Virtual",
    description: "Experimente looks em você ou crie fotos comerciais sem precisar de ensaio.",
    image: "/examples/card-moda.jpg"
  },
  {
    title: "Influência sob Medida",
    description: "O influenciador que você imagina, pronto para ganhar vida.",
    image: "/examples/card-influencer.jpg"
  },
  {
    title: "Visual Cinematográfico",
    description: "Crie cenas que parecem saídas de um filme.",
    image: "/examples/card-visual-cinematografico.jpg"
  }
]

// Depoimentos de clientes
const testimonials = [
  {
    name: "Tainá Bueno",
    role: "Influenciadora Digital",
    avatar: "/avatars/marina.jpg",
    content: "Sempre dependi de fotógrafos para criar conteúdo, mas isso limitava minha rotina e encarecia o processo. Com o VibePhoto, consegui ter fotos profissionais sozinha, em casa, e manter minhas redes sociais com a mesma qualidade de uma campanha.",
    rating: 5
  },
  {
    name: "Fabrício Tavares",
    role: "Médico",
    avatar: "/avatars/carlos.jpg", 
    content: "Eu precisava de fotos formais para congressos e apresentações médicas, mas nunca tinha tempo para ensaios. Com o VibePhoto, resolvi isso em minutos e ainda me surpreendi ao perceber que meus colegas não faziam ideia de que as fotos tinham sido criadas por IA.",
    rating: 5
  },
  {
    name: "Bruna Puga",
    role: "Advogada",
    avatar: "/avatars/ana.jpg",
    content: "Minhas fotos antigas não transmitiam a seriedade que eu queria para meu escritório. O VibePhoto me deu retratos profissionais que elevam minha imagem e passam muito mais credibilidade.",
    rating: 5
  },
  {
    name: "Marcella Melo",
    role: "Empresária",
    avatar: "/avatars/marcella.jpg",
    content: "Para apresentações da empresa e redes sociais, eu sempre precisava de sessões caras e demoradas. Agora, com o VibePhoto, tenho imagens profissionais sob demanda, que reforçam tanto meu perfil pessoal quanto institucional.",
    rating: 5
  }
]

// FAQ - Perguntas frequentes
const faqItems = [
  {
    question: "O que é o Vibe Photo?",
    answer: "O Vibe Photo é uma plataforma de IA que cria fotos profissionais personalizadas. Envie suas selfies, nossa IA treina um modelo único do seu rosto e gera fotos suas em qualquer cenário desejado."
  },
  {
    question: "Qual a diferença entre Assinaturas e Pacotes Únicos?",
    answer: "Assinaturas renovam créditos automaticamente (mensais/anuais) - ideais para uso constante. Pacotes únicos são compras avulsas válidas por 1 ano - perfeitos para uso esporádico. Nas assinaturas, créditos não utilizados expiram no final do período."
  },
  {
    question: "Como funciona o sistema de créditos?",
    answer: "Cada foto consome 10 créditos. Criar modelos é GRATUITO. Assinaturas: Starter (50 fotos/mês), Premium (120 fotos/mês), Gold (250 fotos/mês). Pacotes únicos: 35 a 500 fotos válidas por 1 ano."
  },
  {
    question: "Quantas fotos preciso para treinar meu modelo?",
    answer: "Entre 19-33 fotos de alta qualidade com diferentes ângulos, expressões e iluminações. Maior variedade = melhor qualidade dos resultados."
  },
  {
    question: "Quanto tempo demora o treinamento?",
    answer: "10-30 minutos dependendo da qualidade das fotos. Você recebe notificação por email quando estiver pronto."
  },
  {
    question: "Quais formas de pagamento aceitam?",
    answer: "Cartões (Visa, Mastercard, Elo) e PIX via Asaas. Processamento seguro e criptografado."
  },
  {
    question: "Posso cancelar a assinatura?",
    answer: "Sim, a qualquer momento em \"Minha Conta > Assinatura\". Cancelamento efetivo no final do período atual."
  },
  {
    question: "Oferecem reembolso?",
    answer: "7 dias para reembolso integral (CDC Art. 49) APENAS se não usar nenhum recurso. Após primeiro uso da IA, sem direito à desistência devido aos custos irreversíveis de processamento."
  },
  {
    question: "Minhas fotos estão seguras?",
    answer: "Sim! Criptografia militar, servidores seguros. Apenas você tem acesso. Nunca compartilhamos ou vendemos suas imagens."
  },
  {
    question: "Usam minhas fotos para outros modelos?",
    answer: "NÃO! Suas fotos são exclusivas para seu modelo pessoal. Não as utilizamos para treinar outros modelos. Privacidade é prioridade."
  },
  {
    question: "Que formato de fotos enviar?",
    answer: "JPG, PNG, WebP. Mínimo 512x512px, bem iluminadas, rosto visível. Evite fotos escuras, borradas ou com óculos escuros."
  }
]


function PricingPageContent() {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #300/#310
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PREMIUM' | 'GOLD'>('PREMIUM')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [mounted, setMounted] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  
  const isRequired = searchParams.get('required') === 'true'
  const isNewUser = searchParams.get('newuser') === 'true'

  // Buscar planos do banco de dados (com fallback para planos hardcoded)
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/subscription-plans')
        if (response.ok) {
          const data = await response.json()
          const fetchedPlans = data.plans || []
          
          // Se a API retornou planos, usar eles
          if (fetchedPlans.length > 0) {
            setPlans(fetchedPlans)
          } else {
            // Se não retornou planos, usar fallback hardcoded
            console.warn('⚠️ [PRICING] Nenhum plano retornado da API, usando fallback hardcoded')
            setPlans(PLANS)
          }
        } else {
          // Se a API retornou erro, usar fallback hardcoded
          console.warn('⚠️ [PRICING] Erro na API, usando fallback hardcoded')
          setPlans(PLANS)
          
          const errorData = await response.json().catch(() => ({}))
          console.error('Erro ao buscar planos da API:', response.status, errorData)
        }
      } catch (error) {
        // Se houver erro de conexão, usar fallback hardcoded
        console.error('❌ [PRICING] Erro ao conectar com API, usando fallback hardcoded:', error)
        setPlans(PLANS)
      } finally {
        setLoadingPlans(false)
      }
    }
    
    fetchPlans()
  }, [])

  // CRITICAL: Verificar autenticação ANTES de renderizar conteúdo
  const isAuthorized = useAuthGuard()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect users with active subscription to dashboard (unless they are accessing specific flows)
  useEffect(() => {
    if (mounted && session?.user && !isRequired && !isNewUser) {
      // Check subscription status - if active, redirect to dashboard
      if (session.user.subscriptionStatus === 'ACTIVE') {
        router.push('/dashboard')
        return
      }
    }
  }, [mounted, session, isRequired, isNewUser, router])

  // CRITICAL: AGORA sim podemos fazer early returns após TODOS os hooks
  // Durante loading, mostrar loading state (não bloquear)
  // A página server-side já garantiu que há sessão válida
  if (status === 'loading' || isAuthorized === null || !mounted || loadingPlans) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Se não autenticado após loading, aguardar (página server-side já verificou)
  if (status === 'unauthenticated' || !session?.user || isAuthorized === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    const savings = (monthlyPrice * 12) - annualPrice
    const monthsEquivalent = Math.round(savings / monthlyPrice)
    return { savings, monthsEquivalent }
  }

  const handlePlanSelect = (planId: 'STARTER' | 'PREMIUM' | 'GOLD') => {
    setSelectedPlan(planId)
    if (!session?.user) {
      router.push('/auth/signup')
    } else {
      // Check subscription status to determine route
      const hasActiveSubscription = session.user.subscriptionStatus === 'ACTIVE'
      const targetRoute = hasActiveSubscription ? 'upgrade' : 'activate'
      router.push(`/billing/${targetRoute}?plan=${planId}&cycle=${billingCycle}`)
    }
  }


  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Hero Section */}
        <div className="text-center mb-16" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
            Escolha seu plano
          </h1>

          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-50 p-0.5 rounded-lg border border-gray-200 flex w-full max-w-xs">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all relative ${
                  billingCycle === 'annual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Anual
                {billingCycle === 'annual' && (
                  <span className="absolute -top-2.5 -right-2 bg-gray-900 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-semibold shadow-sm whitespace-nowrap">
                    4 meses grátis
                  </span>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Plans Grid - Sempre mostrar planos (do banco ou fallback) */}
        {!loadingPlans && plans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto mb-8" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
            {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id
            return (
            <Card
              key={plan.id}
              className={`relative transition-all hover:shadow-lg border-gray-300 bg-gray-200 cursor-pointer ${
                isSelected ? 'ring-2 ring-gray-900 shadow-md' : ''
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white">
                  Popular
                </Badge>
              )}

              <CardHeader className="text-left pb-6">
                <CardTitle className="text-3xl font-bold text-gray-900 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>{plan.name}</CardTitle>
                <div className="mb-6">
                  {billingCycle === 'annual' ? (
                    <>
                      <div className="text-2xl font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        R$ {plan.annualPrice}
                        <span className="text-base font-normal text-gray-500">/ano</span>
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        R$ {plan.monthlyEquivalent}/mês
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      R$ {plan.monthlyPrice}
                      <span className="text-base font-normal text-gray-500">/mês</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => {
                    let displayFeature = feature

                    if (billingCycle === 'annual') {
                      if (feature.includes('créditos/mês')) {
                        const yearlyCredits = (plan.credits || 0) * 12
                        displayFeature = feature.replace(/\d+[.,]?\d*\s*créditos\/mês/, `${yearlyCredits.toLocaleString('pt-BR')} créditos/ano`)
                      }

                      if (/fotos\//i.test(feature) || feature.toLowerCase().includes('fotos por')) {
                        displayFeature = displayFeature.replace(/(\d+[.,]?\d*)\s*fotos\s*(?:\/|por)\s*m[eê]s/gi, (match, value) => {
                          const monthlyPhotos = parseInt(String(value).replace(/\D/g, ''), 10)
                          if (Number.isNaN(monthlyPhotos)) {
                            return match
                          }
                          const yearlyPhotos = monthlyPhotos * 12
                          return `${yearlyPhotos.toLocaleString('pt-BR')} fotos por ano`
                        })
                      }
                    }

                    return (
                      <li key={index} className="flex items-center text-sm">
                        <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                          <Check className="w-3 h-3 text-gray-600" />
                        </div>
                        <span className="text-gray-700 flex items-center" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                          {displayFeature}
                          {feature === '1 modelo de IA' && (
                            <div className="relative ml-2 group">
                              <button className="w-3 h-3 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-700 transition-colors">
                                !
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
                                <div className="text-center">
                                  Você pode criar modelos adicionais ao custo de 500 créditos cada.
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <Button
                  className={`w-full py-3 transition-colors ${
                    isSelected
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlanSelect(plan.id)
                  }}
                >
                  Escolher Plano
                </Button>
              </CardContent>
            </Card>
            )
          })}
          </div>
        )}

        {/* Subscription Cancellation Notice */}
        <div className="flex items-center justify-center mb-20">
          <div className="flex items-center text-center">
            <Check className="w-4 h-4 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-600" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Cancele a qualquer momento
            </span>
          </div>
        </div>

        {/* Credit Information Section - "Acabaram os créditos?" from landing page */}
        <div className="mb-20" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-gray-100 rounded-xl p-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Acabaram os créditos?
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Se seus créditos acabarem antes da renovação do plano, você pode comprar <strong>pacotes de créditos avulsos</strong> com pagamento único, sem recorrência e válidos por <strong>1 ano</strong>.
              </p>
              <div className="flex items-center justify-center">
                <Check className="w-5 h-5 text-gray-600 mr-3" />
                <span className="text-gray-600 font-medium" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Continue criando sem interrupções
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* AI Examples Carousel Section - Full Screen Width */}
      <div className="mb-20 overflow-hidden relative group/carousel" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        <div className="mb-12 px-6 max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-left" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
            Possibilidades infinitas da sua <span className="bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">vibe</span>
          </h2>
        </div>

        {/* Seta Esquerda - Na borda da viewport */}
        <button
          onClick={() => {
            if (carouselRef.current) {
              carouselRef.current.scrollBy({ left: -400, behavior: 'smooth' })
            }
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-14 h-14 bg-transparent hover:bg-white/80 shadow-lg hover:shadow-xl rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/50 hover:border-gray-300/50"
        >
          <ChevronLeft className="w-7 h-7 text-white hover:text-gray-700 transition-colors duration-300" />
        </button>

        {/* Seta Direita - Na borda da viewport */}
        <button
          onClick={() => {
            if (carouselRef.current) {
              carouselRef.current.scrollBy({ left: 400, behavior: 'smooth' })
            }
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-14 h-14 bg-transparent hover:bg-white/80 shadow-lg hover:shadow-xl rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/50 hover:border-gray-300/50"
        >
          <ChevronRight className="w-7 h-7 text-white hover:text-gray-700 transition-colors duration-300" />
        </button>

        {/* Carrossel Horizontal - Full Screen Width */}
        <div className="relative">

          <div
            ref={carouselRef}
            className="overflow-x-auto scroll-smooth"
            style={{
              scrollBehavior: 'smooth',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex space-x-6 pb-6 pl-0 pr-0" style={{ width: 'max-content' }}>
              {aiExamples.map((example, index) => (
                <div
                  key={index}
                  className="relative w-96 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200"
                  style={{ height: '420px' }}
                  onClick={() => setSelectedImage(example.image)}
                >
                  {/* Imagem 100% */}
                  <img
                    src={example.image}
                    alt={example.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />

                  {/* Overlay gradiente para melhor legibilidade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Texto sobreposto */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 transform transition-transform duration-300 group-hover:translate-y-[-2px]">
                    <h3 className="text-white text-lg font-semibold mb-2 drop-shadow-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      {example.title}
                    </h3>
                    <p className="text-white/95 text-sm leading-relaxed drop-shadow-md" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      {example.description}
                    </p>
                  </div>

                  {/* Indicador de hover */}
                  <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Borda sutil no hover */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
              ))}
              </div>
            </div>

            {/* Fade sutil apenas na direita para indicar mais conteúdo */}
            <div className="absolute right-0 top-0 w-12 h-full bg-gradient-to-l from-white via-white/30 to-transparent pointer-events-none opacity-60"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20">

        {/* Testimonials Section - Modernized */}
        <div className="mb-20" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              O impacto real do VibePhoto
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-300/60 hover:border-gray-400/70">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                    {testimonial.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                    {testimonial.role}
                  </p>
                </div>

                <blockquote className="text-gray-700 text-sm leading-relaxed font-normal" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  "{testimonial.content}"
                </blockquote>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Link Section */}
        <div className="text-center mb-20" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <p className="text-gray-600 text-base leading-relaxed" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
            Tem alguma dúvida? Consulte nossa{' '}
            <Link href="/legal/faq" className="text-gray-900 font-semibold hover:text-gray-700 underline transition-colors">
              página de perguntas frequentes
            </Link>
            {' '}para encontrar todas as respostas.
          </p>
        </div>


        {/* Terms Footer */}
        <div className="border-t border-gray-200 pt-12 mt-16" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="max-w-5xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Informações Importantes</h3>
            <div className="text-sm text-gray-600 leading-relaxed space-y-4" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              <p>
                <strong className="text-gray-800">Política de Reembolso (CDC Art. 49):</strong> 7 dias para reembolso integral APENAS se nenhum recurso de IA for utilizado. Após o primeiro uso, sem direito à desistência devido aos custos irreversíveis de processamento.
              </p>
              <p>
                <strong className="text-gray-800">Renovação Automática:</strong> Assinaturas renovam automaticamente no final de cada período.
              </p>
              <p>
                <strong className="text-gray-800">Cancelamento:</strong> Possível a qualquer momento em sua área de usuário. O cancelamento será efetivo no final do período atual, e você continuará tendo acesso até o vencimento.
              </p>
              <p>
                <strong className="text-gray-800">Créditos:</strong> 10 créditos por foto. Pacotes de fotos podem ter custos de créditos maiores. Assinaturas: créditos expiram no fim do período. Pacotes únicos: válidos por 1 ano. Créditos não são reembolsáveis.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500 text-center" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Ao prosseguir, você concorda com nossos{' '}
                <Link href="/legal/terms" className="underline hover:text-gray-700 font-medium">
                  Termos de Uso
                </Link>
                {' '}e{' '}
                <Link href="/legal/privacy" className="underline hover:text-gray-700 font-medium">
                  Política de Privacidade
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Global para scrollbar */}
      <style jsx global>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }

        /* Prevent horizontal scroll on body */
        body {
          overflow-x: hidden;
        }

        @media (max-width: 768px) {
          .w-96 {
            width: 320px !important;
            height: 360px !important;
          }
        }

        @media (max-width: 480px) {
          .w-96 {
            width: 280px !important;
            height: 320px !important;
          }

          .space-x-6 > * + * {
            margin-left: 1rem !important;
          }
        }
      `}</style>

      {/* Modal para exibir imagem */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          {/* Botão de fechar fixo */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-20 bg-black bg-opacity-70 rounded-full p-3 shadow-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Container da imagem ajustado */}
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Imagem expandida"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      </div>
    </>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  )
}