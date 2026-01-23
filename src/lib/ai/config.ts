export const AI_CONFIG = {
  // Provider selection: 'replicate' | 'runpod' | 'local' | 'gemini' | 'astria' | 'hybrid'
  provider: (process.env.AI_PROVIDER || 'hybrid') as 'replicate' | 'runpod' | 'local' | 'gemini' | 'astria' | 'hybrid',
  
  // Replicate Configuration
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN || '',
    webhookSecret: process.env.REPLICATE_WEBHOOK_SECRET || '',
    // Model destination configuration
    modelNaming: {
      baseUsername: process.env.REPLICATE_USERNAME || 'vibephoto',
      prefix: 'flux-lora',
      separator: '-'
    },
    // Popular models for training and generation
    models: {
      // FLUX.1 for training and generation - Updated per Replicate API docs
      flux: {
        training: 'ostris/flux-dev-lora-trainer:26dce37af90b9d997eeb970d92e47de3064d46c300504ae376c75bef6a9022d2',
        generation: 'black-forest-labs/flux-schnell:c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e', // Schnell - fast generation
        dev: 'black-forest-labs/flux-dev:8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f', // Dev - higher quality
        pro: 'black-forest-labs/flux-pro:5de114640536c3073e8f2b9bb7e7085da94f6e22e5b5169af877e4b92024616e', // Pro - professional quality
        ultra: 'black-forest-labs/flux-1.1-pro-ultra:6d3c61b08d53c53d6ec8ac0b01b1ec0b4a8aa7cccd95b63c8c97b06e10b59a19' // Ultra - maximum quality (4MP)
      },
      // Stable Diffusion models
      sdxl: {
        training: 'cloneofsimo/lora:fce477182f407ffd66b94b08e761424cabd13b82b518754b83080bc75ad32466',
        generation: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
        turbo: 'stability-ai/sdxl-turbo:da77bc59ee60423279fd632efb4795ab731d9e3ca9705ef3341091fb989b7eaf' // Faster generation
      },
      // Nano Banana Pro for 4K upscaling (via Replicate)
      upscaler: 'google/nano-banana-pro',
      // Legacy Topaz Labs (backup)
      upscalerLegacy: 'topazlabs/image-upscale:2fdc3b86a01d338ae89ad58e5d9241398a8a01de9b0dda41ba8a0434c8a00dc3',
      // Background removal
      backgroundRemoval: 'rembg/new:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
      // Video generation with Kling AI 2.1
      video: {
        kling: 'kwaivgi/kling-v2.1-master'
      }
    }
  },
  
  // RunPod Configuration
  runpod: {
    apiKey: process.env.RUNPOD_API_KEY || '',
    endpointId: process.env.RUNPOD_ENDPOINT_ID || '',
    webhookUrl: process.env.RUNPOD_WEBHOOK_URL || ''
  },
  
  // Gemini Configuration - Nano Banana (Gemini 2.5 Flash Image)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash-exp',
    imageModel: 'gemini-2.5-flash-image-preview', // Nano Banana - Latest image editing model
    maxTokens: 8192,
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    // Nano Banana specific settings
    nanoBanana: {
      maxImagesPerRequest: 14, // Can blend up to 14 images (Nano Banana Pro limit)
      supportedOperations: ['edit', 'add', 'remove', 'style', 'combine', 'blend'],
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp']
    }
  },

  // OpenAI Configuration - GPT-4o Vision for image quality analysis
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o', // Latest GPT-4o with vision capabilities
    maxTokens: 1000,
    temperature: 0.1, // Very low for maximum consistency between analyses
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },

  // Astria Configuration
  astria: {
    apiKey: process.env.ASTRIA_API_KEY || '',
    webhookUrl: process.env.ASTRIA_WEBHOOK_URL || '',
    testMode: process.env.ASTRIA_TEST_MODE === 'true',

    // Base models disponíveis na Astria
    models: {
      faceid: {
        baseTuneId: 690204, // Realistic Vision v5.1 - optimized for faces
        description: 'Rápido, alta preservação facial'
      },
      sd15: {
        description: 'Modelo clássico, boa qualidade'
      },
      sdxl1: {
        description: 'Alta resolução, qualidade premium'
      },
      fluxLora: {
        description: 'Última geração, máxima qualidade'
      }
    },

    // Configurações de qualidade padrão para Astria
    defaultQualityParams: {
      // SEMPRE ativar técnicas de aperfeiçoamento para máxima qualidade
      super_resolution: true,
      inpaint_faces: true,
      face_correct: true,
      face_swap: true, // Será ativado apenas quando houver modelo customizado
      hires_fix: true,

      // Parâmetros de qualidade
      cfg_scale: 7.5,
      steps: 30,
      scheduler: 'euler_a',
      output_quality: 95,

      // Prompt negativo padrão otimizado para Astria
      negative_prompt: 'low quality, blurry, distorted, disfigured, bad anatomy, bad proportions, cloned face, duplicate, extra arms, extra fingers, extra limbs, extra legs, fused fingers, gross proportions, long neck, malformed limbs, missing arms, missing legs, mutated hands, poorly drawn face, poorly drawn hands, too many fingers, ugly, worst quality, low resolution, oversaturated, cartoon'
    },

    // Configurações de enhancement específicas por tipo de conteúdo
    enhancementProfiles: {
      portrait: {
        inpaint_faces: true,
        face_correct: true,
        face_swap: true,
        super_resolution: true,
        cfg_scale: 6.5, // Menos agressivo para retratos
        steps: 35
      },
      fullBody: {
        inpaint_faces: true,
        face_correct: true,
        super_resolution: true,
        hires_fix: true,
        cfg_scale: 7.5,
        steps: 30
      },
      artistic: {
        face_correct: false, // Pode interferir com estilo artístico
        super_resolution: true,
        cfg_scale: 8.0, // Mais criativo
        steps: 25
      }
    }
  },
  
  // Training Configuration
  training: {
    // Default training parameters
    defaultParams: {
      steps: 1000,
      learningRate: 1e-4,
      batchSize: 1,
      resolution: 1024,
      triggerWord: 'TOK', // Default trigger word
      classWord: 'person', // Default class word
    },
    
    // Quality settings based on user plan (all plans are now paid)
    qualitySettings: {
      PREMIUM: {
        maxSteps: 1000,
        maxResolution: 1024,
        maxImages: 50
      },
      GOLD: {
        maxSteps: 2000,
        maxResolution: 1536,
        maxImages: 100
      }
    }
  },
  
  // Generation Configuration
  generation: {
    // Model-specific parameters mapping
    modelParams: {
      'flux-schnell': {
        parameterName: 'num_inference_steps',
        guidanceName: 'guidance_scale',
        defaultSteps: 4,
        maxSteps: 8,
        defaultGuidance: 3.5,
        maxGuidance: 5.0,
        supportsAspectRatio: false,
        supportsRawMode: false,
        supportsSafetyTolerance: false
      },
      'flux-dev': {
        parameterName: 'num_inference_steps',
        guidanceName: 'guidance_scale', 
        defaultSteps: 20,
        maxSteps: 50,
        defaultGuidance: 4.0,
        maxGuidance: 5.0,
        supportsAspectRatio: false,
        supportsRawMode: false,
        supportsSafetyTolerance: false
      },
      'flux-pro': {
        parameterName: 'steps',
        guidanceName: 'guidance',
        defaultSteps: 25,
        maxSteps: 50,
        defaultGuidance: 4.0,
        maxGuidance: 5.0,
        supportsAspectRatio: false,
        supportsRawMode: false,
        supportsSafetyTolerance: true
      },
      'flux-ultra': {
        parameterName: null, // Uses aspect_ratio instead of width/height
        guidanceName: null,  // No guidance parameter
        defaultSteps: null,
        maxSteps: null,
        supportsAspectRatio: true,
        supportsRawMode: true,
        supportsSafetyTolerance: true,
        supportsOutputQuality: true
      }
    },
    
    // Default generation parameters (optimized for FLUX with user feedback)
    defaultParams: {
      width: 1024,
      height: 1024,
      steps: 32,  // Optimal quality steps based on user testing
      guidance_scale: 4.0,  // Optimized for FLUX (reduced from higher values to prevent over-saturation)
      scheduler: 'DPMSolverMultistep', // Best quality scheduler for FLUX
      safety_tolerance: 2, // FLUX Pro/Ultra parameter (1-6)
      output_quality: 95,  // Maximum quality (0-100)
      output_format: 'png', // PNG for maximum quality without compression
      raw_mode: false,     // FLUX 1.1 Pro Ultra - raw mode for natural images
      safety_checker: true
    },
    
    // Generation limits based on user plan (optimized for maximum quality)
    limits: {
      STARTER: {
        maxGenerationsPerDay: 1000,
        maxResolution: 1440,   // Custom models max resolution (Replicate limit)
        maxSteps: 50,          // Maximum steps for highest quality
        minResolution: 512,    // Minimum resolution requirement
        preferredSteps: 25,    // Optimal quality/speed balance
        maxGuidance: 5.0,      // FLUX Pro maximum guidance
        allowRawMode: true,    // Enable raw mode for photorealistic results
        allowUltraQuality: true // Enable maximum quality settings
      },
      PREMIUM: {
        maxGenerationsPerDay: 100,
        maxResolution: 1536,   // Minimum resolution enforced at 512px
        maxSteps: 40,          // FLUX Dev optimal range
        minResolution: 512     // Minimum resolution requirement
      },
      GOLD: {
        maxGenerationsPerDay: 500,
        maxResolution: 2048,   // Minimum resolution enforced at 512px
        maxSteps: 50,          // FLUX Pro optimal range
        minResolution: 512     // Minimum resolution requirement
      }
    }
  },
  
  // Webhook Configuration
  webhooks: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://webhook.site/unique-id',
    endpoints: {
      training: '/api/webhooks/training',
      generation: '/api/webhooks/generation'
    }
  },
  
  // Cost Configuration (in credits)
  costs: {
    training: {
      baseSteps: 1000, // Base training steps
      costPerStep: 0.001, // Cost per training step
      setupCost: 5 // Base setup cost
    },
    generation: {
      baseResolution: 1024, // Base resolution
      costPerMegapixel: 10, // Cost per megapixel (10 credits per image)
      costPerStep: 0 // No additional cost per inference step
    },
    // Astria specific costs
    astria: {
      training: {
        baseCost: 8, // Base cost per tune
        costPerImage: 0.5, // Cost per training image
        enhancementMultiplier: 1.3 // Multiplier for enhanced features
      },
      generation: {
        baseCost: 2, // Base generation cost
        costPerMegapixel: 1.5, // Higher due to enhancements
        enhancementCosts: {
          super_resolution: 0.5,
          inpaint_faces: 0.3,
          face_correct: 0.2,
          face_swap: 0.4,
          hires_fix: 0.3
        }
      }
    }
  }
}

