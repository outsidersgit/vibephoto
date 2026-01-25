import type { MediaOperationType } from '@/types'
import { getCostDescription } from '@/lib/utils/cost-calculator'

type CostMetadata = {
  estimatedCost?: number
  variations?: number
  imageCount?: number
  duration?: number
  packageType?: string
}

interface CostOverrides {
  operationType?: MediaOperationType
  metadata?: CostMetadata
}

const EDIT_PROMPT_PREFIXES = ['[EDITOR]', '[EDITED]', '[GERADO]', '[STUDIO IA']
const UPSCALE_PROMPT_PREFIXES = ['[UPSCALED]', '[UPSCALING]']

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function ensureMetadataObject(metadata: unknown): Record<string, any> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, any>
  }
  return {}
}

export function resolveOperationTypeFromGeneration(
  generation: any,
  fallback: MediaOperationType = 'generated'
): MediaOperationType {
  if (!generation) {
    return fallback
  }

  const rawOperation = typeof generation.operationType === 'string'
    ? generation.operationType.toLowerCase()
    : undefined

  if (rawOperation === 'video') {
    return 'video'
  }

  if (rawOperation === 'upscale' || rawOperation === 'upscaled') {
    return 'upscaled'
  }

  if (rawOperation === 'edit' || rawOperation === 'edited') {
    return 'edited'
  }

  if (rawOperation === 'generation' || rawOperation === 'package') {
    return 'generated'
  }

  if (generation.videoUrl || generation.metadata?.mediaType === 'video') {
    return 'video'
  }

  const prompt: string | undefined = generation.prompt
  if (typeof prompt === 'string') {
    if (UPSCALE_PROMPT_PREFIXES.some(prefix => prompt.startsWith(prefix))) {
      return 'upscaled'
    }
    if (EDIT_PROMPT_PREFIXES.some(prefix => prompt.startsWith(prefix))) {
      return 'edited'
    }
  }

  const metadata = ensureMetadataObject(generation.metadata)
  const metadataSource = typeof metadata.source === 'string' ? metadata.source.toLowerCase() : undefined

  if (metadataSource?.includes('editor') || metadataSource === 'edit') {
    return 'edited'
  }

  if (metadataSource === 'upscale' || metadataSource === 'upscaled') {
    return 'upscaled'
  }

  if (metadataSource === 'video') {
    return 'video'
  }

  if (generation.isUpscaled || generation.originalImageUrl) {
    return 'edited'
  }

  return fallback
}

export function extractCostMetadata(generation: any): CostMetadata {
  if (!generation) {
    return {}
  }

  const metadata = ensureMetadataObject(generation.metadata)

  const estimatedCost =
    parseNumber(metadata.cost) ??
    parseNumber(metadata.estimatedCost) ??
    parseNumber(generation.estimatedCost)

  const variations =
    parseNumber(metadata.variations) ??
    parseNumber(generation.variations)

  const imageCount =
    parseNumber(metadata.imageCount) ??
    (Array.isArray(generation.imageUrls) ? generation.imageUrls.length : undefined)

  const duration =
    parseNumber(metadata.duration) ??
    parseNumber(metadata.videoDuration) ??
    parseNumber(generation.duration)

  const packageType =
    typeof metadata.packageType === 'string'
      ? metadata.packageType
      : typeof generation.style === 'string'
        ? generation.style
        : undefined

  const costMetadata: CostMetadata = {}

  if (estimatedCost !== undefined) {
    costMetadata.estimatedCost = estimatedCost
  }

  if (variations !== undefined) {
    costMetadata.variations = variations
  }

  if (imageCount !== undefined) {
    costMetadata.imageCount = imageCount
  }

  if (duration !== undefined) {
    costMetadata.duration = duration
  }

  if (packageType) {
    costMetadata.packageType = packageType
  }

  return costMetadata
}

export function getGenerationCostDescription(
  generation: any,
  overrides?: CostOverrides
): string {
  const operationType =
    overrides?.operationType ??
    resolveOperationTypeFromGeneration(generation)

  const baseMetadata = extractCostMetadata(generation)
  const mergedMetadata: CostMetadata = {
    ...baseMetadata,
    ...(overrides?.metadata ?? {})
  }

  return getCostDescription(operationType, mergedMetadata)
}

