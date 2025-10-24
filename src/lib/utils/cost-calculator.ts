import { MediaOperationType } from '@/types'

/**
 * Calculate the cost in credits for different media operations
 */
export function calculateOperationCost(
  operationType: MediaOperationType,
  metadata?: {
    duration?: number
    packageType?: string
    [key: string]: any
  }
): number {
  switch (operationType) {
    case 'generated':
      // Regular generation: 10 créditos each
      // Package-specific costs could be different
      if (metadata?.packageType) {
        return getPackageCost(metadata.packageType)
      }
      return 10

    case 'upscaled':
      // Upscale costs: 10 créditos
      return 10

    case 'edited':
      // Edit costs: 15 créditos
      return 15

    case 'video':
      // Video costs based on duration
      if (metadata?.duration) {
        return metadata.duration <= 5 ? 100 : 200
      }
      return 100 // default to 5s cost

    default:
      return 0
  }
}

/**
 * Get package-specific generation costs
 */
function getPackageCost(packageType: string): number {
  const packageCosts: Record<string, number> = {
    'quiet-luxury': 10,
    'mirror-selfie': 10,
    'summer-vibes': 10,
    'business-professional': 12,
    'casual-lifestyle': 8,
    'artistic-portrait': 15,
    // Add more package types as needed
  }

  return packageCosts[packageType] || 10 // default to 10 if package not found
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