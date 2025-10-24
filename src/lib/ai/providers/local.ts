import { 
  AIProvider, 
  TrainingRequest, 
  TrainingResponse, 
  GenerationRequest, 
  GenerationResponse,
  AIError 
} from '../base'

// Mock provider for development and testing
export class LocalProvider extends AIProvider {
  private jobs: Map<string, any> = new Map()

  constructor() {
    super()
  }

  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    const jobId = this.generateJobId()
    
    // Simulate training job
    const job = {
      id: jobId,
      type: 'training',
      status: 'starting',
      request,
      createdAt: new Date().toISOString(),
      progress: 0
    }

    this.jobs.set(jobId, job)

    // Simulate progress
    this.simulateTrainingProgress(jobId)

    return {
      id: jobId,
      status: 'starting',
      createdAt: job.createdAt,
      estimatedTime: 5 // 5 minutes for mock
    }
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    const job = this.jobs.get(trainingId)
    
    if (!job) {
      throw new AIError('Training job not found', 'TRAINING_NOT_FOUND', 404)
    }

    const response: TrainingResponse = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }

    if (job.status === 'succeeded' && job.output) {
      response.model = {
        url: job.output.modelUrl,
        name: job.output.modelName
      }
    }

    if (job.status === 'failed' && job.error) {
      response.error = job.error
    }

    return response
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    const job = this.jobs.get(trainingId)
    
    if (!job) {
      return false
    }

    job.status = 'canceled'
    job.completedAt = new Date().toISOString()
    
    return true
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    const jobId = this.generateJobId()
    
    // Simulate generation job
    const job = {
      id: jobId,
      type: 'generation',
      status: 'starting',
      request,
      createdAt: new Date().toISOString(),
      progress: 0
    }

    this.jobs.set(jobId, job)

    // Simulate progress
    this.simulateGenerationProgress(jobId)

    return {
      id: jobId,
      status: 'starting',
      createdAt: job.createdAt,
      estimatedTime: 30, // 30 seconds for mock
      metadata: {
        prompt: request.prompt,
        seed: request.params.seed || 42,
        params: request.params
      }
    }
  }

  async getGenerationStatus(generationId: string): Promise<GenerationResponse> {
    const job = this.jobs.get(generationId)
    
    if (!job) {
      throw new AIError('Generation job not found', 'GENERATION_NOT_FOUND', 404)
    }

    const response: GenerationResponse = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      metadata: job.metadata
    }

    if (job.status === 'succeeded' && job.output) {
      response.urls = job.output.urls
    }

    if (job.status === 'failed' && job.error) {
      response.error = job.error
    }

    return response
  }

  async cancelGeneration(generationId: string): Promise<boolean> {
    const job = this.jobs.get(generationId)
    
    if (!job) {
      return false
    }

    job.status = 'canceled'
    job.completedAt = new Date().toISOString()
    
    return true
  }

  async validateModel(modelUrl: string): Promise<boolean> {
    // For mock provider, always return true for demo purposes
    return true
  }

  async getAvailableModels() {
    return [
      {
        id: 'mock-flux',
        name: 'Mock FLUX Model',
        description: 'Mock model for development',
        type: 'base' as const
      },
      {
        id: 'mock-sdxl',
        name: 'Mock SDXL Model',
        description: 'Mock SDXL model for development',
        type: 'base' as const
      }
    ]
  }

  private generateJobId(): string {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2)
  }

  private simulateTrainingProgress(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 10
      job.progress = Math.min(progress, 100)
      job.status = 'processing'

      if (progress >= 100) {
        clearInterval(interval)
        job.status = 'succeeded'
        job.progress = 100
        job.completedAt = new Date().toISOString()
        
        // Mock output
        job.output = {
          modelUrl: `https://mock-storage.com/models/${jobId}.safetensors`,
          modelName: `trained_model_${jobId.slice(-8)}`
        }
      }
    }, 2000) // Update every 2 seconds
  }

  private simulateGenerationProgress(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 20
      job.progress = Math.min(progress, 100)
      job.status = 'processing'

      if (progress >= 100) {
        clearInterval(interval)
        job.status = 'succeeded'
        job.progress = 100
        job.completedAt = new Date().toISOString()
        
        // Mock generated images (placeholder images)
        const numOutputs = job.request.params.num_outputs || 1
        job.output = {
          urls: Array.from({ length: numOutputs }, (_, i) => 
            `https://picsum.photos/${job.request.params.width}/${job.request.params.height}?random=${jobId}_${i}`
          )
        }

        job.metadata = {
          prompt: job.request.prompt,
          seed: job.request.params.seed || 42,
          params: job.request.params
        }
      }
    }, 1000) // Update every 1 second
  }
}