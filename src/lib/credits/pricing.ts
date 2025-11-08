export const CREDIT_COSTS = {
  IMAGE_GENERATION_PER_OUTPUT: 10,
  IMAGE_EDIT_PER_IMAGE: 15,
  UPSCALE_PER_IMAGE: 10,
  VIDEO_DURATION: {
    5: 100,
    10: 200
  } as Record<number, number>
}

export type VideoDurationSeconds = 5 | 10

export function getImageGenerationCost(variations: number = 1): number {
  const count = Math.max(1, variations)
  return count * CREDIT_COSTS.IMAGE_GENERATION_PER_OUTPUT
}

export function getImageEditCost(imageCount: number = 1): number {
  const count = Math.max(1, imageCount)
  return count * CREDIT_COSTS.IMAGE_EDIT_PER_IMAGE
}

export function getUpscaleCost(imageCount: number = 1): number {
  const count = Math.max(1, imageCount)
  return count * CREDIT_COSTS.UPSCALE_PER_IMAGE
}

export function getVideoGenerationCost(duration: number): number {
  const normalized = duration === 10 ? 10 : 5
  return CREDIT_COSTS.VIDEO_DURATION[normalized]
}

export function formatCredits(amount: number): string {
  return amount.toLocaleString('pt-BR')
}
