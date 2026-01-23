import { UPSCALE_CONFIG, UpscaleOptions, UpscalePlanLimits } from './upscale-config'
import { getUpscaleCost } from '@/lib/credits/pricing'

/**
 * Valida se um arquivo de imagem é adequado para upscale
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Verifica formato
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !UPSCALE_CONFIG.supportedFormats.includes(extension)) {
    return {
      isValid: false,
      error: `Formato não suportado. Use: ${UPSCALE_CONFIG.supportedFormats.join(', ')}`
    }
  }

  // Verifica tamanho
  if (file.size > UPSCALE_CONFIG.maxFileSize) {
    const maxSizeMB = UPSCALE_CONFIG.maxFileSize / (1024 * 1024)
    return {
      isValid: false,
      error: `Arquivo muito grande. Máximo: ${maxSizeMB}MB`
    }
  }

  return { isValid: true }
}

/**
 * Valida URL de imagem para upscale
 */
export function validateImageUrl(imageUrl: string): { isValid: boolean; error?: string } {
  try {
    new URL(imageUrl)
    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'URL de imagem inválida'
    }
  }
}

/**
 * Valida opções de upscale conforme parâmetros do Nano Banana Pro
 * Mantém compatibilidade com parâmetros legados do Topaz Labs
 */
export function validateUpscaleOptions(options: UpscaleOptions): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const { ranges } = UPSCALE_CONFIG

  // Validações Nano Banana Pro (apenas parâmetros relevantes)
  // output_format
  if (options.output_format && !UPSCALE_CONFIG.options.output_formats.includes(options.output_format)) {
    errors.push(`Formato de saída deve ser um de: ${UPSCALE_CONFIG.options.output_formats.join(', ')}`)
  }

  // resolution (opcional, default 4K)
  if (options.resolution && !UPSCALE_CONFIG.options.resolutions.includes(options.resolution)) {
    errors.push(`Resolução deve ser um de: ${UPSCALE_CONFIG.options.resolutions.join(', ')}`)
  }

  // aspect_ratio (opcional, default match_input_image)
  if (options.aspect_ratio && !UPSCALE_CONFIG.options.aspect_ratios.includes(options.aspect_ratio)) {
    errors.push(`Aspect ratio deve ser um de: ${UPSCALE_CONFIG.options.aspect_ratios.join(', ')}`)
  }

  // safety_filter_level (opcional, default block_only_high)
  if (options.safety_filter_level && !UPSCALE_CONFIG.options.safety_filter_levels.includes(options.safety_filter_level)) {
    errors.push(`Safety filter deve ser um de: ${UPSCALE_CONFIG.options.safety_filter_levels.join(', ')}`)
  }

  // Parâmetros legados (Topaz Labs) são ignorados silenciosamente
  if (options.upscale_factor || options.scale_factor || options.enhance_model ||
      options.face_enhancement || options.subject_detection) {
    console.log('ℹ️ Parâmetros legados (Topaz Labs) ignorados - usando Nano Banana Pro 4K')
  }

  // Backward compatibility: scale_factor legado é ignorado (Nano Banana Pro usa 4K fixo)
  // Não valida mais scale_factor para permitir transição suave do código legado

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Verifica se um usuário pode fazer upscale baseado no seu plano
 */
export function canUserUpscale(userPlan: UpscalePlan, scaleFactor: number, dailyUsage: number): {
  canUpscale: boolean
  reason?: string
} {
  const limits = UPSCALE_CONFIG.planLimits[userPlan]

  // Verifica limite diário
  if (dailyUsage >= limits.dailyLimit) {
    return {
      canUpscale: false,
      reason: `Limite diário atingido (${limits.dailyLimit} upscales/dia para o plano ${userPlan})`
    }
  }

  // Verifica fator de escala máximo
  if (scaleFactor > limits.maxScaleFactor) {
    return {
      canUpscale: false,
      reason: `Fator de escala ${scaleFactor}x não disponível no plano ${userPlan} (máximo: ${limits.maxScaleFactor}x)`
    }
  }

  return { canUpscale: true }
}

/**
 * Calcula créditos necessários para upscale
 * Atualizado para Nano Banana Pro: 30 créditos por imagem (4K upscale)
 */
export function calculateUpscaleCredits(imagesCount: number): number {
  return getUpscaleCost(imagesCount)
}

/**
 * Mescla opções do usuário com defaults
 */
export function mergeUpscaleOptions(userOptions: Partial<UpscaleOptions>): UpscaleOptions {
  return {
    ...UPSCALE_CONFIG.defaults,
    ...userOptions
  } as UpscaleOptions
}

