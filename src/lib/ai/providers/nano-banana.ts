import Replicate from 'replicate'
import { AIError } from '../base'
import { AI_CONFIG } from '../config'

export interface NanoBananaEditRequest {
  prompt: string
  imageInput?: string | string[] // Base64 or URLs
  outputFormat?: 'jpg' | 'png'
  aspectRatio?: '1:1' | '4:3' | '3:4' | '9:16' | '16:9'
  resolution?: string // Output resolution (default: "2K") - Nano Banana Pro
  safetyFilterLevel?: string // Safety filter level (default: "block_only_high") - Nano Banana Pro
  webhookUrl?: string // Optional webhook URL for async processing
}

export interface NanoBananaEditResponse {
  id: string
  status: 'processing' | 'succeeded' | 'failed'
  resultImage?: string // URL or base64
  error?: string
  metadata?: {
    operation: string
    prompt: string
    processedAt: string
    model: string
  }
}

export class NanoBananaProvider {
  private replicate: Replicate
  // 🔥 UPDATED: google/nano-banana-pro with enhanced capabilities
  // To find latest version: https://replicate.com/google/nano-banana-pro
  private modelVersion = process.env.NANO_BANANA_MODEL_VERSION || 'google/nano-banana-pro'
  private modelName = 'google/nano-banana-pro'

  constructor() {
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured', 'REPLICATE_CONFIG_ERROR')
    }

    this.replicate = new Replicate({
      auth: AI_CONFIG.replicate.apiToken,
    })

