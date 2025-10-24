'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { calculateVideoCredits, getEstimatedProcessingTime } from '@/lib/ai/video/utils'
import { VIDEO_CONFIG, VideoDuration, VideoQuality, UserPlan } from '@/lib/ai/video/config'

interface UseVideoCreditsPRops {
  duration: VideoDuration
  quality: VideoQuality
}

interface VideoCapabilities {
  maxVideosPerDay: number
  maxDuration: number
  qualityOptions: VideoQuality[]
  aspectRatios: string[]
  maxConcurrentJobs: number
}

interface VideoUsage {
  todayVideos: number
  processingVideos: number  
  totalVideos: number
  completedVideos: number
  availableCredits: number
  creditsUsed: number
  creditsLimit: number
}

interface VideoCosts {
  [key: string]: number
}

export function useVideoCredits({ duration, quality }: UseVideoCreditsPRops) {
  const { data: session } = useSession()
  const [capabilities, setCapabilities] = useState<VideoCapabilities | null>(null)
  const [usage, setUsage] = useState<VideoUsage | null>(null)
  const [costs, setCosts] = useState<VideoCosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get user plan
  const userPlan = (session?.user as any)?.plan || 'STARTER' as UserPlan

  // Fetch capabilities and usage
  const fetchCapabilities = async () => {
    try {
      const response = await fetch('/api/video/create', {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch video capabilities')
      }

      const data = await response.json()
      
      setCapabilities(data.capabilities)
      setUsage(data.currentUsage)
      setCosts(data.costs)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching video capabilities:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  // Fetch data on mount and when session changes
  useEffect(() => {
    if (session?.user) {
      fetchCapabilities()
    } else {
      setLoading(false)
    }
  }, [session?.user])

  // Calculate credits needed for current settings
  const creditsNeeded = calculateVideoCredits(duration, quality)
  
  // Calculate estimated processing time
  const estimatedTime = getEstimatedProcessingTime(duration, quality)

  // Check if user can afford the video
  const canAfford = usage ? usage.availableCredits >= creditsNeeded : false

  // Check daily limit
  const withinDailyLimit = usage && capabilities ? 
    usage.todayVideos < capabilities.maxVideosPerDay : false

  // Check concurrent limit
  const withinConcurrentLimit = usage && capabilities ? 
    usage.processingVideos < capabilities.maxConcurrentJobs : false

  // Check if duration is allowed
  const durationAllowed = capabilities ? 
    duration <= capabilities.maxDuration : false

  // Check if quality is allowed
  const qualityAllowed = capabilities ? 
    capabilities.qualityOptions.includes(quality) : false

  // Overall can create check
  const canCreateVideo = canAfford && withinDailyLimit && withinConcurrentLimit && 
                          durationAllowed && qualityAllowed

  // Get blocking reason if can't create
  const getBlockingReason = (): string | null => {
    if (!usage || !capabilities) return 'Loading...'
    
    if (!canAfford) {
      return `Créditos insuficientes. Necessários: ${creditsNeeded}, Disponíveis: ${usage.availableCredits}`
    }
    
    if (!withinDailyLimit) {
      return `Limite diário atingido (${usage.todayVideos}/${capabilities.maxVideosPerDay})`
    }
    
    if (!withinConcurrentLimit) {
      return `Muitos vídeos processando simultaneamente (${usage.processingVideos}/${capabilities.maxConcurrentJobs})`
    }
    
    if (!durationAllowed) {
      return `Duração ${duration}s não permitida no plano ${userPlan}`
    }
    
    if (!qualityAllowed) {
      return `Qualidade ${quality} não permitida no plano ${userPlan}`
    }
    
    return null
  }

  // Get cost breakdown
  const getCostBreakdown = () => {
    const baseCost = VIDEO_CONFIG.costs.base[duration]
    const qualityMultiplier = VIDEO_CONFIG.costs.qualityMultiplier[quality]
    
    return {
      baseCost,
      qualityMultiplier,
      totalCost: creditsNeeded,
      quality: quality === 'pro' ? 'Profissional' : 'Padrão',
      duration: `${duration} segundos`
    }
  }

  // Get plan benefits
  const getPlanBenefits = () => {
    if (!capabilities) return null
    
    return {
      videosPerDay: capabilities.maxVideosPerDay,
      maxDuration: `${capabilities.maxDuration}s`,
      qualityOptions: capabilities.qualityOptions.join(', '),
      concurrentJobs: capabilities.maxConcurrentJobs
    }
  }

  // Refresh data
  const refresh = () => {
    if (session?.user) {
      setLoading(true)
      fetchCapabilities()
    }
  }

  return {
    // Data
    capabilities,
    usage,
    costs,
    userPlan,
    
    // Calculations
    creditsNeeded,
    estimatedTime,
    
    // Permissions
    canCreateVideo,
    canAfford,
    withinDailyLimit,
    withinConcurrentLimit,
    durationAllowed,
    qualityAllowed,
    
    // Utilities
    getBlockingReason,
    getCostBreakdown,
    getPlanBenefits,
    
    // State
    loading,
    error,
    refresh
  }
}

// Hook for video creation tracking
export function useVideoCreationTracking() {
  const [activeCreations, setActiveCreations] = useState<string[]>([])
  const [completedCreations, setCompletedCreations] = useState<string[]>([])

  const addCreation = (videoId: string) => {
    setActiveCreations(prev => [...prev, videoId])
  }

  const completeCreation = (videoId: string) => {
    setActiveCreations(prev => prev.filter(id => id !== videoId))
    setCompletedCreations(prev => [...prev, videoId])
  }

  const removeCreation = (videoId: string) => {
    setActiveCreations(prev => prev.filter(id => id !== videoId))
  }

  return {
    activeCreations,
    completedCreations,
    addCreation,
    completeCreation,
    removeCreation,
    hasActiveCreations: activeCreations.length > 0
  }
}