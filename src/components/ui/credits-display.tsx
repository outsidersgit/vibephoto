'use client'

import { Coins } from 'lucide-react'
import { Badge } from './badge'
import { cn } from '@/lib/utils'

interface CreditsDisplayProps {
  creditsUsed: number
  creditsLimit: number
  plan: string
  className?: string
  compact?: boolean
}

export function CreditsDisplay({ 
  creditsUsed, 
  creditsLimit, 
  plan, 
  className,
  compact = false 
}: CreditsDisplayProps) {
  const creditsRemaining = creditsLimit - creditsUsed
  const percentage = (creditsUsed / creditsLimit) * 100
  
  // Determine color based on usage percentage
  const getColorClass = () => {
    if (percentage >= 90) return 'text-red-600 bg-red-50 border-red-200'
    if (percentage >= 75) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const getIconColor = () => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 75) return 'text-orange-500'
    if (percentage >= 50) return 'text-yellow-500'
    return 'text-green-500'
  }

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          'flex items-center gap-1 font-medium',
          getColorClass(),
          className
        )}
      >
        <Coins className={cn('w-3 h-3', getIconColor())} />
        {creditsRemaining}
      </Badge>
    )
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border',
      getColorClass(),
      className
    )}>
      <Coins className={cn('w-4 h-4', getIconColor())} />
      <div className="flex flex-col">
        <span className="text-sm font-semibold">
          {creditsRemaining} créditos
        </span>
        <span className="text-xs opacity-75">
          {creditsUsed}/{creditsLimit} usados
        </span>
      </div>
    </div>
  )
}

