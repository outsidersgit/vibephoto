'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, ArrowDown, Sparkles, Users, Zap, Shield, Plus, ImageIcon, TrendingUp, Crown, CreditCard, Upload, Bot, Wand2, Camera, Star, User, X, Calendar, Check, Video, ArrowUp, Edit3, Play, Pause } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
// Framer Motion imports
import { motion, useScroll, useTransform, useInView } from 'framer-motion'

interface CreditPackage {
  id: 'ESSENCIAL' | 'AVANÇADO' | 'PRO' | 'ENTERPRISE'
  name: string
  price: number
  credits: number
  photos: number
  popular: boolean
}

const creditPackages: CreditPackage[] = [
  {
    id: 'ESSENCIAL',
    name: 'Pacote Essencial',
    price: 89,
    credits: 350,
    photos: 35,
    popular: false
  },
  {
    id: 'AVANÇADO',
    name: 'Pacote Avançado',
    price: 179,
    credits: 1000,
    photos: 100,
    popular: true
  },
  {
    id: 'PRO',
    name: 'Pacote Pro',
    price: 359,
    credits: 2200,
    photos: 220,
    popular: false
  },
  {
    id: 'ENTERPRISE',
    name: 'Pacote Enterprise',
    price: 899,
    credits: 5000,
    photos: 500,
    popular: false
  }
]

interface Plan {
  id: 'STARTER' | 'PREMIUM' | 'GOLD'
  name: string
  monthlyPrice: number
  annualPrice: number
  monthlyEquivalent: number
  description: string
  features: string[]
  popular: boolean
  color: 'blue' | 'purple' | 'yellow'
  credits: number
}

const plans: Plan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    monthlyPrice: 89,
    annualPrice: 708,
    monthlyEquivalent: 59,
    description: 'Perfeito para começar sua jornada com IA',
    features: [
      '1 modelo de IA',
      '500 créditos/mês',
      '50 fotos por mês',
      'Máxima resolução'
    ],
    popular: false,
    color: 'blue',
    credits: 500
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    monthlyPrice: 179,
    annualPrice: 1428,
    monthlyEquivalent: 119,
    description: 'Ideal para criadores de conteúdo',
    features: [
      '1 modelo de IA',
      '1.200 créditos/mês',
      '120 fotos por mês',
      'Máxima resolução'
    ],
    popular: true,
    color: 'purple',
    credits: 1200
  },
  {
    id: 'GOLD',
    name: 'Gold',
    monthlyPrice: 359,
    annualPrice: 2868,
    monthlyEquivalent: 239,
    description: 'Para profissionais e agências',
    features: [
      '1 modelo de IA',
      '2.500 créditos/mês',
      '250 fotos por mês',
      'Máxima resolução'
    ],
    popular: false,
    color: 'yellow',
    credits: 2500
  }
]

// Dados do carrossel de estilos
const carouselStyles = [
  {
    id: 'executive',
    title: 'Executive Minimalist',
    description: 'Professional headshots with clean, sophisticated aesthetics',
    image: '/examples/card-executive-minimalista.jpg',
    prompt: 'Homem elegante de terno preto e camisa branca, posando com confiança diante de uma janela com vista para a cidade ao entardecer.'
  },
  {
    id: 'fitness',
    title: 'Fitness Aesthetic',
    description: 'Athletic portraits with dynamic energy and motivation',
    image: '/examples/business-presentation.jpg',
    prompt: 'Mulher atlética em conjunto fitness branco e boné vinho, alongando-se em uma pedra à beira-mar ao amanhecer, com tênis amarelo chamativo.'
  },
  {
    id: 'luxury',
    title: 'Quiet Luxury',
    description: 'Elegant portraits with subtle luxury and refinement',
    image: '/examples/professional-woman.jpg',
    prompt: 'Mulher loira com cabelo solto ao vento, usando suéter bege e lenço de seda amarelo com estampa floral no pescoço, em deck de madeira à beira-mar com céu nublado e mar agitado.'
  },
  {
    id: 'mirror',
    title: 'Mirror Selfie',
    description: 'Authentic casual moments with trendy styling',
    image: '/examples/mirror-selfie.jpg',
    prompt: 'Jovem estiloso tirando selfie no espelho de um elevador metálico, vestindo camisa social larga e calça de alfaiataria cinza.'
  },
  {
    id: 'wanderlust',
    title: 'Wanderlust',
    description: 'Adventure portraits in exotic, inspiring locations',
    image: '/examples/desert-adventure.png',
    prompt: 'Mulher sentada de perna cruzada, usando um vestido listrado de linho bege, tomando vinho tinto em taça grande, num pátio europeu com chão de tijolos, plantas trepadeiras e mesas de ferro coloridas ao fundo.'
  },
  {
      id: 'urban',
    title: 'Urban',
    description: 'Contemporary city life with street style edge',
    image: '/examples/urban-style.jpg',
    prompt: 'Mulher de cabelos longos soltos, usando camiseta verde de mangas longas, jeans largos e óculos escuros, andando pela rua segurando copo de café, vista aérea urbana com linhas marcantes.'
  },
  {
    id: 'rebel',
    title: 'Rebel',
    description: 'Bold, edgy portraits with alternative fashion',
    image: '/examples/rebel-style.jpg',
    prompt: 'Jovem magro com cabelo bagunçado e óculos escuros grandes, usando camiseta cropped branca com estampa de sereia rosa, jeans preto desgastado e cinto cravejado de metal, cigarro na boca, posando com olhar desafiador em fundo urbano decadente.'
  },
  {
    id: 'casual',
    title: 'Neo Casual',
    description: 'Modern casual style with contemporary appeal',
    image: '/examples/neo-casual.jpg',
    prompt: 'Homem descalço usando roupa de linho bege, iluminado pelo sol dourado, em ambiente minimalista com vegetação tropical ao fundo.'
  }
]

