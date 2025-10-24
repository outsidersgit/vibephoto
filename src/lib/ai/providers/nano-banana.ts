import Replicate from 'replicate'
import { AIError } from '../base'
import { AI_CONFIG } from '../config'

export interface NanoBananaEditRequest {
  prompt: string
  imageInput?: string | string[] // Base64 or URLs
  outputFormat?: 'jpg' | 'png'
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
  private modelVersion = 'adfd722f0c8b5abd782eac022a625a14fb812951de19618dfc4979f6651a00b4'

  constructor() {
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured', 'REPLICATE_CONFIG_ERROR')
    }

    this.replicate = new Replicate({
      auth: AI_CONFIG.replicate.apiToken,
    })

    console.log('🍌 Nano Banana via Replicate initialized successfully')
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

      // Prepare input according to Nano Banana schema
      const input: any = {
        prompt: request.prompt,
        output_format: request.outputFormat || 'jpg'
      }

      // Add image input if provided - Nano Banana supports array of image URIs
      if (request.imageInput) {
        if (Array.isArray(request.imageInput)) {
          input.image_input = request.imageInput
        } else {
          input.image_input = [request.imageInput]
        }
      } else {
        input.image_input = []
      }

      console.log('🍌 Nano Banana input:', {
        prompt: input.prompt.substring(0, 50) + '...',
        imageCount: input.image_input.length,
        outputFormat: input.output_format
      })

      // Create prediction using the correct version ID
      const prediction = await this.replicate.predictions.create({
        version: this.modelVersion,
        input
      })

      console.log('🍌 Nano Banana prediction created:', { 
        id: prediction.id,
        status: prediction.status 
      })

      // Wait for completion
      const result = await this.replicate.wait(prediction)

      console.log('🍌 Nano Banana prediction completed:', { 
        id: result.id, 
        status: result.status,
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
          model: 'nano-banana'
        }
      }

    } catch (error) {
      console.error('❌ Nano Banana via Replicate failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      throw new AIError(
        `Nano Banana editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NANO_BANANA_EDIT_ERROR'
      )
    }
  }

  /**
   * Edit image with text prompt
   */
  async editWithPrompt(imageUrl: string, prompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Edit this image: ${prompt}. Make high-quality, precise changes while maintaining the overall composition and style.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      imageInput: [imageUrl],
      outputFormat
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
    if (imageUrls.length > 3) {
      throw new AIError('Maximum 3 images can be processed with Nano Banana', 'TOO_MANY_IMAGES')
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
  async generateImage(prompt: string, outputFormat: 'jpg' | 'png' = 'jpg'): Promise<NanoBananaEditResponse> {
    const enhancedPrompt = `Generate a high-quality image: ${prompt}. Create detailed, professional-looking result with excellent composition and lighting.`
    
    return this.editImage({
      prompt: enhancedPrompt,
      outputFormat
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