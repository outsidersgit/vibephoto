// Configuração modular para sistema de vídeos com Google Veo 3.1 Fast
export const VIDEO_CONFIG = {
  // Provider configuration
  provider: {
    name: 'veo-3.1-fast',
    model: 'google/veo-3.1-fast',
    baseUrl: 'https://api.replicate.com/v1'
  },

  // Default parameters for video generation
  defaults: {
    duration: 8,                    // seconds (4, 6, or 8)
    aspectRatio: '16:9',           // "16:9" or "9:16"
    resolution: '1080p',           // "720p" or "1080p" (always 1080p, hidden in UI)
    generateAudio: true,           // Generate audio with video
    negativePrompt: 'blurry, low quality, distorted, watermark, text'
  },

  // Supported options
  options: {
    durations: [4, 6, 8] as const,
    aspectRatios: ['16:9', '9:16'] as const,
    resolutions: ['720p', '1080p'] as const,
    maxPromptLength: 4000,
    maxNegativePromptLength: 200
  },

  // Cost configuration (in credits)
  costs: {
    base: {
      4: 80,    // 80 credits for 4s video
      6: 120,   // 120 credits for 6s video
      8: 160    // 160 credits for 8s video
    },
    resolutionMultiplier: {
      '720p': 1.0,   // 720p (no extra cost)
      '1080p': 1.0   // 1080p (same cost)
    }
  },

  // Plan-based limits
  planLimits: {
    STARTER: {
      maxVideosPerDay: 5,
      maxDuration: 8,
      allowHighRes: true,
      maxConcurrentJobs: 2
    },
    PREMIUM: {
      maxVideosPerDay: 20,
      maxDuration: 8,
      allowHighRes: true,
      maxConcurrentJobs: 3
    },
    GOLD: {
      maxVideosPerDay: 50,
      maxDuration: 8,
      allowHighRes: true,
      maxConcurrentJobs: 5
    }
  },

  // Processing time estimates (in seconds)
  estimatedTimes: {
    '720p': {
      4: 60,   // ~1 minute for 4s video
      6: 90,   // ~1.5 minutes for 6s video
      8: 120   // ~2 minutes for 8s video
    },
    '1080p': {
      4: 120,  // ~2 minutes for 4s video
      6: 180,  // ~3 minutes for 6s video
      8: 240   // ~4 minutes for 8s video
    }
  },

  // Prompt templates for different scenarios
  promptTemplates: {
    portrait: {
      name: 'Retrato Natural',
      prompt: 'gentle breathing motion, subtle eye movement, natural portrait expression',
      description: 'Movimento sutil para retratos, com respiração natural',
      recommendedDuration: 6,
      recommendedAspectRatio: '9:16'
    },
    landscape: {
      name: 'Paisagem Cinematográfica', 
      prompt: 'slow cinematic camera movement, gentle parallax effect',
      description: 'Movimento de câmera cinematográfico para paisagens',
      recommendedDuration: 8,
      recommendedAspectRatio: '16:9'
    },
    product: {
      name: 'Produto 360°',
      prompt: 'smooth 360-degree rotation, professional lighting, studio background',
      description: 'Rotação suave para mostrar produto em todos os ângulos',
      recommendedDuration: 6,
      recommendedAspectRatio: '16:9'
    },
    artistic: {
      name: 'Arte Abstrata',
      prompt: 'flowing motion, artistic transformation, creative movement',
      description: 'Movimento criativo e artístico',
      recommendedDuration: 8,
      recommendedAspectRatio: '16:9'
    },
    nature: {
      name: 'Natureza Viva',
      prompt: 'gentle wind effect, leaves swaying, natural movement',
      description: 'Movimento natural de elementos como folhas e água',
      recommendedDuration: 8,
      recommendedAspectRatio: '16:9'
    }
  },

  // Resolution presets
  resolutionPresets: {
    '720p': {
      name: 'HD',
      description: '720p • 24fps • Boa qualidade',
      resolution: '720p',
      recommended: 'Ideal para uso geral e redes sociais'
    },
    '1080p': {
      name: 'Full HD',
      description: '1080p • 24fps • Alta qualidade',
      resolution: '1080p', 
      recommended: 'Melhor qualidade para uso profissional'
    }
  },

  // File format specifications
  output: {
    format: 'mp4',
    codec: 'h264',
    fps: 24,
    maxFileSize: 50 * 1024 * 1024, // 50MB max
    supportedFormats: ['mp4'] as const
  },

  // Validation rules
  validation: {
    minImageSize: { width: 512, height: 512 },
    maxImageSize: { width: 4096, height: 4096 },
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'] as const,
    maxImageFileSize: 10 * 1024 * 1024 // 10MB
  }
} as const

// Type definitions based on config
export type VideoDuration = typeof VIDEO_CONFIG.options.durations[number]
export type VideoAspectRatio = typeof VIDEO_CONFIG.options.aspectRatios[number]  
export type VideoResolution = typeof VIDEO_CONFIG.options.resolutions[number]
export type VideoTemplate = keyof typeof VIDEO_CONFIG.promptTemplates
export type UserPlan = keyof typeof VIDEO_CONFIG.planLimits

// Helper type for video generation request
export interface VideoGenerationRequest {
  image?: string           // Input image (renamed from sourceImageUrl for Veo compatibility)
  sourceImageUrl?: string  // Legacy compatibility
  lastFrame?: string       // Ending image for interpolation (NEW)
  prompt: string
  negativePrompt?: string
  duration: VideoDuration
  aspectRatio: VideoAspectRatio
  resolution?: VideoResolution  // Resolution (720p or 1080p, defaults to 1080p)
  generateAudio?: boolean  // Generate audio with video (NEW)
  seed?: number           // Random seed for reproducibility (NEW)
  quality?: 'standard' | 'pro'  // Legacy compatibility
  template?: VideoTemplate
}

// Status enum for video generation
export enum VideoStatus {
  STARTING = 'STARTING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Video generation response type
export interface VideoGenerationResponse {
  id: string
  status: VideoStatus
  jobId?: string
  videoUrl?: string
  thumbnailUrl?: string
  errorMessage?: string
  progress?: number
  estimatedTimeRemaining?: number
}