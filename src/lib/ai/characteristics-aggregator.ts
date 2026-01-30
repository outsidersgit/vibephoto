/**
 * Characteristics Aggregator for Astria Image Inspection
 *
 * Aggregates inspection results from multiple images into a single
 * characteristics object to be sent to Astria training API
 */

export interface AstriaInspectionResult {
  // Descriptive characteristics (used for training)
  name?: 'man' | 'woman' | 'boy' | 'girl' | 'baby' | 'cat' | 'dog' | 'NONE'
  age?: '20 yo' | '30 yo' | '40 yo' | '50 yo' | '60 yo' | '70 yo'
  ethnicity?: string
  eye_color?: string
  hair_color?: string
  hair_length?: string
  hair_style?: string
  facial_hair?: 'mustache' | 'beard' | 'goatee' | 'NONE'
  glasses?: 'glasses' | 'NONE'
  headcover?: 'with head cover' | 'NONE'
  is_bald?: 'bald' | 'NONE'
  body_type?: 'slim body' | 'average body' | 'muscular body' | 'plussize body' | 'NONE'

  // Quality/validation flags (NOT used for training characteristics)
  blurry?: boolean
  includes_multiple_people?: boolean
  wearing_sunglasses?: boolean
  wearing_hat?: boolean
  low_resolution?: boolean
  low_quality?: boolean
  selfie?: boolean
  full_body_image_or_longshot?: boolean
  funny_face?: boolean
}

export interface AggregatedCharacteristics {
  // Descriptive characteristics (sent to training)
  name?: string
  age?: string
  ethnicity?: string
  eye_color?: string
  hair_color?: string
  hair_length?: string
  hair_style?: string
  facial_hair?: string
  glasses?: string
  headcover?: string
  is_bald?: string
  body_type?: string
}

export interface QualityWarnings {
  hasBlurryImages: boolean
  hasMultiplePeople: boolean
  hasSunglasses: boolean
  hasHats: boolean
  hasLowResolution: boolean
  hasLowQuality: boolean
  hasSelfies: boolean
  hasFullBodyInFacePhotos: boolean
  hasFunnyFaces: boolean
  totalImages: number
  problematicImages: number
}

/**
 * Fields to extract for characteristics (descriptive attributes only)
 * Quality flags are excluded - they're for validation/warnings only
 */
const CHARACTERISTIC_FIELDS = [
  'name',
  'age',
  'ethnicity',
  'eye_color',
  'hair_color',
  'hair_length',
  'hair_style',
  'facial_hair',
  'glasses',
  'headcover',
  'is_bald',
  'body_type'
] as const

/**
 * Aggregate inspection results into a single characteristics object
 *
 * Strategy:
 * - For each characteristic field, pick the most frequent value
 * - Ignore 'NONE' and empty values
 * - Return only fields with valid values
 */
export function aggregateCharacteristics(
  inspectionResults: AstriaInspectionResult[]
): AggregatedCharacteristics {
  if (!inspectionResults || inspectionResults.length === 0) {
    return {}
  }

  const aggregated: AggregatedCharacteristics = {}

  for (const field of CHARACTERISTIC_FIELDS) {
    const values = inspectionResults
      .map(result => result[field])
      .filter(value => value && value !== 'NONE' && value.trim() !== '')

    if (values.length === 0) {
      continue
    }

    // Count frequency of each value
    const frequency = new Map<string, number>()
    for (const value of values) {
      const count = frequency.get(value) || 0
      frequency.set(value, count + 1)
    }

    // Get most frequent value
    let maxCount = 0
    let mostFrequent = ''
    for (const [value, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count
        mostFrequent = value
      }
    }

    if (mostFrequent) {
      aggregated[field] = mostFrequent
    }
  }

  return aggregated
}

/**
 * Extract quality warnings from inspection results
 * These are NOT sent to training - used only for UX warnings
 */