/**
 * Calculate training cost with advanced FLUX parameters
 * Updated for maximum quality configuration
 */
export function calculateTrainingCost(params: any): number {
  const { training } = AI_CONFIG.costs
  
  // Base cost calculation
  const steps = params.steps || 2500
  const stepCost = (steps / training.baseSteps) * training.costPerStep * training.baseSteps
  
  // Resolution multiplier - handle string format "512,768,1024"
  let avgResolution = 1024
  if (typeof params.resolution === 'string') {
    const resolutions = params.resolution.split(',').map((r: string) => parseInt(r.trim()))
    avgResolution = resolutions.reduce((a: number, b: number) => a + b, 0) / resolutions.length
  } else if (typeof params.resolution === 'number') {
    avgResolution = params.resolution
  }
  const resolutionMultiplier = Math.pow(avgResolution / 512, 2)
  
  // LoRA rank multiplier (higher rank = more expensive training)
  const loraRank = params.lora_rank || 48
  const rankMultiplier = 1 + (loraRank - 16) / 64 // +15% per rank increase of 16
  
  // Quality multiplier for advanced parameters
  let qualityMultiplier = 1.0
  
  // Advanced optimizations add ~25% to cost
  if (params.autocaption) qualityMultiplier += 0.1
  if (params.gradient_checkpointing) qualityMultiplier += 0.05
  if (params.cache_latents) qualityMultiplier += 0.05
  if (params.mixed_precision === 'fp16') qualityMultiplier += 0.05
  
  const baseCost = training.setupCost + stepCost
  const totalCost = baseCost * resolutionMultiplier * rankMultiplier * qualityMultiplier
  
  return Math.ceil(totalCost)
}

