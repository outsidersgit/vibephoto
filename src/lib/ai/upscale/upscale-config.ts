export const UPSCALE_CONFIG = {
  // Modelo Nano Banana Pro para upscale 4K
  model: 'google/nano-banana-pro',
  version: 'latest', // Replicate usa versão mais recente automaticamente

  // Limites e validações
  maxFileSize: 20 * 1024 * 1024, // 20MB
  supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  minResolution: { width: 64, height: 64 },
  maxResolution: { width: 8192, height: 8192 }, // 4K e superior

  // Nano Banana Pro usa resolução fixa "4K"
  scaleFactors: [4] as const, // 4K upscale

  // Configurações padrão para Nano Banana Pro
  defaults: {
    resolution: "4K",
    output_format: "jpg",
    aspect_ratio: "match_input_image", // Preserva proporções originais
    safety_filter_level: "block_only_high"
  },

  // Opções disponíveis para Nano Banana Pro
  options: {
    resolutions: ["2K", "4K"],
    output_formats: ["png", "jpg"],
    aspect_ratios: ["match_input_image", "1:1", "4:3", "3:4", "9:16", "16:9"],
    safety_filter_levels: ["none", "block_only_high", "block_some"]
  },

  // Ranges (não aplicável para Nano Banana Pro, mantido para compatibilidade)
  ranges: {},

  // Sistema de créditos (atualizado para Nano Banana Pro)
  credits: {
    baseUpscale: 30, // Nano Banana Pro 4K upscale
    batchDiscount: 25, // Para 10+ imagens
    batchMinimum: 10
  },
  
  // Limites por plano
  planLimits: {
    STARTER: {
      dailyLimit: 999,
      maxScaleFactor: 4, // 4K upscale (Nano Banana Pro)
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    },
    PREMIUM: {
      dailyLimit: 999,
      maxScaleFactor: 4,
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    },
    GOLD: {
      dailyLimit: 999,
      maxScaleFactor: 4,
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    }
  }
} as const

export type UpscaleOptions = {
  // Nano Banana Pro options
  resolution?: "2K" | "4K"
  output_format?: "png" | "jpg"
  aspect_ratio?: "match_input_image" | "1:1" | "4:3" | "3:4" | "9:16" | "16:9"
  safety_filter_level?: "none" | "block_only_high" | "block_some"

  // Legacy fields for backward compatibility (Topaz Labs)
  upscale_factor?: "None" | "2x" | "4x" | "6x"
  enhance_model?: "Standard V2" | "Low Resolution V2" | "CGI" | "High Fidelity V2" | "Text Refine"
  face_enhancement?: boolean
  subject_detection?: "None" | "All" | "Foreground" | "Background"
  face_enhancement_strength?: number
  face_enhancement_creativity?: number
  scale_factor?: 2 | 4 | 6
}

export type UpscaleJob = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  originalImage: string
  resultImage?: string
  options: UpscaleOptions
  progress?: number
  error?: string
  createdAt: Date
  completedAt?: Date
  estimatedTime?: number
  creditsUsed: number
}

export type UpscalePlan = keyof typeof UPSCALE_CONFIG.planLimits