/**
 * Gera um seed aleatório se não fornecido
 */
export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 1000000)
}

/**
 * Estima tempo de processamento baseado no fator de escala
 */
export function estimateProcessingTime(scaleFactor: number): number {
  const baseTime = 30000 // 30 segundos base
  const multiplier = {
    2: 1,
    4: 1.5,
    6: 2.0
  }[scaleFactor] || 1

  return Math.round(baseTime * multiplier)
}

/**
 * Formata resolução estimada após upscale
 */
export function calculateUpscaledResolution(originalWidth: number, originalHeight: number, scaleFactor: number) {
  return {
    width: originalWidth * scaleFactor,
    height: originalHeight * scaleFactor,
    megapixels: (originalWidth * scaleFactor * originalHeight * scaleFactor) / 1000000
  }
}

/**
 * Gera ID único para job de upscale
 */
export function generateUpscaleJobId(): string {
  return `upscale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Verifica se uma URL do Replicate está próxima da expiração
 */
export function isReplicateUrlNearExpiry(url: string, minutesThreshold: number = 10): boolean {
  try {
    // URLs do Replicate têm formato: https://replicate.delivery/pbxt/...
    if (!url.includes('replicate.delivery')) {
      return false // Not a temporary Replicate URL
    }
    
    // URLs temporárias do Replicate expiram em ~1 hora
    // Por simplicidade, consideramos qualquer URL do replicate.delivery como temporária
    return true
  } catch (error) {
    console.error('Error checking URL expiry:', error)
    return false
  }
}

/**
 * Monitora URLs temporárias e alerta sobre expiração iminente
 */
export function monitorUrlExpiration(urls: string[], generationId: string): {
  temporaryUrls: string[]
  needsImmediateStorage: boolean
  expiryWarning: string | null
} {
  const temporaryUrls = urls.filter(url => isReplicateUrlNearExpiry(url))
  const needsImmediateStorage = temporaryUrls.length > 0
  
  let expiryWarning = null
  if (needsImmediateStorage) {
    expiryWarning = `⚠️ WARNING: ${temporaryUrls.length} temporary URLs detected for generation ${generationId}. These URLs will expire in ~1 hour and must be stored permanently immediately.`
    console.warn(expiryWarning)
  }
  
  return {
    temporaryUrls,
    needsImmediateStorage,
    expiryWarning
  }
}

/**
 * Validação abrangente antes de enviar para API
 */
export function comprehensiveInputValidation(
  imageUrl: string,
  options: Partial<UpscaleOptions>,
  userPlan: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validação de URL
  const urlValidation = validateImageUrl(imageUrl)
  if (!urlValidation.isValid) {
    errors.push(urlValidation.error!)
  }
  
  // Validação de opções completas
  const mergedOptions = mergeUpscaleOptions(options)
  const optionsValidation = validateUpscaleOptions(mergedOptions)
  if (!optionsValidation.isValid) {
    errors.push(...optionsValidation.errors)
  }
  
  // Validação específica de tamanho de imagem via URL
  if (imageUrl) {
    try {
      const url = new URL(imageUrl)
      // Check if it's a data URI
      if (url.protocol === 'data:') {
        const dataSizeMatch = imageUrl.match(/data:[^;]+;base64,(.+)/)
        if (dataSizeMatch) {
          const base64Data = dataSizeMatch[1]
          const sizeInBytes = (base64Data.length * 3) / 4
          if (sizeInBytes > UPSCALE_CONFIG.maxFileSize) {
            errors.push(`Data URI too large: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB, max: ${UPSCALE_CONFIG.maxFileSize / 1024 / 1024}MB`)
          }
          if (sizeInBytes > 256 * 1024) {
            warnings.push('Data URI > 256KB: Consider using HTTP URL for better performance')
          }
        }
      }
    } catch (urlError) {
      errors.push('Invalid image URL format')
    }
  }
  
  // Validação de plano do usuário
  const planValidation = canUserUpscale(userPlan as any, mergedOptions.scale_factor, 0)
  if (!planValidation.canUpscale) {
    errors.push(planValidation.reason!)
  }
  
  // Avisos de otimização
  if (mergedOptions.creativity && mergedOptions.creativity > 0.7) {
    warnings.push('High creativity (>0.7) may produce unexpected results. Consider values 0.3-0.6 for better consistency.')
  }
  
  if (mergedOptions.num_inference_steps && mergedOptions.num_inference_steps > 50) {
    warnings.push('High inference steps (>50) will increase processing time significantly.')
  }
  
  if (mergedOptions.scale_factor === 8) {
    warnings.push('8x scaling requires very high quality input images and may fail on low resolution sources.')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}