// Legacy function for backward compatibility
export function calculateTrainingCostLegacy(steps: number, resolution: number = 1024): number {
  return calculateTrainingCost({ steps, resolution })
}

// Helper function to calculate generation cost
export function calculateGenerationCost(
  width: number,
  height: number,
  steps: number = 20,
  provider: string = 'replicate'
): number {
  if (provider === 'astria') {
    return calculateAstriaGenerationCost(width, height, steps)
  }

  const { generation } = AI_CONFIG.costs
  const megapixels = (width * height) / (1024 * 1024)
  const resolutionCost = megapixels * generation.costPerMegapixel
  const stepCost = (steps / 20) * generation.costPerStep
  return Math.ceil(resolutionCost + stepCost)
}

// Astria specific cost calculation
export function calculateAstriaGenerationCost(
  width: number,
  height: number,
  steps: number = 30,
  enhancements: {
    super_resolution?: boolean
    inpaint_faces?: boolean
    face_correct?: boolean
    face_swap?: boolean
    hires_fix?: boolean
  } = {}
): number {
  const { astria } = AI_CONFIG.costs
  const megapixels = (width * height) / (1024 * 1024)

  let totalCost = astria.generation.baseCost
  totalCost += megapixels * astria.generation.costPerMegapixel

  // Add enhancement costs
  Object.entries(enhancements).forEach(([enhancement, enabled]) => {
    if (enabled && astria.generation.enhancementCosts[enhancement as keyof typeof astria.generation.enhancementCosts]) {
      totalCost += astria.generation.enhancementCosts[enhancement as keyof typeof astria.generation.enhancementCosts]
    }
  })

  return Math.ceil(totalCost)
}

