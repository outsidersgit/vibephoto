export const UPSCALE_CONFIG = {
  // Modelo Topaz Labs para upscale
  model: 'topazlabs/image-upscale',
  version: '2fdc3b86a01d338ae89ad58e5d9241398a8a01de9b0dda41ba8a0434c8a00dc3',

  // Limites e validações
  maxFileSize: 20 * 1024 * 1024, // 20MB
  supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  minResolution: { width: 64, height: 64 },
  maxResolution: { width: 4096, height: 4096 },

  // Fatores de escala disponíveis (Topaz Labs usa formato 2x, 4x, 6x)
  scaleFactors: [2, 4, 6] as const,

  // Configurações padrão para Topaz Labs (otimizadas para menor tamanho)
  defaults: {
    upscale_factor: "2x",
    enhance_model: "Standard V2",
    output_format: "jpg", // MUDANÇA: JPG para arquivos menores
    face_enhancement: true, // MUDANÇA: True por padrão
    subject_detection: "None",
    face_enhancement_strength: 0.8,
    face_enhancement_creativity: 0.0
  },
  
  // Opções disponíveis para Topaz Labs
  options: {
    enhance_models: [
      "Standard V2",
      "Low Resolution V2",
      "CGI",
      "High Fidelity V2",
      "Text Refine"
    ],
    upscale_factors: ["None", "2x", "4x", "6x"],
    output_formats: ["png", "jpg"],
    subject_detection_options: ["None", "All", "Foreground", "Background"]
  },

  // Ranges para validação
  ranges: {
    face_enhancement_strength: { min: 0, max: 1 },
    face_enhancement_creativity: { min: 0, max: 1 }
  },
  
  // Sistema de créditos
  credits: {
    baseUpscale: 10,
    batchDiscount: 8, // Para 10+ imagens
    batchMinimum: 10
  },
  
  // Limites por plano
  planLimits: {
    STARTER: {
      dailyLimit: 999,
      maxScaleFactor: 6, // Máximo do Topaz Labs
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    },
    PREMIUM: {
      dailyLimit: 999,
      maxScaleFactor: 6,
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    },
    GOLD: {
      dailyLimit: 999,
      maxScaleFactor: 6,
      enabledFeatures: ['basic', 'advanced', 'batch', 'auto']
    }
  }
} as const

export type UpscaleOptions = {
  upscale_factor?: "None" | "2x" | "4x" | "6x"
  enhance_model?: "Standard V2" | "Low Resolution V2" | "CGI" | "High Fidelity V2" | "Text Refine"
  output_format?: "png" | "jpg"
  face_enhancement?: boolean
  subject_detection?: "None" | "All" | "Foreground" | "Background"
  face_enhancement_strength?: number
  face_enhancement_creativity?: number
  // Legacy fields for backward compatibility
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