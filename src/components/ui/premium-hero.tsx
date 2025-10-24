'use client'

import { ArrowRight, Sparkles, Play } from 'lucide-react'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'
import { BorderBeam } from '@/components/ui/border-beam'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { Ripple } from '@/components/ui/ripple-effect'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface PremiumHeroProps {
  title: string
  subtitle: string
  description: string
  primaryAction: {
    text: string
    href: string
  }
  secondaryAction?: {
    text: string
    onClick?: () => void
    href?: string
  }
  showBadge?: boolean
  badgeText?: string
}

export function PremiumHero({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  showBadge = true,
  badgeText = "VibePhoto - Geração de Fotos com IA"
}: PremiumHeroProps) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
      <Ripple className="opacity-30" />
      
      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 left-10 w-20 h-20 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-20"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute top-40 right-20 w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 opacity-20"
        animate={{
          y: [0, 15, 0],
          rotate: [0, -180, -360],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />

      <motion.div
        className="absolute bottom-40 left-1/4 w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 opacity-20"
        animate={{
          y: [0, -25, 0],
          x: [0, 10, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
        {showBadge && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <AnimatedGradientText className="mb-4">
              <Sparkles className="mr-2 size-3" />
              <hr className="mx-2 h-4 w-[1px] shrink-0 bg-gray-300" />
              <span className="inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent">
                {badgeText}
              </span>
            </AnimatedGradientText>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-6xl md:text-8xl font-bold mb-6 tracking-tight"
        >
          <span className="inline-block">{title}</span>
          <br />
          <span className="inline-block bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
            {subtitle}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-slate-600 mb-12 max-w-4xl mx-auto leading-relaxed font-light"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
        >
          <Link href={primaryAction.href}>
            <ShimmerButton
              className="px-8 py-4 text-lg font-semibold"
              background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            >
              {primaryAction.text}
              <ArrowRight className="ml-2 size-5" />
            </ShimmerButton>
          </Link>

          {secondaryAction && (
            <motion.button
              onClick={secondaryAction.onClick}
              className="group flex items-center gap-2 px-8 py-4 text-lg font-medium text-slate-600 hover:text-slate-900 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 group-hover:border-slate-300 transition-all duration-300 group-hover:bg-white">
                <Play className="size-5 ml-1" />
              </div>
              {secondaryAction.text}
            </motion.button>
          )}
        </motion.div>

        {/* Stats or Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="relative rounded-3xl bg-white/60 backdrop-blur-sm border border-white/20 p-8 shadow-2xl">
            <BorderBeam size={300} duration={12} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-slate-900 mb-2">10k+</div>
                <div className="text-slate-600 font-medium">Fotos Geradas</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-slate-900 mb-2">500+</div>
                <div className="text-slate-600 font-medium">Usuários Ativos</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-slate-900 mb-2">99.9%</div>
                <div className="text-slate-600 font-medium">Satisfação</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}