// Individual card component for scroll stacking
const ScrollStackingCard = ({ step, index, scrollYProgress, totalSteps }: {
  step: { id: number; title: string; description: string; gradient: string; borderColor: string; iconBg: string }
  index: number
  scrollYProgress: any
  totalSteps: number
}) => {
  // Efeito de stacking progressivo vertical
  // Cada card sobe e "para" momentaneamente antes do próximo aparecer
  // Cards posicionados um abaixo do outro, sem sobreposição

  const cardHeight = 160 // Altura de cada card (incluindo espaçamento)
  const cardSpacing = 32 // Espaçamento entre cards
  const totalCardHeight = cardHeight + cardSpacing

  // Progresso de cada card baseado no scroll
  // Cada card ocupa 1/3 do progresso total da seção
  const cardStart = index / totalSteps // 0, 0.33, 0.66
  const cardEnd = (index + 1) / totalSteps // 0.33, 0.66, 1.0
  const cardMidPoint = (cardStart + cardEnd) / 2 // Ponto médio para pausar

  // Posição Y inicial (fora da tela, abaixo)
  const initialY = 400
  // Posição Y final (posição vertical sequencial)
  const finalY = index * totalCardHeight

  // Animação de entrada: card sobe de baixo para cima
  // Pausa momentânea no ponto médio antes de finalizar a posição
  // Criando zonas de "pausa" mais visíveis com múltiplos pontos de controle
  const pauseStart = cardStart + (cardMidPoint - cardStart) * 0.7 // 70% do caminho até o meio
  const pauseEnd = cardMidPoint + (cardEnd - cardMidPoint) * 0.3 // 30% após o meio
  
  const y = useTransform(scrollYProgress, 
    [cardStart, pauseStart, cardMidPoint, pauseEnd, cardEnd],
    [initialY, initialY * 0.5, finalY, finalY, finalY]
  )

  // Opacity: aparece suavemente quando começa a subir
  const opacity = useTransform(scrollYProgress,
    [cardStart, cardStart + 0.1, cardEnd],
    [0, 1, 1]
  )

  // Scale: começa pequeno e cresce suavemente
  const scale = useTransform(scrollYProgress,
    [cardStart, cardStart + 0.1, cardEnd],
    [0.95, 1, 1]
  )

  return (
    <motion.div
      style={{
        y,
        opacity,
        scale,
        willChange: 'transform'
      }}
      className="absolute inset-x-0"
    >
      <div 
        className="h-[160px] bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300"
        style={{ willChange: 'transform' }}
      >
        <div className="p-6 h-full flex items-center">
          <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center mr-5 flex-shrink-0 shadow-inner">
            <span className="text-white font-light text-sm opacity-70">{step.id}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-wide drop-shadow-sm">{step.title}</h3>
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed font-medium">
              {step.description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Components for scroll stacking effect - Progressivo vertical
const ScrollStackingCards = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  const steps = [
    {
      id: 1,
      title: "Upload das Fotos",
      description: "Carregue 15-30 fotos suas em diferentes poses. Nossa IA analisará seus traços únicos para criar seu modelo personalizado.",
      gradient: "from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
      iconBg: "from-blue-500 to-blue-600"
    },
    {
      id: 2,
      title: "Treinamento de Modelo",
      description: "Nossa IA treina um modelo personalizado baseado nas suas fotos em alguns minutos. Processo 100% automático.",
      gradient: "from-purple-50 to-purple-100",
      borderColor: "border-purple-200",
      iconBg: "from-purple-500 to-purple-600"
    },
    {
      id: 3,
      title: "Gerar Fotos",
      description: "Digite qualquer cenário e sua IA criará fotos profissionais realistas. Infinitas possibilidades na palma da sua mão.",
      gradient: "from-indigo-50 to-indigo-100",
      borderColor: "border-indigo-200",
      iconBg: "from-indigo-500 to-indigo-600"
    }
  ]

  // Altura total dos cards (incluindo espaçamento)
  const cardHeight = 160
  const cardSpacing = 32
  const totalHeight = steps.length * (cardHeight + cardSpacing)

  return (
    <div 
      ref={containerRef} 
      className="relative"
      style={{ 
        height: `${totalHeight}px`,
        willChange: 'transform'
      }}
    >
      {steps.map((step, index) => (
        <ScrollStackingCard
          key={step.id}
          step={step}
          index={index}
          scrollYProgress={scrollYProgress}
          totalSteps={steps.length}
        />
      ))}
    </div>
  )
}

// Individual mobile card component
const MobileStackingCard = ({ step, index }: {
  step: { id: number; title: string; description: string; gradient: string; borderColor: string; iconBg: string }
  index: number
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-10%" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      style={{ scrollSnapAlign: 'start' }}
      className="min-h-[300px] flex items-center mb-12"
    >
      <div className="w-full bg-gray-200 border border-gray-300 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 transform-gpu hover:rotate-1 hover:scale-[1.03] backdrop-blur-sm">
        <div className="p-8">
          <div className="w-16 h-16 bg-gray-900 rounded-xl flex items-center justify-center mb-6 shadow-inner">
            <span className="text-white font-light text-xl opacity-70">{step.id}</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4 tracking-wide drop-shadow-sm">{step.title}</h3>
          <p className="text-gray-700 leading-relaxed font-medium text-base">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

const MobileStackingCards = () => {
  const steps = [
    {
      id: 1,
      title: "Upload das Fotos",
      description: "Carregue 10-20 fotos suas em diferentes poses. Nossa IA analisará seus traços únicos para criar seu modelo personalizado.",
      gradient: "from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
      iconBg: "from-blue-500 to-blue-600"
    },
    {
      id: 2,
      title: "Treinamento de Modelo",
      description: "Nossa IA treina um modelo personalizado baseado nas suas fotos em alguns minutos. Processo 100% automático.",
      gradient: "from-purple-50 to-purple-100",
      borderColor: "border-purple-200",
      iconBg: "from-purple-500 to-purple-600"
    },
    {
      id: 3,
      title: "Gerar Fotos",
      description: "Digite qualquer cenário e sua IA criará fotos profissionais realistas. Infinitas possibilidades na palma da sua mão.",
      gradient: "from-indigo-50 to-indigo-100",
      borderColor: "border-indigo-200",
      iconBg: "from-indigo-500 to-indigo-600"
    }
  ]

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <MobileStackingCard key={step.id} step={step} index={index} />
      ))}
    </div>
  )
}