// Astria specific training cost calculation
export function calculateAstriaTrainingCost(imageCount: number, modelType: string = 'faceid'): number {
  const { astria } = AI_CONFIG.costs

  let baseCost = astria.training.baseCost
  const imageCost = imageCount * astria.training.costPerImage

  // FaceID models are generally cheaper to train
  if (modelType === 'faceid') {
    baseCost *= 0.8
  } else if (modelType === 'flux-lora') {
    baseCost *= astria.training.enhancementMultiplier
  }

  return Math.ceil(baseCost + imageCost)
}

// Model quality scoring
export function calculateModelQuality(
  photoCount: number,
  avgResolution: number,
  diversityScore: number
): number {
  const photoScore = Math.min(photoCount / 15, 1) * 40 // Max 40 points for photos
  const resolutionScore = Math.min(avgResolution / 1024, 1) * 30 // Max 30 points for resolution
  const diversityScorePoints = diversityScore * 30 // Max 30 points for diversity
  
  return Math.round(photoScore + resolutionScore + diversityScorePoints)
}

// Helper functions for model parameter mapping
export function detectFluxModelType(modelVersion: string): string {
  if (modelVersion.includes('flux-1.1-pro-ultra')) return 'flux-ultra'
  if (modelVersion.includes('flux-pro')) return 'flux-pro'
  if (modelVersion.includes('flux-dev')) return 'flux-dev'
  if (modelVersion.includes('flux-schnell')) return 'flux-schnell'
  return 'flux-schnell' // default fallback
}

export function getModelParams(modelType: string) {
  return AI_CONFIG.generation.modelParams[modelType as keyof typeof AI_CONFIG.generation.modelParams]
}

export function mapParametersForModel(modelType: string, settings: any) {
  const modelParams = getModelParams(modelType)
  if (!modelParams) {
    console.warn(`⚠️ Unknown model type: ${modelType}, falling back to original settings`)
    return settings
  }

  const mapped: any = {}
  
  // Common parameters that all models need
  mapped.prompt = settings.prompt
  mapped.seed = settings.seed
  mapped.num_outputs = settings.num_outputs || 1
  
  // Handle FLUX Ultra special case (uses aspect_ratio)
  if (modelType === 'flux-ultra') {
    mapped.aspect_ratio = calculateAspectRatio(settings.width || 1024, settings.height || 1024)
    mapped.safety_tolerance = settings.safety_tolerance || 2
    mapped.output_quality = settings.output_quality || 95
    mapped.raw_mode = settings.raw_mode || false
    mapped.output_format = settings.output_format || 'jpg'
  } else {
    // Standard FLUX models use width/height
    mapped.width = settings.width || 1024
    mapped.height = settings.height || 1024
    
    // Map steps parameter
    if (modelParams.parameterName) {
      const steps = Math.min(
        settings.steps || modelParams.defaultSteps,
        modelParams.maxSteps
      )
      mapped[modelParams.parameterName] = steps
    }
    
    // Map guidance parameter
    if (modelParams.guidanceName) {
      const guidance = Math.min(
        settings.guidance_scale || modelParams.defaultGuidance,
        modelParams.maxGuidance
      )
      mapped[modelParams.guidanceName] = guidance
    }
    
    // FLUX Pro specific parameters
    if (modelType === 'flux-pro' && modelParams.supportsSafetyTolerance) {
      mapped.safety_tolerance = settings.safety_tolerance || 2
      mapped.output_format = settings.output_format || 'png'
      mapped.output_quality = settings.output_quality || 95
    }
  }
  
  return mapped
}

export function calculateAspectRatio(width: number, height: number): string {
  const ratio = width / height
  
  // Map common aspect ratios to FLUX Ultra supported formats
  const ratioMap: { [key: string]: string } = {
    '2.33': '21:9',  // Ultra wide
    '1.78': '16:9',  // Standard widescreen
    '1.50': '3:2',   // Photography standard
    '1.33': '4:3',   // Traditional
    '1.25': '5:4',   // Square-ish
    '1.00': '1:1',   // Perfect square
    '0.80': '4:5',   // Portrait
    '0.75': '3:4',   // Portrait traditional
    '0.67': '2:3',   // Portrait photography
    '0.56': '9:16',  // Mobile portrait
    '0.43': '9:21'   // Ultra tall
  }
  
  // Find closest match
  const ratioString = ratio.toFixed(2)
  if (ratioMap[ratioString]) {
    return ratioMap[ratioString]
  }
  
  // Find closest ratio by comparing differences
  let closestRatio = '1:1'
  let smallestDiff = Infinity
  
  for (const [key, value] of Object.entries(ratioMap)) {
    const diff = Math.abs(parseFloat(key) - ratio)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closestRatio = value
    }
  }
  
  return closestRatio
}