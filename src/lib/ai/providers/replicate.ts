import Replicate from 'replicate'
import { 
  AIProvider, 
  TrainingRequest, 
  TrainingResponse, 
  GenerationRequest, 
  GenerationResponse,
  AIError 
} from '../base'
import { AI_CONFIG, detectFluxModelType, mapParametersForModel } from '../config'

export class ReplicateProvider extends AIProvider {
  private client: Replicate

  constructor() {
    super()
    
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured', 'REPLICATE_CONFIG_ERROR')
    }

    this.client = new Replicate({
      auth: AI_CONFIG.replicate.apiToken
    })
  }

  async createModelDestination(modelName: string, description?: string): Promise<string> {
    try {
      console.log(`🏗️ Creating model destination: ${AI_CONFIG.replicate.modelNaming.baseUsername}/${modelName}`)
      
      const modelData = {
        owner: AI_CONFIG.replicate.modelNaming.baseUsername,
        name: modelName,
        description: description || `Custom AI model: ${modelName}`,
        visibility: 'private' as const,
        hardware: 'cpu' as const // Default hardware for model creation
      }
      
      // Use direct HTTP API call since the Replicate client might not support model creation
      const response = await fetch('https://api.replicate.com/v1/models', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.replicate.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`)
      }
      
      const model = await response.json()
      const destination = `${AI_CONFIG.replicate.modelNaming.baseUsername}/${modelName}`
      
      console.log(`✅ Model destination created: ${destination}`)
      console.log(`🔗 Model URL: ${model.url}`)
      
      return destination
      
    } catch (error) {
      console.error('❌ Model creation failed:', error)
      
      // Check if model already exists
      if (error instanceof Error && error.message.includes('already exists')) {
        const destination = `${AI_CONFIG.replicate.modelNaming.baseUsername}/${modelName}`
        console.log(`♻️ Model already exists, using: ${destination}`)
        return destination
      }
      
      throw new AIError(
        `Failed to create model destination: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MODEL_CREATION_ERROR'
      )
    }
  }

  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    try {
      // Validate request parameters
      if (!request.name || !request.imageUrls || request.imageUrls.length === 0) {
        throw new AIError('Invalid training request: missing name or images', 'INVALID_REQUEST')
      }

      if (!AI_CONFIG.replicate.modelNaming.baseUsername) {
        throw new AIError('Replicate username not configured', 'CONFIG_ERROR')
      }

      // Generate destination model name with proper sanitization
      const modelName = this.sanitizeModelName(`${request.name}-${Date.now()}`)
      
      console.log(`🔍 Debug: modelName = ${modelName}`)
      console.log(`🔍 Debug: baseUsername = ${AI_CONFIG.replicate.modelNaming.baseUsername}`)

      // Create model destination first
      const destination = await this.createModelDestination(
        modelName,
        `AI model trained from ${request.imageUrls.length} images`
      )

      console.log(`🚀 Starting FLUX training: ${destination}`)

      // Maximum quality FLUX training parameters
      const input = {
        input_images: await this.createZipFromUrls(request.imageUrls),
        trigger_word: request.triggerWord || 'TOK',
        
        // Core training parameters - optimized for maximum quality
        steps: request.params.steps || 2500,
        learning_rate: request.params.learning_rate || request.params.learningRate || 1e-4,
        batch_size: request.params.batch_size || request.params.batchSize || 1,
        resolution: request.params.resolution || "512,768,1024",
        
        // Advanced FLUX parameters for maximum quality
        lora_rank: request.params.lora_rank || 48,
        network_alpha: request.params.network_alpha || 24,
        lora_type: request.params.lora_type || "subject",
        
        // Training optimization
        optimizer: request.params.optimizer || "adamw8bit",
        mixed_precision: request.params.mixed_precision || "fp16",
        gradient_checkpointing: request.params.gradient_checkpointing !== false,
        cache_latents: request.params.cache_latents !== false,
        
        // Quality parameters
        caption_dropout_rate: request.params.caption_dropout_rate || 0.03,
        noise_offset: request.params.noise_offset || 0.05,
        shuffle_tokens: request.params.shuffle_tokens !== false,
        
        // Caption generation
        autocaption: request.params.autocaption !== false,
        autocaption_suffix: ` a photo of ${request.triggerWord || 'TOK'} ${request.classWord || 'person'}`,
        
        // Optional parameters
        seed: request.params.seed
      }

      // Allow webhooks if we have a valid HTTPS URL, regardless of environment
      const webhookUrl = request.webhookUrl
      const hasValidWebhook = webhookUrl && webhookUrl.startsWith('https://')
      
      if (webhookUrl) {
        console.log(`📡 Webhook URL: ${webhookUrl}`)
      } else {
        console.log(`⚠️ No webhook URL provided for training`)
      }

      // Parse the version string to get model owner and name
      const versionParts = AI_CONFIG.replicate.models.flux.training.split(':')
      if (versionParts.length !== 2) {
        throw new AIError('Invalid FLUX training model version format', 'INVALID_MODEL_VERSION')
      }
      const [modelPath, versionId] = versionParts
      const [modelOwner, trainingModelName] = modelPath.split('/')
      
      // Build training options
      const trainingOptions: any = {
        destination,
        input
      }
      
      // Only add webhook if we have a valid HTTPS URL
      if (hasValidWebhook) {
        trainingOptions.webhook = webhookUrl
        trainingOptions.webhook_events_filter = ['start', 'output', 'logs', 'completed']
      }
      
      const training = await this.client.trainings.create(
        modelOwner,
        trainingModelName,
        versionId,
        trainingOptions
      )

      console.log(`✅ Training created with ID: ${training.id}`)

      return {
        id: training.id,
        status: this.mapReplicateStatus(training.status),
        createdAt: training.created_at,
        estimatedTime: this.estimateTrainingTime(request.imageUrls.length, request.params.steps),
        metadata: {
          destination,
          triggerWord: request.triggerWord || 'TOK'
        }
      }

    } catch (error) {
      console.error('❌ Training start failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      // Handle specific Replicate API errors
      if (error instanceof Error) {
        // Model creation related errors
        if (error.message.includes('MODEL_CREATION_ERROR') || error.message.includes('model creation')) {
          throw new AIError(
            `Model creation failed: ${error.message}. Please check your Replicate account permissions.`,
            'MODEL_CREATION_ERROR'
          )
        }
        
        // Legacy destination errors (should be less common now)
        if (error.message.includes('destination') && error.message.includes('does not exist')) {
          throw new AIError(
            `Model destination error: ${error.message}. The model destination was not created properly.`,
            'DESTINATION_ERROR'
          )
        }
        
        // ZIP creation errors
        if (error.message.includes('zip') || error.message.includes('ZIP')) {
          throw new AIError(
            `Training data preparation failed: ${error.message}. Check image files and S3 access.`,
            'ZIP_CREATION_ERROR'
          )
        }
        
        // Webhook configuration errors
        if (error.message.includes('webhook')) {
          throw new AIError(
            `Webhook configuration error: ${error.message}`,
            'WEBHOOK_ERROR'
          )
        }
        
        // Rate limiting errors
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          throw new AIError(
            `Replicate API rate limit exceeded: ${error.message}. Please try again later.`,
            'RATE_LIMIT_ERROR'
          )
        }
        
        // Authentication errors
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          throw new AIError(
            `Authentication failed: ${error.message}. Check your Replicate API token.`,
            'AUTH_ERROR'
          )
        }
      }
      
      throw new AIError(
        `Failed to start FLUX training: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAINING_START_ERROR'
      )
    }
  }

  async getPredictionStatus(predictionId: string): Promise<any> {
    try {
      const prediction = await this.client.predictions.get(predictionId)
      
      return {
        id: prediction.id,
        status: this.mapReplicateStatus(prediction.status),
        output: prediction.output,
        error: prediction.error as string | undefined,
        createdAt: prediction.created_at,
        completedAt: prediction.completed_at || undefined
      }
      
    } catch (error) {
      throw new AIError(
        `Failed to get prediction status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PREDICTION_STATUS_ERROR'
      )
    }
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    try {
      const training = await this.client.trainings.get(trainingId)

      const extractedUrl = training.output ? this.extractModelUrl(training.output) : undefined
      
      return {
        id: training.id,
        status: this.mapReplicateStatus(training.status),
        model: extractedUrl ? {
          url: extractedUrl,
          name: this.extractModelNameFromDestination(extractedUrl)
        } : undefined,
        logs: training.logs ? training.logs.split('\n') : undefined,
        error: training.error as string | undefined,
        createdAt: training.created_at,
        completedAt: training.completed_at || undefined
      }

    } catch (error) {
      throw new AIError(
        `Failed to get training status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAINING_STATUS_ERROR'
      )
    }
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    try {
      await this.client.trainings.cancel(trainingId)
      return true
    } catch (error) {
      return false
    }
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      // Log model URL for debugging (skip strict validation for now)
      if (request.modelUrl) {
        console.log('🎨 Using custom model:', request.modelUrl)
        // Skip validation temporarily to avoid blocking generation
        // const isValidModel = await this.validateModel(request.modelUrl)
        // if (!isValidModel) {
        //   throw new AIError(`Invalid or inaccessible model: ${request.modelUrl}`, 'INVALID_MODEL_URL')
        // }
      }

      // Determine which FLUX model will be used and user plan
      const userPlan = (request as any).userPlan || 'FREE'
      const fluxModelVersion = request.modelUrl ? request.modelUrl : this.selectFluxModelByPlan(userPlan, request.params.steps || 25)
      
      // Detect model type - for custom models, use the base model for parameters mapping
      const modelTypeForParams = request.modelUrl ? 
        this.selectFluxModelByPlan(userPlan, request.params.steps || 25) : 
        fluxModelVersion
      const modelType = detectFluxModelType(modelTypeForParams)
      console.log(`🎯 Detected model type: ${modelType} for version: ${fluxModelVersion} (params from: ${modelTypeForParams})`)
      
      // Use the new parameter mapping system
      const baseSettings = {
        prompt: request.prompt,
        width: request.params.width || 1024,
        height: request.params.height || 1024,
        seed: request.params.seed || Math.floor(Math.random() * 1000000),
        steps: request.params.steps,
        guidance_scale: request.params.guidance_scale,
        safety_tolerance: request.params.safety_tolerance,
        raw_mode: request.params.raw_mode,
        output_format: request.params.output_format,
        output_quality: request.params.output_quality,
        num_outputs: request.params.num_outputs || 1
      }
      
      console.log(`📋 Base settings before mapping:`, baseSettings)
      
      // Map parameters based on model type
      const input = mapParametersForModel(modelType, baseSettings)
      console.log(`🔧 Mapped parameters for ${modelType}:`, input)
      
      // Validate that we have essential parameters
      if (!input.prompt) {
        throw new AIError('Prompt is required for image generation', 'INVALID_REQUEST')
      }

      // Add negative prompt if provided
      if (request.negativePrompt && request.negativePrompt.trim()) {
        input.negative_prompt = request.negativePrompt.trim()
      }

      // Add quality enhancements for paid plans
      if (userPlan !== 'FREE') {
        // Disable safety checker for artistic flexibility (premium only)
        if (userPlan === 'GOLD') {
          input.disable_safety_checker = true
        }
      }

      console.log('🎨 Generation input parameters:', {
        modelType,
        prompt: input.prompt.substring(0, 100) + '...',
        dimensions: input.aspect_ratio ? `aspect_ratio: ${input.aspect_ratio}` : `${input.width}x${input.height}`,
        parameters: Object.keys(input).filter(key => !['prompt', 'width', 'height', 'aspect_ratio', 'negative_prompt'].includes(key)),
        hasNegativePrompt: !!input.negative_prompt,
        modelUrl: request.modelUrl ? 'custom' : 'default'
      })

      const webhookUrl = request.webhookUrl
      // Allow webhooks if we have a valid HTTPS URL, regardless of environment
      // This enables Vercel preview deployments and production webhooks  
      const hasValidWebhook = webhookUrl && webhookUrl.startsWith('https://')
      
      // Set model version based on user plan and custom model
      let modelVersion: string
      if (request.modelUrl) {
        // For FLUX trained models, the modelUrl is the version identifier
        modelVersion = request.modelUrl
        console.log('🎨 Using custom trained model version:', request.modelUrl)
      } else {
        // Select FLUX model based on user plan for optimal quality
        modelVersion = this.selectFluxModelByPlan(userPlan, input.num_inference_steps)
        console.log(`🎨 Using FLUX model for ${userPlan} plan:`, modelVersion)
      }
      
      // Build prediction options using the correct Replicate client format
      const predictionOptions: any = {
        version: modelVersion,
        input: input
      }
      
      // Add webhook if we have a valid URL
      if (hasValidWebhook) {
        predictionOptions.webhook = webhookUrl
        predictionOptions.webhook_events_filter = ['start', 'output', 'logs', 'completed']
        console.log('📡 Webhook configured:', webhookUrl)
      } else {
        console.log('⚠️ No valid HTTPS webhook URL provided:', webhookUrl)
        console.log('💡 For webhooks to work, set NEXTAUTH_URL to an HTTPS URL')
      }

      console.log('🚀 Creating Replicate prediction with options:', JSON.stringify({
        version: predictionOptions.version,
        webhook: predictionOptions.webhook,
        webhook_events_filter: predictionOptions.webhook_events_filter,
        input_keys: Object.keys(predictionOptions.input)
      }, null, 2))
      
      // Verify API token is configured
      if (!AI_CONFIG.replicate.apiToken) {
        throw new AIError('Replicate API token not configured', 'CONFIG_ERROR')
      }
      
      const prediction = await this.client.predictions.create(predictionOptions)
      console.log('✅ Prediction created:', prediction.id, prediction.status)

      return {
        id: prediction.id,
        status: this.mapReplicateStatus(prediction.status),
        createdAt: prediction.created_at,
        estimatedTime: this.estimateGenerationTime(
          request.params.width || 1024, 
          request.params.height || 1024, 
          request.params.steps || 20
        ),
        metadata: {
          prompt: request.prompt,
          seed: request.params.seed || 0,
          params: request.params
        }
      }

    } catch (error) {
      console.error('❌ Generation failed:', error)
      console.error('❌ Error type:', typeof error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'No message',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack',
        stringified: JSON.stringify(error)
      })
      
      if (error instanceof AIError) {
        throw error
      }
      
      // Handle specific Replicate API errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()
        
        // Authentication errors
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
          throw new AIError('Invalid Replicate API token. Check your REPLICATE_API_TOKEN.', 'AUTH_ERROR')
        }
        
        // Rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          throw new AIError('Replicate API rate limit exceeded. Please try again in a few minutes.', 'RATE_LIMIT_ERROR')
        }
        
        // Model errors
        if (errorMessage.includes('model not found') || errorMessage.includes('404')) {
          throw new AIError('Model not found. Check if the model exists and you have access.', 'MODEL_NOT_FOUND')
        }
        
        // Input validation errors
        if (errorMessage.includes('input') || errorMessage.includes('validation')) {
          throw new AIError(`Invalid input parameters: ${error.message}`, 'INVALID_INPUT')
        }
        
        // Quota/billing errors
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          throw new AIError('Replicate account quota exceeded. Check your billing status.', 'QUOTA_EXCEEDED')
        }
        
        // Network/timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
          throw new AIError('Network error. Please check your connection and try again.', 'NETWORK_ERROR')
        }
        
        // If we have an error message, use it
        throw new AIError(`Generation failed: ${error.message}`, 'GENERATION_START_ERROR')
      }
      
      // Handle non-Error objects
      const errorString = error && typeof error === 'object' 
        ? JSON.stringify(error) 
        : String(error)
      
      throw new AIError(
        `Failed to start generation: ${errorString || 'Unknown error'}`,
        'GENERATION_START_ERROR'
      )
    }
  }

  async getGenerationStatus(generationId: string): Promise<GenerationResponse> {
    try {
      // Use direct API call with proper headers as specified
      const response = await fetch(`https://api.replicate.com/v1/predictions/${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.replicate.apiToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`)
      }

      const prediction = await response.json()

      // Validate that we have the essential fields
      if (!prediction.id || !prediction.status) {
        throw new Error('Invalid response from Replicate API: missing id or status')
      }

      // Process output field properly - Replicate returns URLs array in 'output' field
      let urls: string[] | undefined = undefined
      let result: string[] | undefined = undefined

      if (prediction.output) {
        if (Array.isArray(prediction.output)) {
          urls = prediction.output
          result = prediction.output
        } else if (typeof prediction.output === 'string') {
          urls = [prediction.output]
          result = [prediction.output]
        }
      }

      // Calculate processing time if available
      let processingTime: number | undefined = undefined
      if (prediction.started_at && prediction.completed_at) {
        const startTime = new Date(prediction.started_at).getTime()
        const endTime = new Date(prediction.completed_at).getTime()
        processingTime = Math.round((endTime - startTime) / 1000) // in seconds
      }

      return {
        id: prediction.id,
        status: this.mapReplicateStatus(prediction.status),
        urls: urls,
        result: result, // Add result field for compatibility with auto-storage
        error: prediction.error as string | undefined,
        createdAt: prediction.created_at,
        completedAt: prediction.completed_at || undefined,
        processingTime: processingTime,
        metadata: prediction.input ? {
          prompt: (prediction.input as any).prompt,
          seed: (prediction.input as any).seed || 0,
          params: prediction.input as any
        } : undefined
      }

    } catch (error) {
      throw new AIError(
        `Failed to get generation status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_STATUS_ERROR'
      )
    }
  }

  async cancelGeneration(generationId: string): Promise<boolean> {
    try {
      await this.client.predictions.cancel(generationId)
      return true
    } catch (error) {
      return false
    }
  }

  async validateModel(modelUrl: string): Promise<boolean> {
    try {
      console.log('🔍 Validating model URL:', modelUrl)
      
      // Parse model URL format
      const modelParts = modelUrl.split(':')
      if (modelParts.length !== 2) {
        console.error('❌ Invalid model URL format. Expected: owner/name:version_id')
        return false
      }
      
      const [owner_name, version_id] = modelParts
      if (!owner_name.includes('/')) {
        console.error('❌ Invalid owner/name format. Expected: username/modelname')
        return false
      }
      
      // Check model version exists and is accessible
      const response = await fetch(`https://api.replicate.com/v1/models/${owner_name}/versions/${version_id}`, {
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.replicate.apiToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        console.error('❌ Model validation failed:', {
          status: response.status,
          statusText: response.statusText,
          modelUrl
        })
        
        if (response.status === 401) {
          throw new AIError('Invalid Replicate API token', 'AUTH_ERROR')
        } else if (response.status === 404) {
          throw new AIError(`Model not found: ${modelUrl}. Ensure the model exists and you have access.`, 'MODEL_NOT_FOUND')
        } else if (response.status === 403) {
          throw new AIError(`Access denied to model: ${modelUrl}. Check model permissions.`, 'ACCESS_DENIED')
        }
        
        return false
      }
      
      // Verify model is ready for inference
      const modelInfo = await response.json()
      if (modelInfo.status !== 'active') {
        console.error('❌ Model is not ready for inference:', {
          status: modelInfo.status,
          modelUrl
        })
        throw new AIError(`Model not ready for inference. Status: ${modelInfo.status}`, 'MODEL_NOT_READY')
      }
      
      console.log('✅ Model validation passed:', modelUrl)
      return true
      
    } catch (error) {
      console.error('❌ Model validation error:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      return false
    }
  }

  async getAvailableModels() {
    try {
      // Return curated list of verified models from config (updated for maximum quality)
      return [
        {
          id: AI_CONFIG.replicate.models.flux.ultra,
          name: 'FLUX.1.1 Pro Ultra',
          description: 'Maximum quality, 4MP resolution, Raw Mode support (25-50 steps)',
          type: 'base' as const
        },
        {
          id: AI_CONFIG.replicate.models.flux.pro,
          name: 'FLUX.1 Pro',
          description: 'Professional grade FLUX model (25+ steps)',
          type: 'base' as const
        },
        {
          id: AI_CONFIG.replicate.models.flux.dev,
          name: 'FLUX.1 Dev',
          description: 'Higher quality FLUX model (20+ steps)',
          type: 'base' as const
        },
        {
          id: AI_CONFIG.replicate.models.flux.generation,
          name: 'FLUX.1 Schnell',
          description: 'Fast, high-quality image generation (4 steps)',
          type: 'base' as const
        },
        {
          id: AI_CONFIG.replicate.models.sdxl.generation,
          name: 'Stable Diffusion XL',
          description: 'High-resolution image generation',
          type: 'base' as const
        },
        {
          id: AI_CONFIG.replicate.models.sdxl.turbo,
          name: 'SDXL Turbo',
          description: 'Faster SDXL variant (1-4 steps)',
          type: 'base' as const
        }
      ]
    } catch (error) {
      console.error('Failed to get available models:', error)
      return []
    }
  }

  private mapReplicateStatus(status: string): TrainingResponse['status'] | GenerationResponse['status'] {
    switch (status) {
      case 'starting':
        return 'starting'
      case 'processing':
        return 'processing'
      case 'succeeded':
        return 'succeeded'
      case 'failed':
        return 'failed'
      case 'canceled':
        return 'canceled'
      default:
        return 'processing'
    }
  }

  private async createZipFromUrls(urls: string[]): Promise<string> {
    const { createZipFromLocalFiles, validateImageFiles } = await import('../zip-creator')
    
    // Validate files exist
    const { valid, missing } = await validateImageFiles(urls)
    
    if (missing.length > 0) {
      console.warn(`⚠️ Missing ${missing.length} training files:`, missing.slice(0, 3))
    }
    
    if (valid.length === 0) {
      throw new Error('No valid training images found')
    }
    
    console.log(`✅ Found ${valid.length}/${urls.length} valid training files`)
    
    // Extract model ID from the first URL path
    const modelId = urls[0]?.split('/').find(part => part.match(/^[a-f0-9-]+$/)) || 'unknown'
    
    // Create ZIP from local files
    return await createZipFromLocalFiles(valid, `training-${modelId}`, modelId)
  }

  private estimateTrainingTime(imageCount: number, steps: number): number {
    // Estimate training time in minutes
    const baseTime = 30 // 30 minutes base
    const stepMultiplier = steps / 1000
    const imageMultiplier = Math.sqrt(imageCount) / 3
    
    return Math.ceil(baseTime * stepMultiplier * imageMultiplier)
  }

  private estimateGenerationTime(width: number, height: number, steps: number): number {
    // Estimate generation time in seconds
    const megapixels = (width * height) / (1024 * 1024)
    const baseTime = 10 // 10 seconds base
    const stepTime = steps * 0.5
    const resolutionTime = megapixels * 3
    
    return Math.ceil(baseTime + stepTime + resolutionTime)
  }

  private getOptimalLearningRate(task: string, imageCount: number): number {
    // Optimize learning rate based on task type and image count
    let baseLearningRate = 1e-4
    
    switch (task) {
      case 'face':
        baseLearningRate = 1e-4 // Conservative for faces to avoid artifacts
        break
      case 'style':
        baseLearningRate = 2e-4 // Higher for style training
        break
      case 'object':
        baseLearningRate = 1.5e-4 // Balanced for objects
        break
    }
    
    // Adjust based on image count - more images allow for higher learning rate
    if (imageCount < 10) {
      baseLearningRate *= 0.8 // Reduce for few images
    } else if (imageCount > 30) {
      baseLearningRate *= 1.2 // Increase for many images
    }
    
    return baseLearningRate
  }

  private getOptimalRank(task: string): number {
    // LoRA rank affects quality vs training speed/memory
    switch (task) {
      case 'face':
        return 32 // Higher rank for better facial detail preservation
      case 'style':
        return 64 // Highest rank for complex style patterns
      case 'object':
        return 16 // Lower rank sufficient for objects
      default:
        return 32
    }
  }

  private isRetryableError(error: Error): boolean {
    // Determine if an error is worth retrying
    const retryableMessages = [
      'rate limit',
      'timeout',
      'server error',
      'internal error',
      'temporarily unavailable',
      'too many requests',
      'network error',
      'connection',
      'service unavailable'
    ]
    
    const errorMessage = error.message.toLowerCase()
    return retryableMessages.some(msg => errorMessage.includes(msg))
  }

  private determineFluxModelQuality(userPlan?: string): 'schnell' | 'dev' | 'pro' {
    // Determine FLUX model quality based on user plan
    switch (userPlan) {
      case 'GOLD':
        return 'pro' // Highest quality for premium users
      case 'PREMIUM':
        return 'dev' // Good balance of quality and speed
      case 'FREE':
      default:
        return 'schnell' // Fast and free
    }
  }

  private selectFluxModelByPlan(userPlan: string, steps: number): string {
    // Select appropriate FLUX model based on user plan and steps for maximum quality
    switch (userPlan) {
      case 'STARTER':
        // Use FLUX 1.1 Pro Ultra for maximum quality testing (4MP support)
        return AI_CONFIG.replicate.models.flux.ultra
      case 'GOLD':
        // Use FLUX 1.1 Pro Ultra for highest quality at high steps, Pro for lower steps
        return steps >= 25 ? AI_CONFIG.replicate.models.flux.ultra : AI_CONFIG.replicate.models.flux.pro
      case 'PREMIUM':
        // Use FLUX Pro for premium users, Dev for lower steps
        return steps >= 20 ? AI_CONFIG.replicate.models.flux.pro : AI_CONFIG.replicate.models.flux.dev
      case 'FREE':
      default:
        // Always use FLUX Schnell for free users (optimized for low steps)
        return AI_CONFIG.replicate.models.flux.generation
    }
  }

  private getFluxModelVersion(quality: 'schnell' | 'dev' | 'pro'): string {
    switch (quality) {
      case 'pro':
        return AI_CONFIG.replicate.models.flux.pro
      case 'dev':
        return AI_CONFIG.replicate.models.flux.dev
      case 'schnell':
      default:
        return AI_CONFIG.replicate.models.flux.generation
    }
  }

  private getOptimalStepsForFlux(quality: 'schnell' | 'dev' | 'pro', requestedSteps?: number): number {
    // Optimize steps based on model quality
    switch (quality) {
      case 'schnell':
        return Math.min(requestedSteps || 4, 8) // Schnell is optimized for 1-8 steps
      case 'dev':
        return Math.min(requestedSteps || 20, 50) // Dev works well with 10-50 steps
      case 'pro':
        return Math.min(requestedSteps || 25, 100) // Pro can handle more steps for quality
      default:
        return 4
    }
  }

  private getOutputQuality(userPlan?: string): number {
    // Output quality based on user plan
    switch (userPlan) {
      case 'GOLD':
        return 95 // Highest quality
      case 'PREMIUM':
        return 85 // Good quality
      case 'FREE':
      default:
        return 80 // Standard quality
    }
  }

  private extractModelUrl(output: any): string | undefined {
    // Extract model URL from Replicate training output
    if (!output) {
      return undefined
    }
    
    // If it's already a string, return as is
    if (typeof output === 'string') {
      return output
    }
    
    // Handle complex object response from FLUX training
    if (typeof output === 'object') {
      // For FLUX models, prefer the version string as it's used for generation
      if (output.version && typeof output.version === 'string') {
        return output.version
      }
      
      // Fallback to weights URL if version not available
      if (output.weights && typeof output.weights === 'string') {
        return output.weights
      }
      
      // Handle other possible formats
      if (output.url && typeof output.url === 'string') {
        return output.url
      }
    }
    
    console.warn('Unable to extract model URL from output:', output)
    return undefined
  }

  private extractModelNameFromDestination(destination?: string): string {
    // Extract model name from destination URL or output
    if (!destination || typeof destination !== 'string') {
      return 'Unknown Model'
    }
    
    try {
      // Handle different destination formats
      // Format: username/model-name or https://replicate.com/username/model-name
      const parts = destination.split('/')
      const modelPart = parts[parts.length - 1] || parts[parts.length - 2]
      
      if (!modelPart) {
        return 'Custom Model'
      }
      
      // Clean up the model name
      return modelPart
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim() || 'Custom Model'
    } catch (error) {
      console.warn('Error extracting model name from destination:', destination, error)
      return 'Custom Model'
    }
  }

  private sanitizeModelName(name: string): string {
    // Sanitize model name to meet Replicate requirements:
    // - Only lowercase letters, numbers, dashes, underscores, periods
    // - Cannot start or end with dash, underscore, or period
    
    let sanitized = name
      .toLowerCase()                    // Convert to lowercase
      .replace(/[^a-z0-9\-_.]/g, '-')  // Replace invalid chars with dashes
      .replace(/[-_.]+/g, '-')         // Replace multiple consecutive special chars with single dash
      .replace(/^[-_.]+/, '')          // Remove leading special chars
      .replace(/[-_.]+$/, '')          // Remove trailing special chars
    
    // Ensure it's not empty and has valid length
    if (!sanitized) {
      sanitized = `model-${Date.now()}`
    }
    
    // Ensure it doesn't start or end with special chars
    if (/^[-_.]/.test(sanitized)) {
      sanitized = 'm' + sanitized
    }
    if (/[-_.]$/.test(sanitized)) {
      sanitized = sanitized + 'm'
    }
    
    return sanitized
  }

}