// Infinite Marquee Carousel Component
interface MarqueeItem {
  id: string
  title: string
  description: string
  image: string
  prompt: string
}

interface MarqueeCarouselProps {
  items: MarqueeItem[]
  hoveredIndex: number | null
  onHoverChange: (index: number | null) => void
  onImageClick: (image: { src: string; alt: string; title: string }) => void
}

const MarqueeCarousel = ({ items, hoveredIndex, onHoverChange, onImageClick }: MarqueeCarouselProps) => {
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const translateXRef = useRef(0)

  // Check mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Duplicate items multiple times for seamless loop
  const duplicatedItems = [...items, ...items, ...items]

  useEffect(() => {
    if (isPaused || isMobile) {
      // Apply smooth transition when pausing
      if (marqueeRef.current) {
        marqueeRef.current.style.transition = 'transform 0.3s ease-in-out'
      }
      return
    }

    // Reset transition when resuming animation
    if (marqueeRef.current) {
      marqueeRef.current.style.transition = 'none'
    }

    const animate = () => {
      if (!marqueeRef.current) return
      
      translateXRef.current -= 0.75 // Velocidade de scroll (ajustável)
      
      // Reset position when one set of items has scrolled completely
      // Calculate dynamically based on actual card width
      const cardElement = marqueeRef.current?.firstElementChild as HTMLElement
      if (cardElement) {
        const cardWidth = cardElement.offsetWidth || 320 // Fallback para w-80
        const gap = 24 // gap-6 = 24px
        const totalWidth = items.length * (cardWidth + gap)
        
        // Reset smoothly when reaching the end of one set
        if (Math.abs(translateXRef.current) >= totalWidth) {
          translateXRef.current = translateXRef.current + totalWidth
        }
      }
      
      if (marqueeRef.current) {
        marqueeRef.current.style.transform = `translate3d(${translateXRef.current}px, 0, 0)`
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPaused, isMobile, items.length])

  const handleMouseEnter = (index: number) => {
    setIsPaused(true)
    onHoverChange(index)
  }

  const handleMouseLeave = () => {
    // Delay resumo para suavizar a transição
    setTimeout(() => {
      setIsPaused(false)
    }, 100)
    onHoverChange(null)
  }

  return (
    <div
      className="relative w-full overflow-x-hidden"
      onMouseEnter={() => !isMobile && setIsPaused(true)}
      onMouseLeave={() => {
        if (!isMobile) {
          setTimeout(() => setIsPaused(false), 100)
        }
      }}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => {
        setTimeout(() => setIsPaused(false), 300)
      }}
      style={{ willChange: 'transform' }}
    >
      <div
        ref={marqueeRef}
        className={`flex gap-6 will-change-transform ${isMobile ? 'overflow-x-auto snap-x snap-mandatory pb-4 px-4' : 'px-2 md:px-4'}`}
        style={{
          transform: isMobile ? 'none' : `translate3d(${translateXRef.current}px, 0, 0)`,
          scrollBehavior: isMobile ? 'smooth' : 'auto',
          WebkitOverflowScrolling: isMobile ? 'touch' : 'auto',
        }}
      >
        {duplicatedItems.map((item, index) => {
          const originalIndex = index % items.length
          const isHovered = hoveredIndex !== null && 
            (originalIndex === hoveredIndex)
          const shouldBlur = hoveredIndex !== null && 
            !isHovered && 
            (originalIndex !== hoveredIndex)

          return (
            <div
              key={`${item.id}-${index}`}
              className={`flex-shrink-0 ${isMobile ? 'w-72 snap-center' : 'w-80'} h-auto`}
              onMouseEnter={() => !isMobile && handleMouseEnter(originalIndex)}
              onMouseLeave={handleMouseLeave}
              onFocus={() => !isMobile && handleMouseEnter(originalIndex)}
              onBlur={handleMouseLeave}
              style={{ willChange: 'transform, filter, opacity' }}
            >
              <div
                className={`bg-black rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-500 group cursor-pointer relative ${
                  shouldBlur ? 'blur-sm opacity-60' : ''
                }`}
                onClick={() => onImageClick({
                  src: item.image,
                  alt: item.title,
                  title: item.title
                })}
              >
                <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
                  {/* Background Image */}
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="320px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    style={{ willChange: 'transform' }}
                  />

                  {/* Gradient Overlay - only show on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Prompt Overlay - Bottom - only show on hover */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 p-6 text-white transition-all duration-300 ${
                      isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  >
                    <div className="text-sm font-medium tracking-wide uppercase text-gray-300 mb-3">
                      PROMPT
                    </div>
                    <p className="text-sm leading-relaxed text-gray-100 line-clamp-4">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// AI Tools Showcase Component
const AIToolsShowcase = () => {
  const [activeTab, setActiveTab] = useState<'upscale' | 'editor' | 'video'>('upscale')
  const [selectedExample, setSelectedExample] = useState(0)

  const toolsData = {
    upscale: {
      title: "Upscale",
      description: "Ampliação inteligente, resultado impecável.",
      type: "comparison",
      beforeImage: "/examples/tools/upscale-before.jpg",
      afterImage: "/examples/tools/upscale-after.jpg",
      examples: [
        { thumb: "/examples/tools/upscale-thumb-1.jpg", before: "/examples/tools/upscale-before.jpg", after: "/examples/tools/upscale-after.jpg", label: "Retrato" },
        { thumb: "/examples/tools/upscale-thumb-2.jpg", before: "/examples/tools/upscale-before-2.jpg", after: "/examples/tools/upscale-after-2.jpg", label: "Paisagem" }
      ]
    },
    editor: {
      title: "Editor",
      description: "Modifique, adicione, remova e combine fotos como quiser — liberdade criativa absoluta.",
      type: "sidebyside",
      beforeImage: "/examples/tools/editor-after-1.jpg",
      afterImage: "/examples/tools/editor-after-2.jpg",
      examples: [
        {
          thumb: "/examples/tools/editor-example-1.jpg",
          before: "/examples/tools/editor-example-2.jpg",
          after: "/examples/tools/editor-example-1.jpg",
          label: "Exemplo 1",
          prompt: "Retire os óculos."
        },
        {
          thumb: "/examples/tools/editor-example-2.jpg",
          before: "/examples/tools/editor-example-2.jpg",
          after: "/examples/tools/editor-example-1.jpg",
          label: "Exemplo 2",
          prompt: "Coloque os óculos escuros e troque o terno por uma polo bege com golas levantadas."
        }
      ]
    },
    video: {
      title: "Vídeos",
      description: "Transforme fotos ou ideias em vídeos realistas com poucos cliques",
      type: "video",
      videoSrc: "/examples/tools/video-optimized.mp4",
      poster: "/examples/tools/video-poster.jpg",
      examples: [
        { thumb: "/examples/tools/video-thumb-1.jpg", video: "/examples/tools/video-optimized.mp4", label: "Animação facial" },
        { thumb: "/examples/tools/video-thumb-2.jpg", video: "/examples/tools/video-optimized.mp4", label: "Movimento de cabelo" }
      ]
    }
  }

  const currentTool = toolsData[activeTab]
  const currentExample = currentTool.examples[selectedExample]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
          Criatividade sem limites
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-50 p-0.5 rounded-lg border border-gray-200 flex w-full max-w-md">
          {Object.keys(toolsData).map((tool) => (
            <button
              key={tool}
              onClick={() => {
                setActiveTab(tool as 'upscale' | 'editor' | 'video')
                setSelectedExample(0)
              }}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tool
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {toolsData[tool as keyof typeof toolsData].title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Showcase */}
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Main Content */}
        <div className="bg-gray-100 rounded-2xl p-0 relative overflow-hidden">
          {/* Upscale: Comparison Slider */}
          {currentTool.type === 'comparison' && (
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-200 group/slider">
              <div className="absolute inset-0">
                <Image
                  src={currentExample?.before || currentTool.beforeImage}
                  alt="Antes"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
                  className="object-cover"
                  style={{ objectPosition: 'center top' }}
                />
                <div
                  className="absolute inset-0 transition-all duration-300 ease-out"
                  style={{
                    clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)'
                  }}
                >
                  <Image
                    src={currentExample?.after || currentTool.afterImage}
                    alt="Depois"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
                    className="object-cover"
                    style={{ objectPosition: 'center top' }}
                  />
                </div>
              </div>

              {/* Slider Control */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white shadow-lg transform -translate-x-0.5 cursor-ew-resize group-hover/slider:bg-blue-400 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const container = e.currentTarget.parentElement
                  const slider = e.currentTarget
                  const rect = container?.getBoundingClientRect()

                  if (!rect || !container || !slider) return

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const x = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
                    const percentage = x * 100

                    const afterImage = container.querySelector('[style*="clip-path"]') as HTMLElement
                    if (afterImage) {
                      afterImage.style.clipPath = `polygon(${percentage}% 0, 100% 0, 100% 100%, ${percentage}% 100%)`
                    }
                    slider.style.left = `${percentage}%`
                  }

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                  }

                  document.body.style.cursor = 'ew-resize'
                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white/40 transition-colors border border-white/30">
                  <div className="w-1 h-5 bg-white rounded hover:bg-blue-400 transition-colors"></div>
                </div>
              </div>

            </div>
          )}

          {/* Editor: Single Image */}
          {currentTool.type === 'single' && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-gray-200 relative">
              <img
                src="/examples/tools/editor-after.jpg"
                alt="Resultado editado"
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center top' }}
                onError={(e) => {
                  e.currentTarget.src = '/examples/professional-woman.jpg'
                }}
              />

              {/* Prompt Overlay */}
              <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg max-w-xs">
                <p className="text-xs font-light leading-relaxed">
                  "Coloque os óculos escuros e troque o terno por uma polo bege com golas levantadas."
                </p>
              </div>
            </div>
          )}

          {/* Editor: Side by Side */}
          {currentTool.type === 'sidebyside' && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-gray-200 relative">
              <div className="flex h-full">
                <div className="relative flex-1">
                  <img
                    src={currentTool.beforeImage}
                    alt="Antes"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center top' }}
                    onError={(e) => {
                      e.currentTarget.src = '/examples/professional-woman.jpg'
                    }}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg max-w-xs">
                    <p className="text-xs font-light leading-relaxed">
                      Prompt: Coloque os óculos escuros e troque o terno por uma polo bege com gola alta.
                    </p>
                  </div>
                </div>
                <div className="w-0.5 bg-white shadow-lg"></div>
                <div className="relative flex-1">
                  <img
                    src={currentTool.afterImage}
                    alt="Depois"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center top' }}
                    onError={(e) => {
                      e.currentTarget.src = '/examples/card-artisticas-conceituais.jpg'
                    }}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg max-w-xs">
                    <p className="text-xs font-light leading-relaxed">
                      Prompt: Retire os óculos.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Video: Player */}
          {currentTool.type === 'video' && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black">
              <video
                key={currentExample?.video || currentTool.videoSrc}
                className="w-full h-full object-contain"
                style={{ objectPosition: 'center' }}
                controls
                poster={currentTool.poster}
                preload="metadata"
                onError={(e) => {
                  e.currentTarget.poster = '/examples/professional-woman.jpg'
                }}
              >
                <source src={currentExample?.video || currentTool.videoSrc} type="video/mp4" />
                Seu navegador não suporta reprodução de vídeo.
              </video>
            </div>
          )}
        </div>

        {/* Bottom Section: Thumbnails + Text */}
        <div className="flex gap-6 items-start">
          {/* Example Thumbnails - Only for Editor */}
          {activeTab === 'editor' && (
            <div className="flex gap-3">
              {currentTool.examples.map((example, index) => (
                <div
                  key={index}
                  className="relative aspect-square w-24 md:w-32 rounded-lg overflow-hidden shadow-md"
                >
                  <img
                    src={example.thumb}
                    alt={example.label}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/examples/professional-woman.jpg'
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Text Description */}
          <div className="flex-1">
            <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
              <p className="text-gray-900 text-lg leading-relaxed font-medium tracking-wide">
                {currentTool.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PREMIUM' | 'GOLD'>('PREMIUM')
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string, title: string} | null>(null)
  const [activeToolModal, setActiveToolModal] = useState<'upscale' | 'editor' | 'video' | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<'ESSENCIAL' | 'AVANÇADO' | 'PRO' | 'ENTERPRISE'>('AVANÇADO')
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const [hoveredSlideIndex, setHoveredSlideIndex] = useState<number | null>(null)
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Carrossel auto-play
  useEffect(() => {
    if (!isCarouselPaused && mounted && status !== 'loading') {
      const interval = setInterval(() => {
        setCurrentCarouselIndex((prev) => (prev + 1) % carouselStyles.length)
      }, 4000)
      return () => clearInterval(interval)
    }
  }, [isCarouselPaused, mounted, status])

  const nextSlide = () => {
    setCurrentCarouselIndex((prev) => (prev + 1) % carouselStyles.length)
  }

  const prevSlide = () => {
    setCurrentCarouselIndex((prev) => (prev - 1 + carouselStyles.length) % carouselStyles.length)
  }

  const goToSlide = (index: number) => {
    setCurrentCarouselIndex(index)
  }

  // Touch/Swipe functionality for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) {
      nextSlide()
    } else if (isRightSwipe) {
      prevSlide()
    }
  }
  
  const handlePackageSelect = (packageId: 'ESSENCIAL' | 'AVANÇADO' | 'PRO' | 'ENTERPRISE') => {
    setSelectedPackage(packageId)
    if (!session?.user) {
      window.location.href = '/auth/signup'
    } else {
      window.location.href = `/billing/upgrade?package=${packageId}&type=credits`
    }
  }

  const handlePlanSelect = (planId: 'STARTER' | 'PREMIUM' | 'GOLD') => {
    setSelectedPlan(planId)
    if (!session?.user) {
      window.location.href = '/auth/signup'
    } else {
      window.location.href = `/billing/upgrade?plan=${planId}&cycle=${billingCycle}`
    }
  }

  // Show loading skeleton during session check to prevent FOUC (Sprint 1 - Fix FOUC definitivo)
  // Renderizado condicionalmente no JSX para evitar React error #310
  if (status === 'loading' || !mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      {!session ? (
        <section className="relative h-screen w-full overflow-hidden" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(/hero-background.jpg)'
            }}
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-45" />

          {/* Content */}
          <div className="relative z-10 h-full flex items-center justify-center px-6">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 leading-tight tracking-tight">
                Retratos que parecem <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">arte</span>.
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                Com IA, você cria imagens únicas, sofisticadas e feitas sob medida.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center w-full sm:w-auto px-4 sm:px-0">
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-black hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium rounded-lg border-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto sm:min-w-[180px]"
                >
                  <Link href="/auth/signup">
                    Começar Agora
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white text-white bg-transparent hover:bg-white hover:text-black px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium rounded-lg backdrop-blur-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200 w-full sm:w-auto sm:min-w-[180px]"
                  onClick={() => {
                    const gallerySection = document.querySelector('#gallery-section');
                    if (gallerySection) {
                      gallerySection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  Ver Exemplos
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative px-6 text-center py-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Olá, {session.user?.name || 'Usuário'}!
            </h1>

            <p className="text-lg text-gray-600">
              Continue criando fotos incríveis com IA.
            </p>
          </div>
        </section>
      )}

      {/* How it Works Section - Scroll Stacking Progressivo */}
      {!session && (
        <section
          className="relative bg-white"
          style={{
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
          }}
        >
          {/* Desktop Layout */}
          <div className="hidden lg:block">
            {/* Container com scroll progressivo - altura suficiente para animação completa */}
            {/* Altura 300vh permite scroll suave e pausas momentâneas em cada card */}
            <div className="h-[300vh] relative" style={{ willChange: 'transform' }}>
              <div className="sticky top-0 h-screen flex items-center">
                <div className="max-w-7xl mx-auto px-6 w-full">
                  <div className="grid grid-cols-2 gap-16 items-center">
                    {/* Left Side - Fixed Title */}
                    <div className="space-y-6">
                      <motion.h2
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight"
                      >
                        Sua melhor versão não está na câmera.
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-xl text-gray-600 max-w-lg"
                      >
                        Você em 3 passos. Incrivelmente simples.
                      </motion.p>
                    </div>

                    {/* Right Side - Stacking Cards Progressivo */}
                    <div className="relative flex items-center justify-center" style={{ minHeight: '600px' }}>
                      <ScrollStackingCards />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden" style={{ scrollSnapType: 'y mandatory' }}>
            <div className="min-h-screen py-20 px-6" style={{ scrollSnapAlign: 'start' }}>
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
                    Sua melhor versão não está na câmera.
                  </h2>
                  <p className="text-lg text-gray-600">
                    Você em 3 passos. Inesquecível.
                  </p>
                </div>

                <MobileStackingCards />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      {!session && (
        <section className="py-20 bg-white overflow-hidden" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          {/* Coverflow Carousel Section */}
          <div id="gallery-section" className="py-20 w-full">
            <div className="text-center mb-16 px-4 md:px-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Explore toda sua imaginação</h2>
            </div>

            {/* Infinite Marquee Carousel - Full Width */}
            <div className="relative w-full -mx-0">
              <MarqueeCarousel
                items={carouselStyles}
                hoveredIndex={hoveredSlideIndex}
                onHoverChange={setHoveredSlideIndex}
                onImageClick={setSelectedImage}
              />
            </div>
          </div>
        </section>
      )}

      {/* Criatividade sem Limites Section */}
      {!session && (
        <section className="py-20 px-6 bg-white" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="max-w-7xl mx-auto">
            {/* Tool Showcase */}
            <AIToolsShowcase />
          </div>
        </section>
      )}

      {/* Photography Reinvented Section */}
      {!session && (
        <section className="py-24 px-6 bg-slate-800" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-left mb-20">
              <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
                A fotografia, reinventada.
              </h2>
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-12 items-center">
              {/* Left Side - Small Cards Grid 2x2 */}
              <div className="lg:col-span-2 order-1 lg:order-1">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto lg:max-w-none">
                  {/* Original Photos */}
                  <div className="aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 transform-gpu relative">
                    <Image
                      src="/examples/transformation/before-1.jpg"
                      alt="Foto original"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 transform-gpu relative">
                    <Image
                      src="/examples/transformation/before-2.jpg"
                      alt="Foto original"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 transform-gpu relative">
                    <Image
                      src="/examples/transformation/before-3.jpg"
                      alt="Foto original"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 transform-gpu relative">
                    <Image
                      src="/examples/transformation/before-4.jpg"
                      alt="Foto original"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side - Large AI Result Card */}
              <div className="lg:col-span-3 order-2 lg:order-2">
                <div className="relative group">
                  <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-500 transform-gpu bg-white relative">
                    <Image
                      src="/examples/transformation/after-3.jpg"
                      alt="Resultado gerado por IA"
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 600px"
                      quality={95}
                      className="object-cover group-hover:scale-105 transition-transform duration-700 cursor-pointer"
                      onClick={() => setSelectedImage({
                        src: "/examples/transformation/after-3.jpg",
                        alt: "Resultado gerado por IA",
                        title: "Gerado por IA"
                      })}
                    />

                    {/* AI Badge */}
                    <div className="absolute top-6 right-6 bg-black bg-opacity-80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                      <span>Gerado por IA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center mt-20">
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium rounded-lg border-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[160px] sm:min-w-[180px]"
              >
                <Link href="/auth/signup">
                  Começar Agora
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Pricing Table Section */}
      {!session && (
        <section className="py-20 px-6 bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-12 tracking-tight">Planos</h2>

              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className="bg-gray-50 p-0.5 rounded-lg border border-gray-200 flex w-full max-w-xs">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
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
                  >
                    Anual
                    {billingCycle === 'annual' && (
                      <span className="absolute -top-2.5 -right-2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-sm whitespace-nowrap">
                        4 meses grátis
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
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
                    <CardTitle className="text-3xl font-bold text-gray-900 mb-6">{plan.name}</CardTitle>
                    <div className="mb-6">
                      {billingCycle === 'annual' ? (
                        <>
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            R$ {plan.annualPrice}
                            <span className="text-base font-normal text-gray-500">/ano</span>
                          </div>
                          <div className="text-sm text-gray-600 font-medium">
                            R$ {plan.monthlyEquivalent}/mês
                          </div>
                        </>
                      ) : (
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          R$ {plan.monthlyPrice}
                          <span className="text-base font-normal text-gray-500">/mês</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, index) => {
                        // Adjust credits display based on billing cycle
                        let displayFeature = feature
                        if (billingCycle === 'annual' && feature.includes('créditos/mês')) {
                          const yearlyCredits = plan.credits * 12
                          displayFeature = feature.replace(/\d+\.?\d*\s*créditos\/mês/, `${yearlyCredits.toLocaleString('pt-BR')} créditos/ano`)
                        }

                        return (
                        <li key={index} className="flex items-center text-sm">
                          <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                            <Check className="w-3 h-3 text-gray-600" />
                          </div>
                          <span className="text-gray-700 flex items-center">
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

            {/* Subscription Cancellation Notice - Moved below tables */}
            <div className="flex items-center justify-center mt-8 mb-8">
              <div className="flex items-center text-center">
                <Check className="w-4 h-4 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">
                  Cancele a qualquer momento
                </span>
              </div>
            </div>

            {/* Credit Information Section */}
            <div className="mt-20">
              <div className="text-center max-w-4xl mx-auto">
                <div className="bg-gray-100 rounded-xl p-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Acabaram os créditos?
                  </h3>
                  <p className="text-lg text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
                    Se seus créditos acabarem antes da renovação do plano, você pode comprar <strong>pacotes de créditos avulsos</strong> com pagamento único, sem recorrência e válidos por <strong>1 ano</strong>.
                  </p>
                  <div className="flex items-center justify-center">
                    <Check className="w-5 h-5 text-gray-600 mr-3" />
                    <span className="text-gray-600 font-medium">
                      Continue criando sem interrupções
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* Hero Image Section */}
      {!session && (
        <section className="bg-white">
          <div className="relative group">
            <div className="relative overflow-hidden" style={{ aspectRatio: '2.5/1' }}>
              <Image
                src="/examples/hero/hero-image.jpg"
                alt="Transforme suas fotos com IA - Exemplo profissional"
                fill
                priority
                sizes="100vw"
                quality={95}
                className="object-cover group-hover:scale-105 transition-all duration-700 ease-out"
              />

              {/* Subtle Light Sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 -translate-x-full group-hover:translate-x-full transition-transform duration-1200 ease-out"></div>
            </div>
          </div>
        </section>
      )}

      {session ? (
        /* User Options Section - Interactive Pitch */
        <section className="py-16 px-6 bg-gray-900" style={{ fontFamily: '-apple-system, "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Transforme suas ideias em realidade</h2>
              <p className="text-gray-400 text-sm">Comece criando um modelo personalizado e depois gere fotos incríveis</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Modelo de IA */}
              <Card className="group border border-gray-700 bg-gray-800 hover:shadow-xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-semibold text-white mb-2">1️⃣ Modelo de IA</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Acesse a página <strong className="text-white">Modelos</strong> e clique em <strong className="text-white">Criar modelo</strong> para treinar sua IA personalizada.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white">
                    <Link href="/models/create">Criar Modelo</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Imagem com IA */}
              <Card className="group border border-gray-700 bg-gray-800 hover:shadow-xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-semibold text-white mb-2">2️⃣ Imagem com IA</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Depois, vá em <strong className="text-white">Gerar imagem</strong> e escolha o estilo que quiser.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white">
                    <Link href="/generate">Gerar Fotos</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Edição de Imagem com IA */}
              <Card className="group border border-gray-700 bg-gray-800 hover:shadow-xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-semibold text-white mb-2">3️⃣ Editor de Imagem</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Quer ajustar uma criação? Vá em <strong className="text-white">Editor de Imagem</strong> e refine os detalhes.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white">
                    <Link href="/editor">Editar Fotos</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Vídeo com IA */}
              <Card className="group border border-gray-700 bg-gray-800 hover:shadow-xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-semibold text-white mb-2">4️⃣ Vídeo com IA</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Experimente gerar <strong className="text-white">vídeos realistas</strong> a partir das suas fotos.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white">
                    <Link href="/generate?tab=video">Gerar Vídeos</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                E se quiser mais estilos, explore nossos <Link href="/packages" className="text-blue-400 hover:text-blue-300 underline">Pacotes de Fotos e Créditos</Link>.
              </p>
            </div>
          </div>
        </section>
      ) : (
        /* Email CTA for Non-Logged Users */
        <section className="py-16 px-6 bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg text-gray-600 mb-8">
              Digite seu email para começar sua jornada com IA
            </p>
            <div className="max-w-md mx-auto">
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  const email = (e.target as HTMLFormElement).email.value
                  if (email) {
                    window.location.href = `/auth/signup?email=${encodeURIComponent(email)}`
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Seu melhor email"
                  required
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] hover:to-[#6a4190] text-white px-8 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Começar
                </Button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-full w-full h-full flex items-center justify-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full backdrop-blur-sm transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Tools Modal */}
      {activeToolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setActiveToolModal(null)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">
                  {activeToolModal === 'upscale' && 'Upscale IA - Demonstração'}
                  {activeToolModal === 'editor' && 'Editor IA - Demonstração'}
                  {activeToolModal === 'video' && 'Vídeos IA - Demonstração'}
                </h2>
                <button
                  onClick={() => setActiveToolModal(null)}
                  className="p-2 hover:bg-white bg-opacity-20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {activeToolModal === 'upscale' && (
                <div className="space-y-6">
                  <p className="text-gray-600 text-center text-lg">
                    Arraste a linha divisória para comparar a qualidade antes e depois do upscale
                  </p>

                  {/* Upscale Slider Grande */}
                  <div className="relative aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden shadow-xl bg-gray-200 group/modal-slider">
                    <div className="absolute inset-0">
                      <img
                        src="/examples/tools/upscale-before.jpg"
                        alt="Antes do upscale"
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '/examples/professional-woman.jpg';
                        }}
                      />
                      <div
                        className="absolute inset-0 transition-all duration-300 ease-out"
                        style={{
                          clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)'
                        }}
                      >
                        <img
                          src="/examples/tools/upscale-after.jpg"
                          alt="Depois do upscale"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.src = '/examples/card-fotos-profissionais.jpg';
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="absolute left-1/2 top-0 bottom-0 w-1 bg-white shadow-lg transform -translate-x-0.5 cursor-ew-resize group-hover/modal-slider:bg-blue-400 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const container = e.currentTarget.parentElement;
                        const slider = e.currentTarget;
                        const rect = container.getBoundingClientRect();

                        const handleMouseMove = (moveEvent) => {
                          const x = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                          const percentage = x * 100;

                          const afterImage = container.querySelector('[style*="clip-path"]');
                          if (afterImage) {
                            afterImage.style.clipPath = `polygon(${percentage}% 0, 100% 0, 100% 100%, ${percentage}% 100%)`;
                          }

                          if (slider) {
                            slider.style.left = `${percentage}%`;
                          }
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                          document.body.style.cursor = '';
                          document.body.style.userSelect = '';
                        };

                        document.body.style.cursor = 'ew-resize';
                        document.body.style.userSelect = 'none';
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center group-hover/modal-slider:bg-blue-50 transition-colors border-2 border-gray-200">
                        <div className="w-2 h-8 bg-gray-400 rounded group-hover/modal-slider:bg-blue-500"></div>
                      </div>
                    </div>

                    <div className="absolute top-6 left-6 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-base font-medium">
                      Antes
                    </div>
                    <div className="absolute top-6 right-6 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-base font-medium">
                      Depois
                    </div>
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-base font-medium opacity-0 group-hover/modal-slider:opacity-100 transition-opacity">
                      Arraste para comparar
                    </div>
                  </div>

                  <div className="text-center">
                    <Link href="/upscale">
                      <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-10">
                        Experimentar Upscale
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {activeToolModal === 'editor' && (
                <div className="space-y-6">
                  <p className="text-gray-600 text-center text-lg">
                    Veja o poder do nosso editor IA com comparação lado a lado
                  </p>

                  {/* Editor Comparison Grande */}
                  <div className="aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden shadow-xl bg-gray-200">
                    <div className="flex h-full">
                      <div className="relative flex-1">
                        <img
                          src="/examples/tools/editor-before.jpg"
                          alt="Antes da edição IA"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/examples/professional-woman.jpg';
                          }}
                        />
                        <div className="absolute top-6 left-6 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-base font-medium">
                          Antes
                        </div>
                      </div>
                      <div className="w-1 bg-white shadow-lg"></div>
                      <div className="relative flex-1">
                        <img
                          src="/examples/tools/editor-after.jpg"
                          alt="Depois da edição IA"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/examples/card-artisticas-conceituais.jpg';
                          }}
                        />
                        <div className="absolute top-6 right-6 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-base font-medium">
                          Depois
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <Link href="/editor">
                      <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-10">
                        Experimentar Editor
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {activeToolModal === 'video' && (
                <div className="space-y-6">
                  <p className="text-gray-600 text-center text-lg">
                    Transforme suas fotos em vídeos dinâmicos com nossa IA
                  </p>

                  {/* Video Player Grande - Otimizado */}
                  <div className="aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden shadow-xl bg-black">
                    <video
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls
                      poster="/examples/tools/video-poster.jpg"
                      preload="auto"
                      onLoadStart={() => console.log('🎬 Video loading started')}
                      onCanPlay={() => console.log('✅ Video can play')}
                      onError={(e) => {
                        console.error('❌ Video error:', e);
                        e.currentTarget.poster = '/examples/professional-woman.jpg';
                      }}
                    >
                      <source src="/examples/tools/video-optimized.mp4" type="video/mp4" />
                      Seu navegador não suporta reprodução de vídeo.
                    </video>
                  </div>

                  <div className="text-center">
                    <Link href="/videos">
                      <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-10">
                        Experimentar Vídeos
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}