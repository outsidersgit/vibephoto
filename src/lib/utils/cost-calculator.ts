import { MediaOperationType } from '@/types'
import {
  CREDIT_COSTS,
  getImageGenerationCost,
  getImageEditCost,
  getVideoGenerationCost,
  EditorResolution
} from '@/lib/credits/pricing'

/**
 * Calculate the cost in credits for different media operations
 */
export function calculateOperationCost(
  operationType: MediaOperationType,
  metadata?: {
    duration?: number
    packageType?: string
    estimatedCost?: number
    resolution?: string // '4k' ou 'standard'
    [key: string]: any
  }
): number {
  if (metadata?.estimatedCost && metadata.estimatedCost > 0) {
    return metadata.estimatedCost
  }

  switch (operationType) {
    case 'generated':
      // Regular generation: 10 créditos each
      // Package-specific costs could be different
      if (metadata?.packageType) {
        return getPackageCost(metadata.packageType)
      }
      return getImageGenerationCost(metadata?.variations || 1)


    case 'edited':
      // Edit costs: 20 créditos (standard) ou 30 créditos (4K)
      const editorResolution: EditorResolution = metadata?.resolution === '4k' ? '4k' : 'standard'
      return getImageEditCost(metadata?.imageCount || 1, editorResolution)

    case 'video':
      // Video costs based on duration
      if (metadata?.duration) {
        return getVideoGenerationCost(metadata.duration)
      }
      return getVideoGenerationCost(5) // default to 5s cost

    default:
      return 0
  }
}

/**
 * Get package-specific generation costs
 */
function getPackageCost(packageType: string): number {
  const packageCosts: Record<string, number> = {
    'quiet-luxury': CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT,
    'mirror-selfie': CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT,
    'summer-vibes': CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT,
    'business-professional': 12,
    'casual-lifestyle': 8,
    'artistic-portrait': CREDIT_COSTS.IMAGE_EDIT_PER_IMAGE,
    // Add more package types as needed
  }

  return packageCosts[packageType] || CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT // default to standard generation cost
}

/**
 * Format cost display with proper pluralization
 */
export function formatCostDisplay(cost: number): string {
  return `${cost} ${cost === 1 ? 'crédito' : 'créditos'}`
}

/**
 * Get cost description based on operation type
 */
export function getCostDescription(operationType: MediaOperationType, metadata?: any): string {
  const cost = calculateOperationCost(operationType, metadata)
  return formatCostDisplay(cost)
}