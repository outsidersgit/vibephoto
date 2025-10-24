// Configuração modular para sistema de vídeos com Kling AI 2.1
export const VIDEO_CONFIG = {
  // Provider configuration
  provider: {
    name: 'kling-v2.1-master',
    model: 'kwaivgi/kling-v2.1-master',
    baseUrl: 'https://api.replicate.com/v1'
  },

  // Default parameters for video generation
  defaults: {
    duration: 5,                    // seconds (5 or 10)
    aspectRatio: '16:9',           // "16:9", "9:16", "1:1"  
    quality: 'standard',           // "standard" (720p) or "pro" (1080p)
    negativePrompt: 'blurry, low quality, distorted, watermark, text'
  },

  // Supported options
  options: {
    durations: [5, 10] as const,
    aspectRatios: ['16:9', '9:16', '1:1'] as const,
    qualities: ['standard', 'pro'] as const,
    maxPromptLength: 1500,
    maxNegativePromptLength: 200
  },

  // Cost configuration (in credits)
  costs: {
    base: {
      5: 100,   // 100 credits for 5s video
      10: 200   // 200 credits for 10s video
    },
    qualityMultiplier: {
      standard: 1.0,   // 720p (no extra cost)
      pro: 1.0         // 1080p (same cost)
    }
  },

  // Plan-based limits
  planLimits: {
    STARTER: {
      maxVideosPerDay: 5,
      maxDuration: 10,
      allowPro: true,
      maxConcurrentJobs: 2
    },
    PREMIUM: {
      maxVideosPerDay: 20,
      maxDuration: 10,
      allowPro: true,
      maxConcurrentJobs: 3
    },
    GOLD: {
      maxVideosPerDay: 50,
      maxDuration: 10,
      allowPro: true,
      maxConcurrentJobs: 5
    }
  },

  // Processing time estimates (in seconds)
  estimatedTimes: {
    standard: {
      5: 90,   // ~1.5 minutes for 5s video
      10: 150  // ~2.5 minutes for 10s video
    },
    pro: {
      5: 240,  // ~4 minutes for 5s pro video
      10: 480  // ~8 minutes for 10s pro video
    }
  },

  // Prompt templates for different scenarios
  promptTemplates: {
    portrait: {
      name: 'Retrato Natural',
      prompt: 'gentle breathing motion, subtle eye movement, natural portrait expression',
      description: 'Movimento sutil para retratos, com respiração natural',
      recommendedDuration: 5,
      recommendedAspectRatio: '9:16'
    },
    landscape: {
      name: 'Paisagem Cinematográfica', 
      prompt: 'slow cinematic camera movement, gentle parallax effect',
      description: 'Movimento de câmera cinematográfico para paisagens',
      recommendedDuration: 10,
      recommendedAspectRatio: '16:9'
    },
    product: {
      name: 'Produto 360°',
      prompt: 'smooth 360-degree rotation, professional lighting, studio background',
      description: 'Rotação suave para mostrar produto em todos os ângulos',
      recommendedDuration: 5,
      recommendedAspectRatio: '1:1'
    },
    artistic: {
      name: 'Arte Abstrata',
      prompt: 'flowing motion, artistic transformation, creative movement',
      description: 'Movimento criativo e artístico',
      recommendedDuration: 10,
      recommendedAspectRatio: '16:9'
    },
    nature: {
      name: 'Natureza Viva',
      prompt: 'gentle wind effect, leaves swaying, natural movement',
      description: 'Movimento natural de elementos como folhas e água',
      recommendedDuration: 10,
      recommendedAspectRatio: '16:9'
    }
  },

  // Quality presets
  qualityPresets: {
    standard: {
      name: 'Padrão',
      description: '720p • 24fps • Boa qualidade',
      resolution: '720p',
      recommended: 'Ideal para uso geral e redes sociais'
    },
    pro: {
      name: 'Profissional',
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
export type VideoQuality = typeof VIDEO_CONFIG.options.qualities[number]
export type VideoTemplate = keyof typeof VIDEO_CONFIG.promptTemplates
export type UserPlan = keyof typeof VIDEO_CONFIG.planLimits

// Helper type for video generation request
export interface VideoGenerationRequest {
  sourceImageUrl?: string  // Optional for text-to-video generation
  prompt: string
  negativePrompt?: string
  duration: VideoDuration
  aspectRatio: VideoAspectRatio
  quality: VideoQuality
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