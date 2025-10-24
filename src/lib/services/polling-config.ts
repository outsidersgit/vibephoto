/**
 * Polling Configuration and Types
 * Centralized configuration for job-specific polling system
 */

export type JobType = 'generation' | 'training' | 'upscale' | 'video' | 'edit'
export type ProviderType = 'astria' | 'replicate' | 'local'
export type JobStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'timeout'

export interface ActiveJob {
  jobId: string
  type: JobType
  provider: ProviderType
  generationId?: string
  modelId?: string
  userId: string
  startTime: Date
  maxTimeout: number
  intervalMs: number
  attempts: number
  maxAttempts: number
  timeoutId?: NodeJS.Timeout
}

export interface JobStopCriteria {
  provider: ProviderType
  checkStatus: (response: any) => { shouldStop: boolean; reason: string; status: JobStatus }
  extractUrls: (response: any) => string[]
}

/**
 * Timeout configurations by job type (in milliseconds)
 */
export const JOB_TIMEOUTS: Record<string, number> = {
  // Astria timeouts
  'astria-training': 90 * 60 * 1000,    // 90 minutes
  'astria-generation': 5 * 60 * 1000,   // 5 minutes
  'astria-upscale': 5 * 60 * 1000,      // 5 minutes
  'astria-video': 10 * 60 * 1000,       // 10 minutes
  'astria-edit': 5 * 60 * 1000,         // 5 minutes

  // Replicate timeouts
  'replicate-training': 60 * 60 * 1000,  // 60 minutes
  'replicate-generation': 5 * 60 * 1000, // 5 minutes
  'replicate-upscale': 5 * 60 * 1000,    // 5 minutes
  'replicate-video': 10 * 60 * 1000,     // 10 minutes
  'replicate-edit': 5 * 60 * 1000,       // 5 minutes

  // Local/fallback timeouts
  'local-generation': 2 * 60 * 1000,     // 2 minutes
} as const

/**
 * Polling intervals by provider (in milliseconds)
 */
export const POLLING_INTERVALS: Record<ProviderType, number> = {
  astria: 5000,      // 5 seconds for Astria
  replicate: 3000,   // 3 seconds for Replicate
  local: 1000        // 1 second for local/mock
} as const

/**
 * Maximum attempts before giving up
 */
export const MAX_ATTEMPTS: Record<string, number> = {
  'astria-training': 1080,     // 90min / 5s = 1080 attempts
  'astria-generation': 60,     // 5min / 5s = 60 attempts
  'astria-upscale': 60,        // 5min / 5s = 60 attempts
  'astria-video': 120,         // 10min / 5s = 120 attempts
  'astria-edit': 60,           // 5min / 5s = 60 attempts

  'replicate-training': 1200,  // 60min / 3s = 1200 attempts
  'replicate-generation': 100, // 5min / 3s = 100 attempts
  'replicate-upscale': 100,    // 5min / 3s = 100 attempts
  'replicate-video': 200,      // 10min / 3s = 200 attempts
  'replicate-edit': 100,       // 5min / 3s = 100 attempts

  'local-generation': 120      // 2min / 1s = 120 attempts
} as const

/**
 * Get timeout configuration for a specific job
 */
export function getJobTimeout(provider: ProviderType, type: JobType): number {
  const key = `${provider}-${type}`
  return JOB_TIMEOUTS[key] || JOB_TIMEOUTS[`${provider}-generation`] || 5 * 60 * 1000 // 5min default
}

/**
 * Get polling interval for a provider
 */
export function getPollingInterval(provider: ProviderType): number {
  return POLLING_INTERVALS[provider] || 3000 // 3s default
}

/**
 * Get max attempts for a specific job
 */
export function getMaxAttempts(provider: ProviderType, type: JobType): number {
  const key = `${provider}-${type}`
  return MAX_ATTEMPTS[key] || MAX_ATTEMPTS[`${provider}-generation`] || 100 // 100 default
}

/**
 * Generate user-friendly timeout message
 */
