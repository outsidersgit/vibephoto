import { VIDEO_CONFIG, VideoDuration, VideoQuality, VideoAspectRatio, UserPlan, VideoGenerationRequest } from './config'

/**
 * Calculate credits needed for video generation
 */
export function calculateVideoCredits(
  duration: VideoDuration,
  quality: VideoQuality
): number {
  const baseCost = VIDEO_CONFIG.costs.base[duration]
  const qualityMultiplier = VIDEO_CONFIG.costs.qualityMultiplier[quality]
  return Math.ceil(baseCost * qualityMultiplier)
}

/**
 * Get estimated processing time
 */
export function getEstimatedProcessingTime(
  duration: VideoDuration,
  quality: VideoQuality
): number {
  return VIDEO_CONFIG.estimatedTimes[quality][duration]
}

/**
 * Validate user can create video based on plan limits
 */
export function validateUserVideoLimits(
  userPlan: UserPlan,
  videosCreatedToday: number,
  duration: VideoDuration,
  quality: VideoQuality,
  concurrentJobs: number
): {
  canCreate: boolean
  reason?: string
  upgradeRequired?: boolean
} {
  const limits = VIDEO_CONFIG.planLimits[userPlan]

  // Check daily limit
  if (videosCreatedToday >= limits.maxVideosPerDay) {
    return {
      canCreate: false,
      reason: `Limite diário atingido. Máximo ${limits.maxVideosPerDay} vídeos por dia no plano ${userPlan}.`,
      upgradeRequired: true
    }
  }

  // Check duration limit
  if (duration > limits.maxDuration) {
    return {
      canCreate: false,
      reason: `Duração não suportada no plano ${userPlan}. Máximo ${limits.maxDuration}s.`,
      upgradeRequired: true
    }
  }

  // Check pro quality access
  if (quality === 'pro' && !limits.allowPro) {
    return {
      canCreate: false,
      reason: `Qualidade Pro não disponível no plano ${userPlan}.`,
      upgradeRequired: true
    }
  }

  // Check concurrent jobs
  if (concurrentJobs >= limits.maxConcurrentJobs) {
    return {
      canCreate: false,
      reason: `Máximo de ${limits.maxConcurrentJobs} vídeos processando simultaneamente no plano ${userPlan}.`
    }
  }

  return { canCreate: true }
}

/**
 * Validate image for video generation
 */
