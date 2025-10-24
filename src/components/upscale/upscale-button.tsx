'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn } from 'lucide-react'

interface UpscaleButtonProps {
  imageUrl: string
  generation?: any
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'secondary' | 'outline'
  className?: string
  onClick: (imageUrl: string, generation?: any) => void
}

export function UpscaleButton({ 
  imageUrl, 
  generation, 
  size = 'sm',
  variant = 'secondary',
  className = '',
  onClick 
}: UpscaleButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (isLoading) return
    
    setIsLoading(true)
    try {
      onClick(imageUrl, generation)
    } finally {
      setIsLoading(false)
    }
  }

  const buttonSizes = {
    sm: 'h-8 w-8 p-0',
    md: 'h-10 w-10 p-0',
    lg: 'h-12 w-12 p-0'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={`${buttonSizes[size]} bg-green-600 text-white hover:bg-green-700 ${className}`}
      onClick={handleClick}
      disabled={isLoading}
      title="Fazer Upscale"
    >
      {isLoading ? (
        <div className={`${iconSizes[size]} animate-spin rounded-full border-2 border-white border-t-transparent`} />
      ) : (
        <ZoomIn className={iconSizes[size]} />
      )}
    </Button>
  )
}