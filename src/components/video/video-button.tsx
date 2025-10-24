'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Video, Clock, Zap } from 'lucide-react'
import { VideoModal } from './video-modal'
import { VideoGenerationRequest } from '@/lib/ai/video/config'
import { calculateVideoCredits } from '@/lib/ai/video/utils'

interface VideoButtonProps {
  imageUrl?: string // Optional for text-to-video mode
  mode?: 'image-to-video' | 'text-to-video' // Video creation mode
  generation?: any // The generation object if this image came from AI generation
  userPlan: string
  onVideoCreated?: (videoId: string) => void
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  showLabel?: boolean
}

export function VideoButton({
  imageUrl,
  mode = 'image-to-video', // Default to image-to-video for backward compatibility
  generation,
  userPlan,
  onVideoCreated,
  className = '',
  variant = 'default',
  size = 'sm',
  showLabel = true
}: VideoButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateVideo = async (request: VideoGenerationRequest) => {
    setIsCreating(true)

    try {
      console.log('🎬 [VIDEO-BUTTON] Creating video with request:', request)
      console.log('🎬 [VIDEO-BUTTON] Generation data:', generation)
      console.log('🎬 [VIDEO-BUTTON] Image URL:', imageUrl)

      const requestBody = {
        prompt: request.prompt,
        duration: Number(request.duration), // Ensure duration is number
        aspect_ratio: request.aspectRatio, // Map to Kling API format
        negative_prompt: request.negativePrompt || '' // Map to Kling API format
      }

      // Add start_image only if sourceImageUrl exists (image-to-video mode)
      if (request.sourceImageUrl) {
        requestBody.start_image = request.sourceImageUrl
      }

      // Store internal fields separately for backend processing
      const metadata = {
        quality: request.quality,
        template: request.template,
        sourceGenerationId: generation?.id
      }

      // Add metadata to request body for backend processing (not sent to Kling API)
      Object.assign(requestBody, metadata)
      
      console.log('🎬 [VIDEO-BUTTON] Final request body:', JSON.stringify(requestBody, null, 2))
      console.log('🎬 [VIDEO-BUTTON] Request body keys:', Object.keys(requestBody))
      console.log('🎬 [VIDEO-BUTTON] Request body values:', Object.values(requestBody))

      const response = await fetch('/api/video/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })

      console.log('🎬 [VIDEO-BUTTON] Response status:', response.status)
      console.log('🎬 [VIDEO-BUTTON] Response statusText:', response.statusText)
      console.log('🎬 [VIDEO-BUTTON] Response headers:', Object.fromEntries(response.headers.entries()))

      let data
      try {
        const responseText = await response.text()
        console.log('🎬 [VIDEO-BUTTON] Raw response text:', responseText)
        
        if (responseText.trim()) {
          data = JSON.parse(responseText)
          console.log('🎬 [VIDEO-BUTTON] Parsed response data:', data)
        } else {
          console.log('🎬 [VIDEO-BUTTON] Empty response body')
          data = null
        }
      } catch (parseError) {
        console.error('❌ [VIDEO-BUTTON] Failed to parse response JSON:', parseError)
        throw new Error(`Invalid response from server: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }

      if (!response.ok) {
        console.error('❌ [VIDEO-BUTTON] Response NOT OK - Status:', response.status)
        console.error('❌ [VIDEO-BUTTON] Response statusText:', response.statusText)
        console.error('❌ [VIDEO-BUTTON] Response URL:', response.url)
        console.error('❌ [VIDEO-BUTTON] Response data:', JSON.stringify(data, null, 2))
        console.error('❌ [VIDEO-BUTTON] Full response object:', response)
        
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          data: data
        }
        console.error('❌ [VIDEO-BUTTON] API error details:', errorDetails)
        
        // Extract error message from JSON response with fallbacks
        let errorMessage = 'Erro desconhecido'
        if (data && typeof data === 'object') {
          errorMessage = data.error || data.details || data.message || `HTTP ${response.status}: ${response.statusText}`
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      console.log('✅ [VIDEO-BUTTON] Video creation started:', data)

      // Notify parent component
      if (onVideoCreated && data.videoId) {
        onVideoCreated(data.videoId)
      }

      // Close modal
      setIsModalOpen(false)

      // Show success message (you might want to use a toast here)
      console.log('🎉 [VIDEO-BUTTON] Vídeo em processamento:', data.message)

    } catch (error) {
      console.error('❌ [VIDEO-BUTTON] Video creation failed:', error)
      console.error('❌ [VIDEO-BUTTON] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      // Error will be handled by the modal
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  const handleButtonClick = () => {
    // Validate image URL for image-to-video mode only
    if (mode === 'image-to-video' && !imageUrl) {
      console.error('❌ No image URL provided for image-to-video mode')
      return
    }

    // Redirect to dedicated generation page for consistency with "Edit Image" flow
    if (mode === 'image-to-video' && imageUrl) {
      window.location.href = `/generate?tab=video&sourceImage=${encodeURIComponent(imageUrl)}`
      return
    }

    // For text-to-video mode, still open modal (or redirect without sourceImage)
    if (mode === 'text-to-video') {
      window.location.href = `/generate?tab=video`
      return
    }

    // Fallback to modal for any edge cases
    setIsModalOpen(true)
  }

  // Get appropriate icon based on user plan
  const getIcon = () => {
    if (isCreating) {
      return <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
    }
    
    switch (userPlan) {
      case 'GOLD':
        return <Zap className="w-4 h-4" />
      case 'PREMIUM':
        return <Video className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  // Get button color based on user plan
  const getButtonClassName = () => {
    const baseClasses = className
    
    if (variant === 'default') {
      switch (userPlan) {
        case 'GOLD':
          return `bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white ${baseClasses}`
        case 'PREMIUM':
          return `bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white ${baseClasses}`
        default:
          return `bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white ${baseClasses}`
      }
    }
    
    return baseClasses
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleButtonClick}
        disabled={isCreating}
        className={getButtonClassName()}
        title="Criar vídeo a partir desta imagem"
      >
        {getIcon()}
        {showLabel && (
          <span className="ml-2">
            {isCreating ? 'Criando...' : mode === 'text-to-video' ? `🎬 Criar Vídeo (${calculateVideoCredits(5, 'pro')} créditos)` : `🎬 Vídeo (${calculateVideoCredits(5, 'pro')} créditos)`}
          </span>
        )}
      </Button>

      <VideoModal
        isOpen={isModalOpen}
        mode={mode}
        sourceImageUrl={imageUrl}
        sourceGeneration={generation}
        onClose={() => setIsModalOpen(false)}
        onCreateVideo={handleCreateVideo}
        userPlan={userPlan}
      />
    </>
  )
}

// Compact version for use in action buttons
export function CompactVideoButton({ variant = 'ghost', className = 'h-7 w-7 p-0', ...props }: VideoButtonProps) {
  return (
    <VideoButton
      {...props}
      size="sm"
      variant={variant}
      showLabel={false}
      className={className}
    />
  )
}

// Premium styled button for featured placement
export function PremiumVideoButton(props: VideoButtonProps) {
  return (
    <VideoButton 
      {...props}
      size="default"
      variant="default"
      showLabel={true}
      className="shadow-lg hover:shadow-xl transition-all duration-200"
    />
  )
}

// Standalone button for text-to-video creation (no image required)
export function StandaloneVideoButton({ 
  userPlan, 
  onVideoCreated, 
  className = '',
  variant = 'default',
  size = 'default'
}: {
  userPlan: string
  onVideoCreated?: (videoId: string) => void
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}) {
  const handleVideoCreated = (videoId: string) => {
    // Default behavior: log success
    console.log('✅ Video created successfully:', videoId)
    
    // Call custom callback if provided
    if (onVideoCreated) {
      onVideoCreated(videoId)
    }
  }

  return (
    <VideoButton 
      mode="text-to-video"
      userPlan={userPlan}
      onVideoCreated={handleVideoCreated}
      showLabel={true}
      variant={variant}
      size={size}
      className={`${className} min-w-[140px]`}
    />
  )
}