    console.log(`🍌 Nano Banana Pro via Replicate initialized successfully (model: ${this.modelName})`)
  }

  /**
   * Edit an image using Google Nano Banana via Replicate
   */
  async editImage(request: NanoBananaEditRequest): Promise<NanoBananaEditResponse> {
    try {
      const requestId = `nanoBanana_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.log('🍌 Starting Nano Banana edit via Replicate:', {
        requestId,
        prompt: request.prompt.substring(0, 100) + '...',
        hasImage: !!request.imageInput
      })

      // Prepare input according to Nano Banana Pro schema
      const input: any = {
        prompt: request.prompt,
        output_format: request.outputFormat || 'jpg'
      }

      // 🔥 NEW: Nano Banana Pro parameters
      // Add resolution (default: "2K")
      input.resolution = request.resolution || '2K'

      // Add safety filter level (default: "block_only_high")
      input.safety_filter_level = request.safetyFilterLevel || 'block_only_high'

      // Add image input if provided - Nano Banana supports array of image URIs
      const hasImages = request.imageInput && (
        (Array.isArray(request.imageInput) && request.imageInput.length > 0) ||
        (!Array.isArray(request.imageInput) && request.imageInput)
      )

      if (hasImages) {
        if (Array.isArray(request.imageInput)) {
          input.image_input = request.imageInput
        } else {
          input.image_input = [request.imageInput]
        }
      } else {
        input.image_input = []
      }

      // CRITICAL: aspect_ratio validation based on image_input
      // - With images: can be "match_input_image" (default) or specific ratio
      // - Without images (generation): MUST be a specific ratio, NOT "match_input_image"
      if (request.aspectRatio) {
        if (!hasImages && request.aspectRatio === 'match_input_image') {
          // Cannot use match_input_image without images - use default 1:1
          console.warn('⚠️ Cannot use match_input_image without images, defaulting to 1:1')
          input.aspect_ratio = '1:1'
        } else {
          input.aspect_ratio = request.aspectRatio
        }
      } else {
        // Set sensible default based on whether we have images
        input.aspect_ratio = hasImages ? 'match_input_image' : '1:1'
      }

      console.log('🍌 Nano Banana Pro input:', {
        prompt: input.prompt.substring(0, 50) + '...',
        imageCount: input.image_input.length,
        imageUrls: input.image_input.map((url: string) => url.substring(0, 80) + '...'),
        outputFormat: input.output_format,
        aspectRatio: input.aspect_ratio,
        resolution: input.resolution,
        safetyLevel: input.safety_filter_level
      })

      // Prepare prediction options
      // Note: For Nano Banana Pro, we use the model name directly
      // Replicate will use the latest version automatically
      const predictionOptions: any = {
        model: this.modelName,
        input
      }

      // Add webhook if provided (for async processing)
      // CRITICAL: Validate webhook URL format to prevent Replicate SDK errors
      let hasValidWebhook = false
      if (request.webhookUrl) {
        try {
          const webhookUrl = request.webhookUrl.trim()
          // Validate URL format
          const url = new URL(webhookUrl)
          if (url.protocol === 'https:' && url.hostname && url.pathname) {
            predictionOptions.webhook = webhookUrl
            predictionOptions.webhook_events_filter = ['start', 'output', 'logs', 'completed']
            hasValidWebhook = true
            console.log('📡 Nano Banana webhook configured:', webhookUrl)
          } else {
            console.warn('⚠️ Invalid webhook URL protocol or format:', webhookUrl)
          }
        } catch (urlError) {
          console.error('❌ Invalid webhook URL format:', request.webhookUrl, urlError)
          // Don't throw - continue without webhook (sync mode)
        }
      }

      // Create prediction using the correct version ID
      const prediction = await this.replicate.predictions.create(predictionOptions)

      console.log('🍌 Nano Banana Pro prediction created:', { 
        id: prediction.id,
        status: prediction.status,
        model: this.modelName,
        hasWebhook: hasValidWebhook
      })

      // If webhook is configured, return immediately (async processing)
      // Otherwise, wait for completion (synchronous fallback)
      if (hasValidWebhook) {
        // Return immediately - webhook will handle completion
        return {
          id: prediction.id,
          status: prediction.status === 'starting' || prediction.status === 'processing' ? 'processing' : (prediction.status as any),
          metadata: {
            operation: 'edit',
            prompt: request.prompt,
            processedAt: new Date().toISOString(),
            model: 'nano-banana-pro',
            resolution: request.resolution || '2K',
            safetyFilterLevel: request.safetyFilterLevel || 'block_only_high',
            async: true
          }
        }
      }

      // Synchronous fallback: wait for completion
      const result = await this.replicate.wait(prediction)

      console.log('🍌 Nano Banana Pro prediction completed:', { 
        id: result.id, 
        status: result.status,
        model: this.modelName,
        hasOutput: !!result.output 
      })

      if (result.status === 'failed') {
        throw new AIError(
          result.error || 'Nano Banana prediction failed',
          'NANO_BANANA_PREDICTION_FAILED'
        )
      }

      if (result.status !== 'succeeded') {
        throw new AIError(
          `Unexpected prediction status: ${result.status}`,
          'NANO_BANANA_UNEXPECTED_STATUS'
        )
      }

      // Handle output - Nano Banana returns a single URL string
      const resultImage = result.output as string

      if (!resultImage) {
        throw new AIError('No image returned from Nano Banana', 'NANO_BANANA_NO_OUTPUT')
      }

      return {
        id: result.id,
        status: 'succeeded',
        resultImage,
        metadata: {
          operation: 'edit',
          prompt: request.prompt,
          processedAt: new Date().toISOString(),
          model: 'nano-banana-pro',
          resolution: request.resolution || '2K',
          safetyFilterLevel: request.safetyFilterLevel || 'block_only_high'
        }
      }

    } catch (error) {
      console.error('❌ Nano Banana via Replicate failed:', error)

      // Extract detailed error info from Replicate error
      if (error && typeof error === 'object') {
        const err = error as any
        console.error('📋 Detailed error info:', {
          message: err.message,
          detail: err.detail,
          status: err.status,
          code: err.code,
          prediction: err.prediction,
          input: err.input,
          fullError: JSON.stringify(error, null, 2)
        })
      }

      if (error instanceof AIError) {
        throw error
      }

      // Enhanced error message with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetail = (error as any)?.detail || ''

      throw new AIError(
        `Nano Banana editing failed: ${errorMessage}${errorDetail ? ` - ${errorDetail}` : ''}`,
        'NANO_BANANA_EDIT_ERROR'
      )
    }
  }

  /**
   * Edit image with text prompt
   */
  async editWithPrompt(
    imageUrl: string, 
    prompt: string, 
    outputFormat: 'jpg' | 'png' = 'jpg', 
    aspectRatio?: '1:1' | '4:3' | '3:4' | '9:16' | '16:9', 
    webhookUrl?: string,
    resolution?: string,
    safetyFilterLevel?: string
  ): Promise<NanoBananaEditResponse> {
    // Use prompt directly without adding prefix - user's prompt should be used as-is
    return this.editImage({
      prompt: prompt,
      imageInput: [imageUrl],
      outputFormat,
      aspectRatio,
      resolution,
      safetyFilterLevel,
      webhookUrl
    })
  }

  /**
   * Add elements to image
   */
  async addElementToImage(imageUrl: string, prompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Add to this image: ${prompt}. Seamlessly integrate the new element with the existing composition, matching lighting, shadows, and style perfectly.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: [imageUrl],
      outputFormat
    })
  }

  /**
   * Remove elements from image
   */
  async removeElementFromImage(imageUrl: string, prompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Remove from this image: ${prompt}. Fill the background naturally and seamlessly, maintaining the original lighting and composition.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: [imageUrl],
      outputFormat
    })
  }

  /**
   * Apply style transfer
   */
  async transferStyle(imageUrl: string, stylePrompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Transform this image to have the following style: ${stylePrompt}. Preserve the subject identity and composition while applying the artistic style consistently.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: [imageUrl],
      outputFormat
    })
  }

  /**
   * Blend multiple images using Nano Banana's multi-image capabilities
   */
  async blendImages(imageUrls: string[], prompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    if (imageUrls.length > 14) {
      throw new AIError('Maximum 14 images can be processed with Nano Banana Pro', 'TOO_MANY_IMAGES')
    }

    const enhancedPrompt = `Blend these ${imageUrls.length} images together: ${prompt}. Create a seamless fusion that combines the best elements, textures, colors, and lighting from all images into one cohesive, natural-looking result.`

    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: imageUrls,
      outputFormat
    })
  }

  /**
   * Generate image from text prompt only
   */
  async generateImage(
    prompt: string, 
    outputFormat: 'jpg' | 'png' = 'jpg', 
    aspectRatio?: '1:1' | '4:3' | '3:4' | '9:16' | '16:9', 
    webhookUrl?: string,
    resolution?: string,
    safetyFilterLevel?: string
  ): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Generate a high-quality image: ${prompt}. Create detailed, professional-looking result with excellent composition and lighting.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: [],
      outputFormat,
      aspectRatio,
      resolution,
      safetyFilterLevel,
      webhookUrl
    })
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!AI_CONFIG.replicate.apiToken
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return ['jpg', 'png']
  }

  /**
   * Convert File to data URL for server environments
   * Works in both browser and server environments
   */
  static async fileToDataUrl(file: File): Promise<string> {
    // Check if we're in a browser environment
    if (typeof FileReader !== 'undefined' && typeof window !== 'undefined') {
      // Browser environment - use FileReader
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    } else {
      // Server environment - use Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      const mimeType = file.type || 'application/octet-stream'
      return `data:${mimeType};base64,${base64}`
    }
  }

  /**
   * Upload image to temporary storage and return URL
   * For now, converts to data URL - in production, you'd upload to S3/Cloudinary
   */
  static async fileToUrl(file: File): Promise<string> {
    // For development, convert to data URL
    // In production, upload to your storage service and return URL
    return this.fileToDataUrl(file)
  }
}