'use client'

import Link from 'next/link'

interface VibeLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  layout?: 'vertical' | 'horizontal' | 'icon-only' | 'text-only'
  variant?: 'default' | 'monochrome' | 'white'
  className?: string
  href?: string
}

export function VibeLogo({ 
  size = 'md', 
  layout = 'vertical', 
  variant = 'default',
  className = '',
  href 
}: VibeLogoProps) {
  const sizeConfig = {
    xs: { circle: 'w-8 h-8', wave: 'h-[1px]', text: 'text-base', gap: 'gap-2' },
    sm: { circle: 'w-10 h-10', wave: 'h-[1.5px]', text: 'text-lg', gap: 'gap-3' },
    md: { circle: 'w-15 h-15', wave: 'h-[2px]', text: 'text-xl', gap: 'gap-4' },
    lg: { circle: 'w-20 h-20', wave: 'h-[2px]', text: 'text-2xl', gap: 'gap-4' },
    xl: { circle: 'w-30 h-30', wave: 'h-[3px]', text: 'text-4xl', gap: 'gap-6' }
  }

  const config = sizeConfig[size]
  const isHorizontal = layout === 'horizontal'
  const showIcon = layout !== 'text-only'
  const showText = layout !== 'icon-only'

  const circleClasses = `
    ${config.circle}
    rounded-full 
    bg-gradient-to-br from-[#667eea] to-[#764ba2]
    flex items-center justify-center
    relative overflow-hidden
    shadow-lg
    ${variant === 'monochrome' ? 'bg-gray-800 shadow-gray-800/30' : ''}
    ${variant === 'white' ? 'bg-white border-2 border-gray-200 shadow-gray-900/10' : ''}
  `.trim()

  const waveClasses = `
    ${config.wave}
    bg-white rounded-sm opacity-90 transition-all duration-300
    ${variant === 'white' ? 'bg-[#667eea]' : ''}
  `.trim()

  const textClasses = `
    ${config.text}
    font-light text-gray-700 tracking-tight
    ${isHorizontal ? 'mt-0' : 'mt-3'}
  `.trim()

  const containerClasses = `
    inline-block font-sans
    ${isHorizontal ? `flex items-center ${config.gap}` : ''}
    ${className}
  `.trim()

  const LogoContent = (
    <div className={containerClasses}>
      {showIcon && (
        <div className={circleClasses}>
          <div className="absolute flex flex-col items-center justify-center gap-0.5">
            <div className={`${waveClasses} w-5`}></div>
            <div className={`${waveClasses} w-4`}></div>
            <div className={`${waveClasses} w-3`}></div>
          </div>
        </div>
      )}
      {showText && (
        <div className={textClasses}>
          <span className="text-[#667eea] font-medium">Vibe</span>Photo
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {LogoContent}
      </Link>
    )
  }

  return LogoContent
}