export function validateSourceImage(
  imageUrl: string,
  width?: number,
  height?: number
): {
  isValid: boolean
  reason?: string
} {
  // Check URL format
  if (!imageUrl || typeof imageUrl !== 'string') {
    return {
      isValid: false,
      reason: 'URL da imagem inválida'
    }
  }

  // Check if it's a valid HTTP/HTTPS URL
  try {
    const url = new URL(imageUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        isValid: false,
        reason: 'URL deve ser HTTP ou HTTPS'
      }
    }
  } catch {
    return {
      isValid: false,
      reason: 'Formato de URL inválido'
    }
  }

  // Check image dimensions if provided
  if (width && height) {
    const { minImageSize, maxImageSize } = VIDEO_CONFIG.validation

    if (width < minImageSize.width || height < minImageSize.height) {
      return {
        isValid: false,
        reason: `Imagem muito pequena. Mínimo ${minImageSize.width}x${minImageSize.height}px`
      }
    }

    if (width > maxImageSize.width || height > maxImageSize.height) {
      return {
        isValid: false,
        reason: `Imagem muito grande. Máximo ${maxImageSize.width}x${maxImageSize.height}px`
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate prompt text (required parameter for Kling v2.1)
 */
export function validatePrompt(prompt: any): {
  isValid: boolean
  reason?: string
} {
  // Check if prompt exists and is string
  if (prompt === undefined || prompt === null) {
    return {
      isValid: false,
      reason: 'Prompt é obrigatório e não pode ser vazio'
    }
  }

  if (typeof prompt !== 'string') {
    return {
      isValid: false,
      reason: 'Prompt deve ser uma string'
    }
  }

  const trimmed = prompt.trim()
  if (trimmed.length === 0) {
    return {
      isValid: false,
      reason: 'Prompt não pode estar vazio'
    }
  }

  if (trimmed.length > VIDEO_CONFIG.options.maxPromptLength) {
    return {
      isValid: false,
      reason: `Prompt muito longo. Máximo ${VIDEO_CONFIG.options.maxPromptLength} caracteres`
    }
  }

  return { isValid: true }
}

/**
 * Validate negative prompt
 */
export function validateNegativePrompt(negativePrompt?: string): {
  isValid: boolean
  reason?: string
} {
  if (!negativePrompt) {
    return { isValid: true }
  }

  if (typeof negativePrompt !== 'string') {
    return {
      isValid: false,
      reason: 'Negative prompt deve ser texto'
    }
  }

  if (negativePrompt.length > VIDEO_CONFIG.options.maxNegativePromptLength) {
    return {
      isValid: false,
      reason: `Negative prompt muito longo. Máximo ${VIDEO_CONFIG.options.maxNegativePromptLength} caracteres`
    }
  }

  return { isValid: true }
}

/**
 * Generate enhanced prompt based on template and user input
 */
export function generateEnhancedPrompt(
  userPrompt: string,
  template?: keyof typeof VIDEO_CONFIG.promptTemplates,
  aspectRatio?: VideoAspectRatio
): string {
  let enhancedPrompt = userPrompt.trim()

  // Add template if specified
  if (template && VIDEO_CONFIG.promptTemplates[template]) {
    const templatePrompt = VIDEO_CONFIG.promptTemplates[template].prompt
    enhancedPrompt = `${templatePrompt}, ${enhancedPrompt}`
  }

  // Add aspect ratio specific enhancements
  if (aspectRatio === '9:16') {
    enhancedPrompt += ', vertical composition, portrait orientation'
  } else if (aspectRatio === '16:9') {
    enhancedPrompt += ', cinematic composition, landscape orientation'
  } else if (aspectRatio === '1:1') {
    enhancedPrompt += ', square composition, balanced framing'
  }

  return enhancedPrompt
}

/**
 * Get optimal aspect ratio for image dimensions
 */
export function getOptimalAspectRatio(
  imageWidth: number,
  imageHeight: number
): VideoAspectRatio {
  const ratio = imageWidth / imageHeight

  if (ratio > 1.5) {
    return '16:9'  // Landscape
  } else if (ratio < 0.75) {
    return '9:16'  // Portrait
  } else {
    return '1:1'   // Square
  }
}

/**
 * Format processing time for display
 */
export function formatProcessingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (remainingSeconds === 0) {
    return `${minutes}min`
  }
  
  return `${minutes}min ${remainingSeconds}s`
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Generate video filename based on parameters
 */
export function generateVideoFilename(
  prompt: string,
  duration: VideoDuration,
  quality: VideoQuality
): string {
  // Clean prompt for filename
  const cleanPrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)
  
  const timestamp = Date.now()
  return `video-${cleanPrompt}-${duration}s-${quality}-${timestamp}.mp4`
}

/**
 * Check if URL is a temporary Replicate URL
 */
export function isTemporaryUrl(url: string): boolean {
  return url.includes('replicate.delivery') || url.includes('pbxt.replicate.delivery')
}

/**
 * Extract video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    return pathParts[pathParts.length - 1] || null
  } catch {
    return null
  }
}

/**
 * Generate thumbnail URL from video URL (if supported by storage)
 */
export function generateThumbnailUrl(videoUrl: string): string {
  // For now, we'll use a placeholder or extract first frame
  // This can be enhanced based on storage provider capabilities
  return videoUrl.replace(/\.(mp4|mov|avi)$/i, '_thumb.jpg')
}

/**
 * Normalize video generation request with official Kling v2.1 defaults
 */
export function normalizeVideoGenerationRequest(request: any): VideoGenerationRequest {
  try {
    console.log('🔧 Normalizing request:', request)
    
    // Ensure request is an object
    if (!request || typeof request !== 'object') {
      throw new Error('Request must be an object')
    }
    
    // Debug: Log the mapping process
    console.log('🔍 Mapping video request fields:', {
      'request.start_image': request.start_image,
      'request.sourceImageUrl': request.sourceImageUrl,
      'final_sourceImageUrl': request.start_image || request.sourceImageUrl || undefined
    })

    const normalized = {
      sourceImageUrl: request.start_image || request.sourceImageUrl || undefined, // start_image for image-to-video, undefined for text-to-video
      prompt: request.prompt || '', // Required, but provide default to avoid errors
      negativePrompt: request.negativePrompt || '', // Optional, default ''
      duration: (request.duration && typeof request.duration === 'number') ? request.duration : 5, // Optional, default 5
      aspectRatio: (request.aspectRatio && typeof request.aspectRatio === 'string') ? request.aspectRatio : '16:9', // Optional, default '16:9'
      quality: (request.quality && typeof request.quality === 'string') ? request.quality : 'standard', // Internal parameter
      template: request.template || undefined // Optional template
    }
    
    console.log('✅ Normalized result:', normalized)
    return normalized
    
  } catch (error) {
    console.error('❌ Error in normalizeVideoGenerationRequest:', error)
    // Return a safe default to avoid API crashes
    return {
      sourceImageUrl: request?.start_image || request?.sourceImageUrl || undefined,
      prompt: request?.prompt || '',
      negativePrompt: '',
      duration: 5,
      aspectRatio: '16:9',
      quality: 'standard',
      template: undefined
    }
  }
}

/**
 * Validate video generation request according to Kling v2.1 official docs
 */
export function validateVideoGenerationRequest(request: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate prompt (required)
  const promptValidation = validatePrompt(request.prompt)
  if (!promptValidation.isValid) {
    errors.push(promptValidation.reason!)
  }

  // Validate source image (optional - for image-to-video)
  if (request.sourceImageUrl) {
    const imageValidation = validateSourceImage(request.sourceImageUrl)
    if (!imageValidation.isValid) {
      errors.push(imageValidation.reason!)
    }
  }

  // Validate negative prompt (optional)
  if (request.negativePrompt !== undefined) {
    const negativePromptValidation = validateNegativePrompt(request.negativePrompt)
    if (!negativePromptValidation.isValid) {
      errors.push(negativePromptValidation.reason!)
    }
  }

  // Validate duration (optional, defaults to 5)
  if (request.duration !== undefined) {
    if (!VIDEO_CONFIG.options.durations.includes(request.duration)) {
      errors.push(`Duração inválida. Deve ser ${VIDEO_CONFIG.options.durations.join(' ou ')} segundos`)
    }
    if (typeof request.duration !== 'number') {
      errors.push('Duração deve ser um número (5 ou 10)')
    }
  }

  // Validate aspect ratio (optional, defaults to "16:9")
  // Note: aspect_ratio is ignored when start_image is provided
  if (request.aspectRatio !== undefined) {
    if (!VIDEO_CONFIG.options.aspectRatios.includes(request.aspectRatio)) {
      errors.push(`Aspect ratio inválido. Deve ser ${VIDEO_CONFIG.options.aspectRatios.join(', ')}`)
    }
    if (typeof request.aspectRatio !== 'string') {
      errors.push('Aspect ratio deve ser uma string')
    }
  }

  // Validate quality (internal parameter, not sent to Kling API)
  if (request.quality !== undefined) {
    if (!VIDEO_CONFIG.options.qualities.includes(request.quality)) {
      errors.push(`Qualidade inválida. Deve ser ${VIDEO_CONFIG.options.qualities.join(' ou ')}`)
    }
  }

  // Special validation: aspect_ratio is ignored when start_image is provided
  if (request.sourceImageUrl && request.aspectRatio) {
    console.log('⚠️ Note: aspect_ratio will be ignored because start_image is provided')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate that input conforms to Kling v2.1 API schema exactly
 */
export function validateKlingApiInput(input: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Required: prompt (string)
  if (!input.prompt || typeof input.prompt !== 'string') {
    errors.push('prompt is required and must be a string')
  }

  // Optional: duration (integer, 5 or 10)
  if (input.duration !== undefined) {
    if (!Number.isInteger(input.duration) || ![5, 10].includes(input.duration)) {
      errors.push('duration must be an integer (5 or 10)')
    }
  }

  // Optional: start_image (string URI)
  if (input.start_image !== undefined) {
    if (typeof input.start_image !== 'string') {
      errors.push('start_image must be a string (URI)')
    } else {
      try {
        new URL(input.start_image)
      } catch {
        errors.push('start_image must be a valid URI')
      }
    }
  }

  // Optional: aspect_ratio (string)
  if (input.aspect_ratio !== undefined) {
    if (typeof input.aspect_ratio !== 'string') {
      errors.push('aspect_ratio must be a string')
    } else if (!['16:9', '9:16', '1:1'].includes(input.aspect_ratio)) {
      errors.push('aspect_ratio must be one of: 16:9, 9:16, 1:1')
    }
  }

  // Optional: negative_prompt (string)
  if (input.negative_prompt !== undefined && typeof input.negative_prompt !== 'string') {
    errors.push('negative_prompt must be a string')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}