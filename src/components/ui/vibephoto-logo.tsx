import React from 'react'

interface VibePhotoLogoProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  layout?: 'vertical' | 'horizontal' | 'iconOnly' | 'textOnly'
  variant?: 'default' | 'monochrome' | 'white'
  showText?: boolean
}

export function VibePhotoLogo({ 
  className = '', 
  size = 'md', 
  layout = 'horizontal',
  variant = 'default',
  showText = true 
}: VibePhotoLogoProps) {
  const sizeClasses = {
    xs: { circle: 'w-8 h-8', text: 'text-base', waves: 'w-6 h-6', gap: 'gap-2' },
    sm: { circle: 'w-10 h-10', text: 'text-lg', waves: 'w-7 h-7', gap: 'gap-3' },
    md: { circle: 'w-12 h-12', text: 'text-xl', waves: 'w-9 h-9', gap: 'gap-4' },
    lg: { circle: 'w-16 h-16', text: 'text-2xl', waves: 'w-12 h-12', gap: 'gap-4' },
    xl: { circle: 'w-20 h-20', text: 'text-3xl', waves: 'w-15 h-15', gap: 'gap-5' }
  }

  const currentSize = sizeClasses[size]
  
  // Layout classes
  const layoutClass = layout === 'horizontal' ? 'flex items-center' : 'flex flex-col items-center'
  const textMargin = layout === 'horizontal' ? '' : 'mt-3'
  
  // Variant classes
  const getCircleClasses = () => {
    switch (variant) {
      case 'monochrome':
        return 'bg-gray-800 shadow-lg'
      case 'white':
        return 'bg-white border-2 border-gray-200 shadow-md'
      default:
        return 'bg-gradient-to-br from-[#667EEA] to-[#764BA2] shadow-lg shadow-[#667EEA]/25'
    }
  }

  const getWaveColor = () => {
    switch (variant) {
      case 'white':
        return 'bg-[#667EEA]'
      default:
        return 'bg-white'
    }
  }

  const getTextColor = () => {
    switch (variant) {
      case 'white':
        return 'text-white'
      case 'monochrome':
        return 'text-gray-800'
      default:
        return 'text-gray-900'
    }
  }

  return (
    <div className={`${layoutClass} ${currentSize.gap} ${className}`}>
      {/* Logo Circle */}
      {layout !== 'textOnly' && (
        <div className={`${currentSize.circle} ${getCircleClasses()} rounded-full flex items-center justify-center relative overflow-hidden`}>
          <div className={`${currentSize.waves} flex flex-col items-center justify-center gap-1`}>
            <div className={`${getWaveColor()} h-0.5 w-6 rounded-full opacity-90`}></div>
            <div className={`${getWaveColor()} h-0.5 w-5 rounded-full opacity-90`}></div>
            <div className={`${getWaveColor()} h-0.5 w-4 rounded-full opacity-90`}></div>
          </div>
        </div>
      )}
      
      {/* App Name */}
      {showText && layout !== 'iconOnly' && (
        <div className={`${currentSize.text} ${textMargin} ${getTextColor()} font-light tracking-tight`}>
          <span className="text-[#667EEA] font-medium">Vibe</span>Photo<span className="text-xs ml-0.5 opacity-70">™</span>
        </div>
      )}
    </div>
  )
}