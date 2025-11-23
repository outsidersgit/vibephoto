'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessingPlaceholderProps {
  type: 'image' | 'video'
  prompt?: string
  progress?: number
  className?: string
}

/**
 * Placeholder para itens em processamento na galeria
 * Aparece no lugar onde o card final aparecerá
 */
export function ProcessingPlaceholder({ 
  type, 
  prompt, 
  progress = 0,
  className 
}: ProcessingPlaceholderProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden",
      "bg-gradient-to-br from-gray-50 to-gray-100",
      "border-2 border-dashed border-gray-300",
      "animate-pulse",
      className
    )}>
      <CardContent className="p-0">
        {/* Aspect ratio container - square for images, video ratio for videos */}
        <div className={cn("relative", type === 'video' ? "aspect-video" : "aspect-square")}>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50" />
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                Processando...
              </p>
              <p className="text-xs text-gray-600">
                {type === 'image' ? 'Sua imagem está sendo gerada' : 'Seu vídeo está sendo gerado'}
              </p>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  )
}

