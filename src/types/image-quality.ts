/**
 * Image Quality Analysis Types
 * For validating training photos before fine-tuning AI models
 */

export type CriticalIssue =
  | 'hat_or_cap'
  | 'sunglasses'
  | 'face_covered'
  | 'multiple_people'
  | 'making_faces'
  | 'eyes_closed'
  | 'heavy_filters'
  | 'hand_covering_face'
  | 'extreme_angle'
  | 'mask'

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
  /** Overall score 0-100 */
  score: number

  /** Technical quality score 0-25 (sharpness, lighting, resolution) */
  technicalQuality: number

  /** Composition score 0-25 (framing, background, distance) */
  composition: number

  /** Fine-tuning readiness score 0-50 (most important - no hats, glasses, other people, etc) */
  finetuningReadiness: number

  /** Critical issues that significantly harm fine-tuning */
  criticalIssues: CriticalIssue[]

  /** Minor technical issues */
  minorIssues: MinorIssue[]

  /** Overall feedback in Portuguese */
  feedback: string

  /** Specific recommendations to improve the photo */
  recommendations: string[]

  /** Quality status based on score */
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

  /** Summary statistics */
  summary: {
    total: number
    perfect: number      // 90-100
    excellent: number    // 70-89
    acceptable: number   // 50-69
    poor: number         // 0-49
    averageScore: number
    recommendedCount: number  // score >= 70
    acceptableCount: number   // score >= 50
  }

  /** Overall recommendation */
  overallRecommendation: string
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
  hat_or_cap: 'Boné ou chapéu',
  sunglasses: 'Óculos escuros',
  face_covered: 'Rosto coberto',
  multiple_people: 'Várias pessoas na foto',
  making_faces: 'Fazendo careta',
  eyes_closed: 'Olhos fechados',
  heavy_filters: 'Filtros pesados',
  hand_covering_face: 'Mão cobrindo o rosto',
  extreme_angle: 'Ângulo muito extremo',
  mask: 'Máscara facial'
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
