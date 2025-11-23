import { VIDEO_CONFIG, VideoGenerationRequest, VideoGenerationResponse, VideoStatus } from '../video/config'
import { AI_CONFIG } from '../config'
import { AIError } from '../base'
import { 
  mapReplicateToVideoStatus, 
  isReplicateStatusCompleted, 
  isReplicateStatusProcessing 
} from '../../utils/status-mapping'

/**
 * Google Veo 3.1 Fast Provider for Video Generation
 * Uses Replicate API with webhook-based processing
 * 
 * Features:
 * - Text-to-video generation
 * - Image-to-video with optional interpolation (first + last frame)
 * - Audio generation support
 * - Flexible durations: 4s, 6s, or 8s
 * - Multiple aspect ratios: 16:9, 9:16
 * - High resolution: 720p or 1080p
 */
export class KlingVideoProvider {
  private apiToken: string
  private baseUrl: string = 'https://api.replicate.com/v1'
  private modelEndpoint: string = 'models/google/veo-3.1-fast/predictions'

  constructor() {
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured for video generation', 'REPLICATE_CONFIG_ERROR')
    }

    this.apiToken = AI_CONFIG.replicate.apiToken
  }

  /**
   * Start video generation with Kling AI (text-to-video or image-to-video)
   */
  async generateVideo(request: VideoGenerationRequest, webhookUrl?: string): Promise<VideoGenerationResponse> {
    try {
      console.log(`🎬 Starting video generation with Google Veo 3.1 Fast:`, {
        model: VIDEO_CONFIG.provider.model,
        duration: request.duration,
        aspectRatio: request.aspectRatio,
        resolution: request.resolution || '1080p',
        generateAudio: request.generateAudio !== false,
        promptLength: request.prompt.length,
        hasImage: !!(request.sourceImageUrl || request.image),
        hasLastFrame: !!request.lastFrame
      })

      // Build input parameters for Google Veo 3.1 Fast according to schema
      const input: any = {
        prompt: request.prompt, // Required
        duration: request.duration || 8, // Optional, default 8 (4, 6, or 8)
        aspect_ratio: request.aspectRatio || '16:9', // Optional, default '16:9'
        resolution: request.resolution || '1080p', // Optional, default '1080p'
        generate_audio: request.generateAudio !== false // Optional, default true
      }

      // Add negative_prompt if provided
      if (request.negativePrompt) {
        input.negative_prompt = request.negativePrompt
      }

      // Add seed if provided (for reproducibility)
      if (request.seed !== undefined) {
        input.seed = request.seed
      }

      // Add image for image-to-video generation (optional)
      const sourceImage = request.image || request.sourceImageUrl
      if (sourceImage) {
        input.image = sourceImage
        console.log('📸 Using source image for video generation')
      }

      // Add last_frame for interpolation (optional)
      if (request.lastFrame) {
        input.last_frame = request.lastFrame
        console.log('🖼️ Using last frame for interpolation')
      }

      // Build request body
      const requestBody: any = {
        input
      }

      // Add webhook if provided and valid
      const hasValidWebhook = webhookUrl && webhookUrl.startsWith('https://')
      if (hasValidWebhook) {
        requestBody.webhook = webhookUrl
        requestBody.webhook_events_filter = ['start', 'output', 'logs', 'completed']
        console.log('📡 Webhook configured for video generation:', webhookUrl)
      } else if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Development mode: no webhook configured for video')
      }

      console.log('🚀 Creating Veo 3.1 Fast video prediction with input:', JSON.stringify(requestBody, null, 2))

      // Make direct API call to Replicate (webhook-based, no 'Prefer: wait')
      const response = await fetch(`${this.baseUrl}/${this.modelEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`)
      }

      const prediction = await response.json()
      console.log('✅ Video prediction response:', prediction.id, prediction.status)

      const mappedStatus = mapReplicateToVideoStatus(prediction.status)
      const isCompleted = isReplicateStatusCompleted(prediction.status)
      
      return {
        id: prediction.id,
        status: mappedStatus,
        jobId: prediction.id,
        videoUrl: isCompleted ? prediction.output : undefined,
        thumbnailUrl: isCompleted && prediction.output ? this.generateThumbnailUrl(prediction.output) : undefined,
        progress: isCompleted ? 100 : 0,
        estimatedTimeRemaining: isCompleted ? 0 : this.getEstimatedTime(request.duration, request.quality)
      }

    } catch (error) {
      console.error('❌ Video generation failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }

      // Handle specific Replicate errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        // Authentication errors
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
          throw new AIError('Invalid Replicate API token for video generation', 'AUTH_ERROR')
        }

        // Rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          throw new AIError('Replicate API rate limit exceeded for video generation. Please try again in a few minutes.', 'RATE_LIMIT_ERROR')
        }

        // Model errors
        if (errorMessage.includes('model not found') || errorMessage.includes('404')) {
          throw new AIError('Google Veo 3.1 Fast model not found or unavailable', 'MODEL_NOT_FOUND')
        }

        // Input validation errors
        if (errorMessage.includes('input') || errorMessage.includes('validation')) {
          throw new AIError(`Invalid video generation parameters: ${error.message}`, 'INVALID_INPUT')
        }

        // Quota/billing errors
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          throw new AIError('Replicate account quota exceeded for video generation', 'QUOTA_EXCEEDED')
        }

        // Network errors
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
          throw new AIError('Network error during video generation. Please try again.', 'NETWORK_ERROR')
        }

        throw new AIError(`Video generation failed: ${error.message}`, 'VIDEO_GENERATION_ERROR')
      }

      throw new AIError(
        `Failed to start video generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VIDEO_GENERATION_START_ERROR'
      )
    }
  }

  /**
   * Get video generation status
   */
  async getVideoStatus(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`)
      }

      const prediction = await response.json()

      console.log(`📊 Video status check for ${jobId}:`, {
        status: prediction.status,
        hasOutput: !!prediction.output,
        hasError: !!prediction.error
      })

      const isCompleted = isReplicateStatusCompleted(prediction.status)
      const isProcessing = isReplicateStatusProcessing(prediction.status)
      
      const videoResponse: VideoGenerationResponse = {
        id: prediction.id,
        status: mapReplicateToVideoStatus(prediction.status),
        jobId: prediction.id
      }

      // Add output URL if completed successfully
      if (isCompleted && prediction.output) {
        videoResponse.videoUrl = typeof prediction.output === 'string' 
          ? prediction.output 
          : Array.isArray(prediction.output) 
            ? prediction.output[0] 
            : prediction.output?.url || prediction.output

        // Generate thumbnail URL (placeholder for now)
        if (videoResponse.videoUrl) {
          videoResponse.thumbnailUrl = this.generateThumbnailUrl(videoResponse.videoUrl)
        }
      }

      // Add error message if failed
      if (prediction.error) {
        videoResponse.errorMessage = typeof prediction.error === 'string' 
          ? prediction.error 
          : JSON.stringify(prediction.error)
      }

      // Add progress estimation based on status and time elapsed
      if (isProcessing) {
        const createdAt = new Date(prediction.created_at)
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / 1000)
        
        // Estimate progress based on typical processing time
        const estimatedTotal = this.getEstimatedTime(5, 'standard') // Default estimate
        videoResponse.progress = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 95)
        videoResponse.estimatedTimeRemaining = Math.max(estimatedTotal - elapsed, 10)
      } else if (isCompleted) {
        videoResponse.progress = 100
        videoResponse.estimatedTimeRemaining = 0
      }

      return videoResponse

    } catch (error) {
      console.error('❌ Failed to get video status:', error)
      throw new AIError(
        `Failed to get video generation status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VIDEO_STATUS_ERROR'
      )
    }
  }

  /**
   * Cancel video generation
   */
  async cancelVideo(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error(`Failed to cancel video ${jobId}: HTTP ${response.status}`)
        return false
      }

      console.log(`⏹️ Video generation cancelled: ${jobId}`)
      return true
    } catch (error) {
      console.error('❌ Failed to cancel video generation:', error)
      return false
    }
  }

  /**
   * Validate that an image URL is accessible (for image-to-video generation)
   */
  async validateImageUrl(imageUrl: string): Promise<{
    isValid: boolean
    width?: number
    height?: number
    size?: number
    format?: string
    reason?: string
  }> {
    try {
      console.log('🔍 Validating image URL for video generation:', imageUrl)
      
      // Check URL format first
      try {
        new URL(imageUrl)
      } catch {
        return {
          isValid: false,
          reason: 'Invalid URL format'
        }
      }

      // Try to fetch image metadata with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
      
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        return {
          isValid: false,
          reason: `Image not accessible (HTTP ${response.status})`
        }
      }

      const contentType = response.headers.get('content-type') || ''
      const contentLength = response.headers.get('content-length')
      
      // Check if it's an image
      if (!contentType.startsWith('image/')) {
        return {
          isValid: false,
          reason: 'URL does not point to an image'
        }
      }

      // Check file size (if available)
      if (contentLength) {
        const size = parseInt(contentLength)
        if (size > VIDEO_CONFIG.validation.maxImageFileSize) {
          return {
            isValid: false,
            reason: 'Image file too large (max 10MB)'
          }
        }

        return {
          isValid: true,
          size,
          format: contentType
        }
      }

      return {
        isValid: true,
        format: contentType
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isValid: false,
          reason: 'Image validation timeout'
        }
      }
      console.error('❌ Image validation failed:', error)
      return {
        isValid: false,
        reason: 'Failed to validate image accessibility'
      }
    }
  }


  /**
   * Map Replicate status to our internal status
   */

  /**
   * Get estimated processing time
   * @param duration - Video duration in seconds (4, 6, or 8)
   * @param quality - Quality setting (maps to resolution: 'standard' = 720p, 'pro' = 1080p)
   */
  private getEstimatedTime(duration: number, quality: string): number {
    // 🔒 CRITICAL FIX: Map quality to resolution (VIDEO_CONFIG uses resolution keys, not quality)
    // quality='standard' → '720p', quality='pro' → '1080p'
    const resolutionKey = quality === 'pro' ? '1080p' : '720p'
    
    // Ensure duration is valid (4, 6, or 8), fallback to 8
    const validDuration = [4, 6, 8].includes(duration) ? duration : 8
    
    // Safely access estimatedTimes with proper type casting
    const times = VIDEO_CONFIG.estimatedTimes[resolutionKey as '720p' | '1080p']
    return times[validDuration as 4 | 6 | 8]
  }

  /**
   * Generate thumbnail URL from video URL
   */
  private generateThumbnailUrl(videoUrl: string): string {
    // For Replicate URLs, we might be able to extract a frame
    // For now, return a placeholder or the video URL itself
    return videoUrl.replace(/\.(mp4|mov)$/i, '_thumb.jpg')
  }

  /**
   * Get available models and their capabilities
   */
  async getAvailableModels() {
    return [
      {
        id: VIDEO_CONFIG.provider.model,
        name: 'Google Veo 3.1 Fast',
        description: 'Fast and high-quality video generation with audio support',
        type: 'video' as const,
        capabilities: {
          maxDuration: 10,
          aspectRatios: VIDEO_CONFIG.options.aspectRatios,
          qualities: VIDEO_CONFIG.options.qualities,
          inputFormats: VIDEO_CONFIG.validation.supportedImageFormats
        }
      }
    ]
  }
}