export function getTimeoutMessage(provider: ProviderType, type: JobType): string {
  const timeoutMs = getJobTimeout(provider, type)
  const minutes = Math.round(timeoutMs / 60000)

  const typeMessages = {
    training: `O treinamento demorou mais que o esperado (${minutes} min). Tente novamente ou contate o suporte.`,
    generation: `A geração demorou mais que o esperado (${minutes} min). Tente novamente.`,
    upscale: `O upscale demorou mais que o esperado (${minutes} min). Tente novamente.`,
    video: `A geração de vídeo demorou mais que o esperado (${minutes} min). Tente novamente.`,
    edit: `A edição demorou mais que o esperado (${minutes} min). Tente novamente.`
  }

  return typeMessages[type] || `O processo demorou mais que o esperado (${minutes} min). Tente novamente.`
}

/**
 * Stop criteria definitions for different providers
 */
export const STOP_CRITERIA: Record<ProviderType, JobStopCriteria> = {
  astria: {
    provider: 'astria',
    checkStatus: (response: any) => {
      // Validate response structure first
      if (!response || typeof response !== 'object') {
        return { shouldStop: false, reason: 'Invalid response structure', status: 'processing' }
      }

      // Check explicit failure status first (priority over URLs)
      if (response.status === 'failed' || response.status === 'cancelled' || response.status === 'error') {
        return { shouldStop: true, reason: `Status: ${response.status}`, status: response.status === 'cancelled' ? 'cancelled' : 'failed' }
      }

      // For Astria, validate URLs are present and accessible
      const urls = []
      if (response.images && Array.isArray(response.images)) {
        urls.push(...response.images.filter(url => typeof url === 'string' && url.trim().length > 0))
      }
      if (response.urls && Array.isArray(response.urls)) {
        urls.push(...response.urls.filter(url => typeof url === 'string' && url.trim().length > 0))
      }

      // Validate URLs are not just placeholders or invalid
      const validUrls = urls.filter(url =>
        url.includes('http') &&
        !url.includes('placeholder') &&
        !url.includes('null') &&
        url.length > 10
      )

      if (validUrls.length > 0) {
        // Check if status also indicates completion (if available)
        if (response.status === 'succeeded' || response.status === 'completed' || response.status === 'generated') {
          return { shouldStop: true, reason: 'URLs available with success status', status: 'succeeded' }
        }
        // URLs available but no explicit success status - still proceed
        return { shouldStop: true, reason: 'Valid URLs available', status: 'succeeded' }
      }

      // Check if explicitly succeeded but no URLs (edge case)
      if (response.status === 'succeeded' || response.status === 'completed' || response.status === 'generated') {
        return { shouldStop: true, reason: 'Success status but no URLs', status: 'failed' }
      }

      // Continue polling if still processing
      if (response.status === 'queued' || response.status === 'generating' || response.status === 'processing' || response.status === 'starting') {
        return { shouldStop: false, reason: `Still ${response.status}`, status: 'processing' }
      }

      // Unknown status but has some URLs - might be processing
      if (urls.length > 0) {
        return { shouldStop: false, reason: `Unknown status '${response.status}' but URLs present - continuing`, status: 'processing' }
      }

      // Completely unknown status - continue with caution
      return { shouldStop: false, reason: `Unknown status: ${response.status || 'undefined'}`, status: 'processing' }
    },
    extractUrls: (response: any) => {
      const urls: string[] = []

      // Extract from images array (primary for Astria)
      if (response.images && Array.isArray(response.images)) {
        urls.push(...response.images.filter(url =>
          typeof url === 'string' &&
          url.trim().length > 0 &&
          url.includes('http') &&
          !url.includes('placeholder') &&
          !url.includes('null')
        ))
      }

      // Extract from urls array (fallback)
      if (response.urls && Array.isArray(response.urls)) {
        urls.push(...response.urls.filter(url =>
          typeof url === 'string' &&
          url.trim().length > 0 &&
          url.includes('http') &&
          !url.includes('placeholder') &&
          !url.includes('null')
        ))
      }

      // Deduplicate URLs
      return [...new Set(urls)]
    }
  },

  replicate: {
    provider: 'replicate',
    checkStatus: (response: any) => {
      // Validate response structure
      if (!response || typeof response !== 'object') {
        return { shouldStop: false, reason: 'Invalid response structure', status: 'processing' }
      }

      // For Replicate, status is the main criterion
      if (response.status === 'succeeded') {
        // Validate that we actually have output when succeeded
        const hasOutput = response.output || response.result
        if (!hasOutput) {
          return { shouldStop: true, reason: 'Succeeded but no output', status: 'failed' }
        }
        return { shouldStop: true, reason: 'Status: succeeded with output', status: 'succeeded' }
      }

      if (response.status === 'failed' || response.status === 'canceled' || response.status === 'cancelled') {
        const failureReason = response.error || response.detail || 'Unknown error'
        return {
          shouldStop: true,
          reason: `Status: ${response.status} - ${failureReason}`,
          status: (response.status === 'canceled' || response.status === 'cancelled') ? 'cancelled' : 'failed'
        }
      }

      // Continue if still processing
      if (response.status === 'starting' || response.status === 'processing') {
        return { shouldStop: false, reason: `Still ${response.status}`, status: 'processing' }
      }

      // Handle edge case where output is available but status is unknown
      if (response.output || response.result) {
        return { shouldStop: true, reason: 'Output available despite unknown status', status: 'succeeded' }
      }

      // Unknown status - continue with caution
      return { shouldStop: false, reason: `Unknown status: ${response.status || 'undefined'}`, status: 'processing' }
    },
    extractUrls: (response: any) => {
      const urls: string[] = []

      // Extract from output (primary for Replicate)
      if (response.output) {
        if (Array.isArray(response.output)) {
          urls.push(...response.output.filter(url =>
            typeof url === 'string' &&
            url.trim().length > 0 &&
            url.includes('http')
          ))
        } else if (typeof response.output === 'string' && response.output.includes('http')) {
          urls.push(response.output)
        } else if (response.output.images && Array.isArray(response.output.images)) {
          urls.push(...response.output.images.filter(url =>
            typeof url === 'string' &&
            url.trim().length > 0 &&
            url.includes('http')
          ))
        }
      }

      // Extract from result (alternative field)
      if (response.result && Array.isArray(response.result)) {
        urls.push(...response.result.filter(url =>
          typeof url === 'string' &&
          url.trim().length > 0 &&
          url.includes('http')
        ))
      }

      // Deduplicate URLs
      return [...new Set(urls)]
    }
  },

  local: {
    provider: 'local',
    checkStatus: (response: any) => {
      // Validate response structure
      if (!response || typeof response !== 'object') {
        return { shouldStop: false, reason: 'Invalid response structure', status: 'processing' }
      }

      // For local/mock, check basic status
      if (response.status === 'completed' || response.status === 'succeeded') {
        return { shouldStop: true, reason: 'Status: completed', status: 'succeeded' }
      }

      if (response.status === 'failed' || response.status === 'error') {
        return { shouldStop: true, reason: 'Status: failed', status: 'failed' }
      }

      if (response.status === 'cancelled' || response.status === 'canceled') {
        return { shouldStop: true, reason: 'Status: cancelled', status: 'cancelled' }
      }

      return { shouldStop: false, reason: `Still processing: ${response.status || 'unknown'}`, status: 'processing' }
    },
    extractUrls: (response: any) => {
      const urls: string[] = []

      // Extract from urls array
      if (response.urls && Array.isArray(response.urls)) {
        urls.push(...response.urls.filter(url =>
          typeof url === 'string' &&
          url.trim().length > 0 &&
          (url.includes('http') || url.startsWith('data:') || url.startsWith('/')) // Allow data URLs and relative paths for local
        ))
      }

      // Extract from images array
      if (response.images && Array.isArray(response.images)) {
        urls.push(...response.images.filter(url =>
          typeof url === 'string' &&
          url.trim().length > 0 &&
          (url.includes('http') || url.startsWith('data:') || url.startsWith('/')) // Allow data URLs and relative paths for local
        ))
      }

      // Deduplicate URLs
      return [...new Set(urls)]
    }
  }
}

/**
 * Check if a job should stop polling based on provider-specific criteria
 */
export function shouldStopPolling(provider: ProviderType, response: any): { shouldStop: boolean; reason: string; status: JobStatus; urls: string[] } {
  const criteria = STOP_CRITERIA[provider]
  if (!criteria) {
    return { shouldStop: true, reason: 'Unknown provider', status: 'failed', urls: [] }
  }

  const statusCheck = criteria.checkStatus(response)
  const urls = statusCheck.shouldStop ? criteria.extractUrls(response) : []

  return {
    shouldStop: statusCheck.shouldStop,
    reason: statusCheck.reason,
    status: statusCheck.status,
    urls
  }
}