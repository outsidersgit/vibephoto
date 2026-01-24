export const CREDIT_COSTS = {
  IMAGE_GENERATION_PER_OUTPUT: 10,
  IMAGE_EDIT_PER_IMAGE: 20,      // Custo base do editor
  IMAGE_EDIT_4K_PER_IMAGE: 30,   // Custo do editor em 4K
  VIDEO_DURATION: {
    4: 80,
    6: 120,
    8: 160
  } as Record<number, number>
}

export type VideoDurationSeconds = 4 | 6 | 8
export type EditorResolution = 'standard' | '4k'

export function getImageGenerationCost(variations: number = 1): number {
  const count = Math.max(1, variations)
  return count * CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT
}

export function getImageEditCost(imageCount: number = 1, resolution: EditorResolution = 'standard'): number {
  const count = Math.max(1, imageCount)
  const costPerImage = resolution === '4k'
    ? CREDIT_COSTS.IMAGE_EDIT_4K_PER_IMAGE
    : CREDIT_COSTS.IMAGE_EDIT_PER_IMAGE
  return count * costPerImage
}

export function getVideoGenerationCost(duration: number): number {
  // Normalize to valid durations: 4, 6, or 8 seconds
  if (duration <= 4) return CREDIT_COSTS.VIDEO_DURATION[4]
  if (duration <= 6) return CREDIT_COSTS.VIDEO_DURATION[6]
  return CREDIT_COSTS.VIDEO_DURATION[8]
}

export function formatCredits(amount: number): string {
  return amount.toLocaleString('pt-BR')
}