export function extractQualityWarnings(
  inspectionResults: AstriaInspectionResult[]
): QualityWarnings {
  if (!inspectionResults || inspectionResults.length === 0) {
    return {
      hasBlurryImages: false,
      hasMultiplePeople: false,
      hasSunglasses: false,
      hasHats: false,
      hasLowResolution: false,
      hasLowQuality: false,
      hasSelfies: false,
      hasFullBodyInFacePhotos: false,
      hasFunnyFaces: false,
      totalImages: 0,
      problematicImages: 0
    }
  }

  const warnings: QualityWarnings = {
    hasBlurryImages: inspectionResults.some(r => r.blurry === true),
    hasMultiplePeople: inspectionResults.some(r => r.includes_multiple_people === true),
    hasSunglasses: inspectionResults.some(r => r.wearing_sunglasses === true),
    hasHats: inspectionResults.some(r => r.wearing_hat === true),
    hasLowResolution: inspectionResults.some(r => r.low_resolution === true),
    hasLowQuality: inspectionResults.some(r => r.low_quality === true),
    hasSelfies: inspectionResults.some(r => r.selfie === true),
    hasFullBodyInFacePhotos: inspectionResults.some(r => r.full_body_image_or_longshot === true),
    hasFunnyFaces: inspectionResults.some(r => r.funny_face === true),
    totalImages: inspectionResults.length,
    problematicImages: 0
  }

  // Count images with any quality issues
  warnings.problematicImages = inspectionResults.filter(result =>
    result.blurry === true ||
    result.includes_multiple_people === true ||
    result.wearing_sunglasses === true ||
    result.wearing_hat === true ||
    result.low_resolution === true ||
    result.low_quality === true ||
    result.funny_face === true
  ).length

  return warnings
}

/**
 * Build warning messages for user based on quality issues
 */
export function buildWarningMessages(warnings: QualityWarnings): string[] {
  const messages: string[] = []

  if (warnings.hasMultiplePeople) {
    messages.push('⚠️ Algumas fotos contêm múltiplas pessoas - isso pode confundir o modelo')
  }

  if (warnings.hasSunglasses) {
    messages.push('⚠️ Algumas fotos têm óculos escuros - isso impede o modelo de aprender características faciais')
  }

  if (warnings.hasHats) {
    messages.push('⚠️ Algumas fotos têm chapéus/bonés - isso cobre características importantes')
  }

  if (warnings.hasBlurryImages) {
    messages.push('⚠️ Algumas fotos estão desfocadas - use imagens nítidas para melhor qualidade')
  }

  if (warnings.hasLowQuality) {
    messages.push('⚠️ Algumas fotos têm baixa qualidade - considere substituir por imagens melhores')
  }

  if (warnings.hasFunnyFaces) {
    messages.push('⚠️ Algumas fotos têm caretas/expressões exageradas - prefira expressões naturais')
  }

  if (messages.length === 0) {
    messages.push('✅ Todas as fotos parecem adequadas para treinamento')
  }

  return messages
}

/**
 * Log aggregation summary for debugging
 */
export function logAggregationSummary(
  inspectionResults: AstriaInspectionResult[],
  characteristics: AggregatedCharacteristics,
  warnings: QualityWarnings
): void {
  console.log('📊 [CHARACTERISTICS_AGGREGATION] Summary:')
  console.log(`   Total images inspected: ${inspectionResults.length}`)
  console.log(`   Characteristics extracted: ${Object.keys(characteristics).length}`)
  console.log(`   Characteristics values:`, JSON.stringify(characteristics, null, 2))
  console.log(`   Quality warnings:`)
  console.log(`     - Problematic images: ${warnings.problematicImages}/${warnings.totalImages}`)
  console.log(`     - Blurry: ${warnings.hasBlurryImages}`)
  console.log(`     - Multiple people: ${warnings.hasMultiplePeople}`)
  console.log(`     - Sunglasses: ${warnings.hasSunglasses}`)
  console.log(`     - Hats: ${warnings.hasHats}`)
  console.log(`     - Low quality: ${warnings.hasLowQuality}`)
}
