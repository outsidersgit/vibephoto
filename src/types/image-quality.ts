/**
 * Image Quality Analysis Types
 * For validating training photos before fine-tuning AI models
 */

export type CriticalIssue =
  | 'ai_generated'
  | 'multiple_people'
  | 'making_faces'
  | 'heavy_filters'
  | 'low_light'
  | 'blurry'
  | 'hat_or_cap'
  | 'sunglasses'
  | 'extreme_angle'
  | 'face_cut_off'
  | 'low_quality'
  | 'face_covered'

export type MinorIssue =
  | 'slight_blur'
  | 'low_light'
  | 'busy_background'
  | 'low_resolution'
  | 'overexposed'
  | 'underexposed'
  | 'artifacts'
  | 'poor_framing'

export type QualityStatus = 'perfect' | 'excellent' | 'acceptable' | 'poor'

export interface ImageQualityScore {
  /** Whether the photo has any issues (simplified) */
  hasIssues: boolean

  /** Critical issues that significantly harm fine-tuning */
  criticalIssues: CriticalIssue[]

  /** Minor technical issues */
  minorIssues: MinorIssue[]

  /** Brief explanation of issues found (if any) */
  issuesSummary?: string

  // Legacy fields for backward compatibility (will be removed)
  /** @deprecated Use hasIssues instead */
  score: number
  /** @deprecated */
  technicalQuality: number
  /** @deprecated */
  composition: number
  /** @deprecated */
  finetuningReadiness: number
  /** @deprecated */
  feedback: string
  /** @deprecated */
  recommendations: string[]
  /** @deprecated */
  status: QualityStatus
}

export interface ImageQualityAnalysisResult {
  /** Original filename */
  filename: string

  /** Quality score and details */
  quality: ImageQualityScore

  /** Whether the image is acceptable (score >= 50) */
  isAcceptable: boolean

  /** Whether the image is recommended (score >= 70) */
  isRecommended: boolean

  /** Processing time in milliseconds */
  processingTime?: number
}

export interface BatchQualityAnalysisResult {
  /** Individual results for each image */
  results: ImageQualityAnalysisResult[]

  /** Summary statistics (simplified) */
  summary: {
    totalImages: number
    photosWithIssues: number
    photosOk: number
    processingTime?: number

    // Legacy for backward compatibility
    /** @deprecated */
    averageScore?: number
    /** @deprecated */
    acceptableCount?: number
    /** @deprecated */
    recommendedCount?: number
  }
}

export interface ImageQualityAnalysisOptions {
  /** Type of photo being analyzed */
  photoType: 'face' | 'half_body' | 'full_body'

  /** Model class for context-specific analysis */
  modelClass?: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'

  /** Include detailed technical analysis */
  includeDetails?: boolean
}

/** Helper function to get status based on score */
export function getQualityStatus(score: number): QualityStatus {
  if (score >= 90) return 'perfect'
  if (score >= 70) return 'excellent'
  if (score >= 50) return 'acceptable'
  return 'poor'
}

/** Helper function to get status color */
export function getStatusColor(status: QualityStatus): string {
  switch (status) {
    case 'perfect': return 'text-green-700 bg-green-100 border-green-300'
    case 'excellent': return 'text-green-600 bg-green-50 border-green-200'
    case 'acceptable': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'poor': return 'text-red-600 bg-red-50 border-red-200'
  }
}

/** Helper function to get status icon */
export function getStatusIcon(status: QualityStatus): string {
  switch (status) {
    case 'perfect': return '⭐'
    case 'excellent': return '✅'
    case 'acceptable': return '⚠️'
    case 'poor': return '❌'
  }
}

/** Helper function to get status label */
export function getStatusLabel(status: QualityStatus): string {
  switch (status) {
    case 'perfect': return 'Perfeita'
    case 'excellent': return 'Excelente'
    case 'acceptable': return 'Aceitável'
    case 'poor': return 'Não Recomendada'
  }
}

/** Critical issue descriptions in Portuguese */
export const CRITICAL_ISSUE_LABELS: Record<CriticalIssue, string> = {
  ai_generated: 'Imagem gerada por IA',
  multiple_people: 'Pessoas extras na foto',
  making_faces: 'Careta ou expressão exagerada',
  heavy_filters: 'Filtro digital pesado',
  low_light: 'Iluminação muito ruim',
  blurry: 'Foto muito desfocada',
  hat_or_cap: 'Chapéu/boné cobrindo cabeça',
  sunglasses: 'Óculos escuros',
  extreme_angle: 'Ângulo muito extremo',
  face_cut_off: 'Rosto cortado',
  low_quality: 'Qualidade muito baixa',
  face_covered: 'Rosto coberto (máscara, mão, etc)'
}

/** Minor issue descriptions in Portuguese */
export const MINOR_ISSUE_LABELS: Record<MinorIssue, string> = {
  slight_blur: 'Leve desfoque',
  low_light: 'Pouca iluminação',
  busy_background: 'Fundo muito ocupado',
  low_resolution: 'Resolução baixa',
  overexposed: 'Superexposta',
  underexposed: 'Subexposta',
  artifacts: 'Artefatos de compressão',
  poor_framing: 'Enquadramento ruim'
}
