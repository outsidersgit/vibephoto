/**
 * Status mapping utilities
 * 
 * Replicate API uses lowercase status: 'succeeded', 'failed', 'processing', etc.
 * Database/Prisma uses UPPERCASE enums: 'COMPLETED', 'FAILED', 'PROCESSING', etc.
 */

// Replicate status types (lowercase)
export type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

// Database status types (UPPERCASE)
export type GenerationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type VideoStatus = 'STARTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

/**
 * Maps Replicate API status to Database GenerationStatus
 */
export function mapReplicateToGenerationStatus(replicateStatus: string): GenerationStatus {
  switch (replicateStatus.toLowerCase()) {
    case 'starting':
    case 'processing':
      return 'PROCESSING'
    case 'succeeded':
      return 'COMPLETED'
    case 'failed':
      return 'FAILED'
    default:
      return 'PROCESSING' // Default fallback
  }
}

/**
 * Maps Replicate API status to Database VideoStatus
 */
export function mapReplicateToVideoStatus(replicateStatus: string): VideoStatus {
  switch (replicateStatus.toLowerCase()) {
    case 'starting':
      return 'STARTING'
    case 'processing':
      return 'PROCESSING'
    case 'succeeded':
      return 'COMPLETED'
    case 'failed':
      return 'FAILED'
    case 'canceled':
    case 'cancelled':
      return 'CANCELLED'
    default:
      return 'STARTING' // Default fallback
  }
}

/**
 * Maps Database status to Replicate-compatible status (for API responses)
 */
export function mapDatabaseToReplicateStatus(dbStatus: string): ReplicateStatus {
  switch (dbStatus.toUpperCase()) {
    case 'STARTING':
      return 'starting'
    case 'PROCESSING':
      return 'processing'
    case 'COMPLETED':
      return 'succeeded'
    case 'FAILED':
      return 'failed'
    case 'CANCELLED':
      return 'canceled'
    case 'PENDING':
      return 'processing' // Map pending to processing for API consistency
    default:
      return 'processing' // Default fallback
  }
}

/**
 * Checks if Replicate status indicates completion
 */
export function isReplicateStatusCompleted(status: string): boolean {
  return status.toLowerCase() === 'succeeded'
}

/**
 * Checks if Replicate status indicates failure
 */
export function isReplicateStatusFailed(status: string): boolean {
  return status.toLowerCase() === 'failed'
}

/**
 * Checks if Replicate status indicates processing
 */
export function isReplicateStatusProcessing(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'starting' || s === 'processing'
}

/**
 * Checks if Database status indicates completion
 */
export function isDatabaseStatusCompleted(status: string): boolean {
  return status.toUpperCase() === 'COMPLETED'
}

/**
 * Checks if Database status indicates failure
 */
export function isDatabaseStatusFailed(status: string): boolean {
  return status.toUpperCase() === 'FAILED'
}

/**
 * Checks if Database status indicates processing
 */
export function isDatabaseStatusProcessing(status: string): boolean {
  const s = status.toUpperCase()
  return s === 'STARTING' || s === 'PROCESSING' || s === 'PENDING'
}