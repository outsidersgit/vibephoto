import axios from 'axios'
import { 
  AIProvider, 
  TrainingRequest, 
  TrainingResponse, 
  GenerationRequest, 
  GenerationResponse,
  AIError 
} from '../base'
import { AI_CONFIG } from '../config'

interface RunPodJob {
  id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  output?: any
  error?: string
  executionTime?: number
  delayTime?: number
}

interface RunPodResponse {
  id: string
  status: string
}

export class RunPodProvider extends AIProvider {
  private apiKey: string
  private endpointId: string
  private baseUrl: string

  constructor() {
    super()
    
    if (!AI_CONFIG.runpod.apiKey || !AI_CONFIG.runpod.endpointId) {
      throw new AIError('RunPod API key and endpoint ID not configured', 'RUNPOD_CONFIG_ERROR')
    }

    this.apiKey = AI_CONFIG.runpod.apiKey
    this.endpointId = AI_CONFIG.runpod.endpointId
    this.baseUrl = `https://api.runpod.ai/v2/${this.endpointId}`
  }

  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    try {
      const payload = {
        input: {
          task: 'training',
          model_name: request.modelName,
          trigger_word: request.triggerWord,
          class_word: request.classWord,
          image_urls: request.imageUrls,
          training_params: {
            max_train_steps: request.params.steps,
            learning_rate: request.params.learningRate,
            train_batch_size: request.params.batchSize,
            resolution: request.params.resolution,
            seed: request.params.seed
          },
          webhook_url: request.webhookUrl || 
            `${AI_CONFIG.webhooks.baseUrl}${AI_CONFIG.webhooks.endpoints.training}`
        }
      }

      const response = await this.makeRequest('POST', '/run', payload)
      
      return {
        id: response.id,
        status: this.mapRunPodStatus(response.status),
        createdAt: new Date().toISOString(),
        estimatedTime: this.estimateTrainingTime(request.imageUrls.length, request.params.steps)
      }

    } catch (error) {
      throw new AIError(
        `Failed to start training: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAINING_START_ERROR'
      )
    }
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    try {
      const response = await this.makeRequest('GET', `/status/${trainingId}`)
      
      return {
        id: response.id,
        status: this.mapRunPodStatus(response.status),
        model: response.output?.model_url ? {
          url: response.output.model_url,
          name: response.output.model_name || `model_${trainingId.slice(-8)}`
        } : undefined,
        logs: response.output?.logs,
        error: response.error,
        createdAt: response.createdAt || new Date().toISOString(),
        completedAt: response.output?.completed_at
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
      await this.makeRequest('POST', `/cancel/${trainingId}`)
      return true
    } catch (error) {
      return false
    }
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const payload = {
        input: {
          task: 'generation',
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          model_url: request.modelUrl,
          generation_params: {
            width: request.params.width,
            height: request.params.height,
            num_inference_steps: request.params.steps,
            guidance_scale: request.params.guidance_scale,
            scheduler: request.params.scheduler,
            seed: request.params.seed,
            num_outputs: request.params.num_outputs || 1,
            safety_checker: request.params.safety_checker
          },
          webhook_url: request.webhookUrl || 
            `${AI_CONFIG.webhooks.baseUrl}${AI_CONFIG.webhooks.endpoints.generation}`
        }
      }

      const response = await this.makeRequest('POST', '/run', payload)
      
      return {
        id: response.id,
        status: this.mapRunPodStatus(response.status),
        createdAt: new Date().toISOString(),
        estimatedTime: this.estimateGenerationTime(
          request.params.width,
          request.params.height,
          request.params.steps
        ),
        metadata: {
          prompt: request.prompt,
          seed: request.params.seed || 0,
          params: request.params
        }
      }

    } catch (error) {
      throw new AIError(
        `Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_START_ERROR'
      )
    }
  }

  async getGenerationStatus(generationId: string): Promise<GenerationResponse> {
    try {
      const response = await this.makeRequest('GET', `/status/${generationId}`)
      
      return {
        id: response.id,
        status: this.mapRunPodStatus(response.status),
        urls: response.output?.images,
        error: response.error,
        createdAt: response.createdAt || new Date().toISOString(),
        completedAt: response.output?.completed_at,
        metadata: response.output?.metadata
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
      await this.makeRequest('POST', `/cancel/${generationId}`)
      return true
    } catch (error) {
      return false
    }
  }

  async validateModel(modelUrl: string): Promise<boolean> {
    try {
      // Send a test generation request with minimal parameters
      const testPayload = {
        input: {
          task: 'validate',
          model_url: modelUrl
        }
      }

      const response = await this.makeRequest('POST', '/validate', testPayload)
      return response.valid === true

    } catch (error) {
      return false
    }
  }

  async getAvailableModels() {
    try {
      const response = await this.makeRequest('GET', '/models')
      return response.models || []
    } catch (error) {
      // Return default models if API call fails
      return [
        {
          id: 'flux-dev',
          name: 'FLUX.1 Dev',
          description: 'High-quality image generation model',
          type: 'base' as const
        },
        {
          id: 'sdxl-base',
          name: 'Stable Diffusion XL',
          description: 'High-resolution image generation',
          type: 'base' as const
        }
      ]
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data
      }

      const response = await axios(config)
      return response.data

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message
        throw new AIError(
          `RunPod API error: ${message}`,
          'RUNPOD_API_ERROR',
          error.response?.status || 500
        )
      }
      throw error
    }
  }

  private mapRunPodStatus(status: string): TrainingResponse['status'] | GenerationResponse['status'] {
    switch (status) {
      case 'IN_QUEUE':
        return 'starting'
      case 'IN_PROGRESS':
        return 'processing'
      case 'COMPLETED':
        return 'succeeded'
      case 'FAILED':
        return 'failed'
      case 'CANCELLED':
        return 'canceled'
      default:
        return 'processing'
    }
  }

  private estimateTrainingTime(imageCount: number, steps: number): number {
    // Estimate training time in minutes (RunPod is generally faster)
    const baseTime = 20 // 20 minutes base
    const stepMultiplier = steps / 1000
    const imageMultiplier = Math.sqrt(imageCount) / 4
    
    return Math.ceil(baseTime * stepMultiplier * imageMultiplier)
  }

  private estimateGenerationTime(width: number, height: number, steps: number): number {
    // Estimate generation time in seconds (RunPod is generally faster)
    const megapixels = (width * height) / (1024 * 1024)
    const baseTime = 5 // 5 seconds base
    const stepTime = steps * 0.3
    const resolutionTime = megapixels * 2
    
    return Math.ceil(baseTime + stepTime + resolutionTime)
  }
}