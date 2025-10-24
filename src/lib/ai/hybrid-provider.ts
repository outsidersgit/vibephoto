import { AIProvider, GenerationRequest, GenerationResponse, TrainingRequest, TrainingResponse } from './base'
import { AstriaProvider } from './providers/astria'
import { ReplicateProvider } from './providers/replicate'

/**
 * Hybrid AI Provider - Routes operations to the best provider for each task
 *
 * Strategy:
 * - Astria: Model training (tunes) and image generation with custom models
 * - Replicate: Upscaling, video generation, image editing, and specialized models
 */
export class HybridAIProvider extends AIProvider {
  private astriaProvider: AstriaProvider
  private replicateProvider: ReplicateProvider

  constructor() {
    super()
    this.astriaProvider = new AstriaProvider()
    this.replicateProvider = new ReplicateProvider()
  }

  // Training operations - Use Astria for all model training
  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    console.log('🎯 Routing training to Astria provider')
    return this.astriaProvider.startTraining(request)
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    console.log('🎯 Routing training status check to Astria provider')
    return this.astriaProvider.getTrainingStatus(trainingId)
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    console.log('🎯 Routing training cancellation to Astria provider')
    return this.astriaProvider.cancelTraining(trainingId)
  }

  // Generation operations - Use Astria for custom model generations
  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    // If using custom model, route to Astria
    if (request.modelUrl) {
      console.log('🎯 Routing custom model generation to Astria provider')
      const result = await this.astriaProvider.generateImage(request)
      // Add metadata to indicate actual provider used
      return {
        ...result,
        metadata: {
          actualProvider: 'astria',
          hybridRouting: 'custom-model'
        }
      }
    }

    // For base models without custom training, could use either provider
    // Defaulting to Astria for consistency, but can be configured
    console.log('🎯 Routing base model generation to Astria provider')
    const result = await this.astriaProvider.generateImage(request)
    // Add metadata to indicate actual provider used
    return {
      ...result,
      metadata: {
        actualProvider: 'astria',
        hybridRouting: 'base-model'
      }
    }
  }

  async getGenerationStatus(generationId: string, tuneId?: string): Promise<GenerationResponse> {
    // Try Astria first (most generations will be there)
    try {
      console.log(`🎯 [HYBRID_STATUS] Checking generation status in Astria provider for: ${generationId}`)
      console.log(`🔑 [HYBRID_STATUS] Using tune_id: ${tuneId || 'none'}`)
      const result = await this.astriaProvider.getGenerationStatus(generationId, tuneId)
      console.log(`✅ [HYBRID_STATUS] Astria status check successful:`, {
        id: result.id,
        status: result.status,
        hasUrls: !!result.urls,
        urlCount: result.urls?.length || 0
      })
      return result
    } catch (error) {
      // Fallback to Replicate if not found in Astria
      console.log(`⚠️ [HYBRID_STATUS] Astria failed, trying Replicate fallback:`, error instanceof Error ? error.message : error)
      try {
        const result = await this.replicateProvider.getGenerationStatus(generationId)
        console.log(`✅ [HYBRID_STATUS] Replicate fallback successful`)
        return result
      } catch (fallbackError) {
        console.error(`❌ [HYBRID_STATUS] Both providers failed:`, fallbackError)
        throw fallbackError
      }
    }
  }

  // Legacy method for polling compatibility
  async getPredictionStatus(predictionId: string): Promise<any> {
    // For hybrid provider, this should route to the appropriate provider
    // Try Astria first (most predictions will be there now)
    try {
      console.log('🎯 Checking prediction status in Astria provider')
      return await this.astriaProvider.getGenerationStatus(predictionId)
    } catch (error) {
      // Fallback to Replicate for legacy predictions
      console.log('🎯 Fallback: checking prediction status in Replicate provider')
      return this.replicateProvider.getPredictionStatus(predictionId)
    }
  }

  async cancelGeneration(generationId: string): Promise<boolean> {
    // Try both providers since we don't know which one has the generation
    const [astriaResult, replicateResult] = await Promise.allSettled([
      this.astriaProvider.cancelGeneration(generationId),
      this.replicateProvider.cancelGeneration(generationId)
    ])

    // Return true if either provider successfully canceled
    return (astriaResult.status === 'fulfilled' && astriaResult.value) ||
           (replicateResult.status === 'fulfilled' && replicateResult.value)
  }

  // Model validation - Check both providers
  async validateModel(modelUrl: string): Promise<boolean> {
    // Try Astria first (for custom models)
    try {
      const astriaValid = await this.astriaProvider.validateModel(modelUrl)
      if (astriaValid) return true
    } catch (error) {
      console.log('Model not found in Astria, checking Replicate')
    }

    // Fallback to Replicate
    try {
      return await this.replicateProvider.validateModel(modelUrl)
    } catch (error) {
      return false
    }
  }

  // Available models - Combine from both providers
  async getAvailableModels() {
    const [astriaModels, replicateModels] = await Promise.allSettled([
      this.astriaProvider.getAvailableModels(),
      this.replicateProvider.getAvailableModels()
    ])

    const models = []

    if (astriaModels.status === 'fulfilled') {
      models.push(...astriaModels.value.map(model => ({
        ...model,
        provider: 'astria' as const
      })))
    }

    if (replicateModels.status === 'fulfilled') {
      models.push(...replicateModels.value.map(model => ({
        ...model,
        provider: 'replicate' as const
      })))
    }

    return models
  }

  // Utility methods for specific operations

  /**
   * Route upscaling operations specifically to Replicate
   */
  async upscaleImage(imageUrl: string, options: any): Promise<any> {
    console.log('🎯 Routing upscale operation to Replicate provider')
    // Use Replicate's upscaling capabilities
    const { TopazUpscaler } = await import('./upscale/topaz-upscaler')
    const upscaler = new TopazUpscaler()
    return upscaler.upscaleImage(imageUrl, options)
  }

  /**
   * Route video generation specifically to Replicate
   */
  async generateVideo(request: any): Promise<any> {
    console.log('🎯 Routing video generation to Replicate provider')
    // Video generation should use Replicate's video models
    return this.replicateProvider.generateImage({
      ...request,
      // Add video-specific model if not specified
      modelUrl: request.modelUrl || 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb1a4919c746077d670cbc80afd6101284d9f71306'
    })
  }

  /**
   * Route image editing specifically to Replicate
   */
  async editImage(imageUrl: string, editRequest: any): Promise<any> {
    console.log('🎯 Routing image editing to Replicate provider')
    // Image editing should use Replicate's editing models
    return this.replicateProvider.generateImage({
      ...editRequest,
      // Use appropriate editing model
      modelUrl: editRequest.modelUrl || 'timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493a5b39687c491b2844b26f23de7de9b3b777e9125c'
    })
  }

  /**
   * Get provider info for debugging/monitoring
   */
  getProviderInfo() {
    return {
      strategy: 'hybrid',
      providers: {
        astria: {
          purpose: 'Model training and custom model image generation',
          status: 'active'
        },
        replicate: {
          purpose: 'Upscaling, video generation, image editing',
          status: 'active'
        }
      },
      routing: {
        training: 'astria',
        customModelGeneration: 'astria',
        baseModelGeneration: 'astria', // configurable
        upscaling: 'replicate',
        videoGeneration: 'replicate',
        imageEditing: 'replicate'
      }
    }
  }
}