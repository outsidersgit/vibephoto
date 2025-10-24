'use client'

import { cn } from '@/lib/utils'
import { BorderBeam } from '@/components/ui/border-beam'
import { motion } from 'framer-motion'
import React from 'react'

interface PremiumCardProps {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
  glowing?: boolean
  borderBeam?: boolean
  gradient?: boolean
  onClick?: () => void
}

export function PremiumCard({
  children,
  className,
  hoverable = true,
  glowing = false,
  borderBeam = false,
  gradient = false,
  onClick,
}: PremiumCardProps) {
  return (
    <motion.div
      className={cn(
        'relative rounded-2xl p-6 transition-all duration-500',
        {
          'cursor-pointer': onClick,
          'hover:scale-[1.02] hover:shadow-2xl': hoverable,
          'shadow-2xl shadow-purple-500/10': glowing,
          'bg-gradient-to-br from-white/90 to-white/50 backdrop-blur-sm border border-white/20': gradient,
          'bg-white border border-gray-200': !gradient,
        },
        className
      )}
      onClick={onClick}
      whileHover={hoverable ? { y: -5 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {borderBeam && (
        <BorderBeam 
          size={200} 
          duration={8} 
          colorFrom="#8b5cf6" 
          colorTo="#ec4899" 
        />
      )}
      
      {/* Subtle glow effect */}
      {glowing && (
        <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-xl" />
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
}

interface PremiumCardHeaderProps {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  iconColor?: string
}

export function PremiumCardHeader({
  children,
  className,
  icon,
  iconColor = 'text-purple-600'
}: PremiumCardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {icon && (
        <div className={cn('mb-4 p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 w-fit', iconColor)}>
          {icon}
        </div>
      )}
      {children}
    </div>
  )
}

interface PremiumCardTitleProps {
  children: React.ReactNode
  className?: string
  gradient?: boolean
}

export function PremiumCardTitle({
  children,
  className,
  gradient = false
}: PremiumCardTitleProps) {
  return (
    <h3 className={cn(
      'text-xl font-bold mb-2',
      {
        'bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent': gradient,
        'text-slate-900': !gradient,
      },
      className
    )}>
      {children}
    </h3>
  )
}

interface PremiumCardDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function PremiumCardDescription({
  children,
  className
}: PremiumCardDescriptionProps) {
  return (
    <p className={cn('text-slate-600 leading-relaxed', className)}>
      {children}
    </p>
  )
}

interface PremiumCardContentProps {
  children: React.ReactNode
  className?: string
}

export function PremiumCardContent({
  children,
  className
}: PremiumCardContentProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  )
}