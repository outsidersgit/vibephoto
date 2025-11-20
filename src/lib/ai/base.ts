export interface TrainingRequest {
  modelId: string
  modelName: string
  name: string
  triggerWord: string
  classWord: string
  imageUrls: string[]
  params: TrainingParams
  webhookUrl?: string
}

export interface TrainingParams {
  // Core training parameters
  steps: number
  learningRate: number
  batchSize: number
  resolution: number | string // Support both number and string formats
  
  // Advanced FLUX parameters for maximum quality
  lora_rank?: number
  network_alpha?: number
  lora_type?: 'subject' | 'style' | 'concept'
  
  // Training optimization
  optimizer?: 'adamw8bit' | 'prodigy' | 'lion' | 'adamw'
  mixed_precision?: 'fp16' | 'bf16' | 'no'
  gradient_checkpointing?: boolean
  cache_latents?: boolean
  
  // Quality parameters
  caption_dropout_rate?: number
  noise_offset?: number
  shuffle_tokens?: boolean
  autocaption?: boolean
  
  // Compatibility with different naming conventions
  learning_rate?: number // Alternative naming for learningRate
  batch_size?: number     // Alternative naming for batchSize
  
  // Optional parameters
  seed?: number
}

export interface TrainingResponse {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  model?: {
    url: string
    name: string
  }
  logs?: string[]
  error?: string
  progress?: number
  estimatedTime?: number
  createdAt: string
  completedAt?: string
  metadata?: any
}

export interface GenerationRequest {
  modelUrl?: string
  prompt: string
  negativePrompt?: string
  params: GenerationParams
  triggerWord?: string
  classWord?: string // CRÍTICO: palavra de classe (person, woman, man) para construção do prompt
  webhookUrl?: string
}

export interface GenerationParams {
  width: number
  height: number
  steps: number
  guidance_scale: number
  scheduler?: string
  seed?: number
  num_outputs?: number
  safety_checker?: boolean
  // Astria-specific parameters
  aspectRatio?: string // enum: 1:1, 16:9, 9:16, etc
  super_resolution?: boolean
  inpaint_faces?: boolean
  style?: string // enum: Cinematic, Photographic, etc
  color_grading?: string // enum: Film Velvia, Film Portra, Ektar
  film_grain?: boolean
  use_lpw?: boolean
  // FLUX/Replicate-specific parameters (ignorados pelo Astria)
  safety_tolerance?: number
  raw_mode?: boolean
  output_format?: string
  output_quality?: number // DEPRECATED: não suportado pela API Astria
}

export interface GenerationResponse {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  urls?: string[]
  error?: string
  progress?: number
  estimatedTime?: number
  createdAt: string
  completedAt?: string
  metadata?: {
    prompt: string
    seed: number
    params: GenerationParams
    tune_id?: string // Astria tune ID (para polling) - extraído de tunes[0].id
    prompt_id?: string // Astria prompt ID
    modelUrl?: string // Model URL usado
    endpoint_used?: string // Endpoint usado
    astriaUrl?: string // URL completa do Astria
    [key: string]: any // Permitir campos adicionais
  }
}

export interface WebhookPayload {
  id: string
  status: string
  output?: any
  error?: string
  logs?: string[]
  completed_at?: string
  version?: string
  model?: {
    url?: {
      version?: string
      weights?: string
    } | string
  }
  metrics?: {
    total_time?: number
    prediction_time?: number
  }
}

export abstract class AIProvider {
  abstract startTraining(request: TrainingRequest): Promise<TrainingResponse>
  
  abstract getTrainingStatus(trainingId: string): Promise<TrainingResponse>
  
  abstract cancelTraining(trainingId: string): Promise<boolean>
  
  abstract generateImage(request: GenerationRequest): Promise<GenerationResponse>
  
  abstract getGenerationStatus(generationId: string): Promise<GenerationResponse>
  
  abstract cancelGeneration(generationId: string): Promise<boolean>
  
  abstract validateModel(modelUrl: string): Promise<boolean>
  
  // Optional: Get prediction status for any job (training or generation)
  getPredictionStatus?(jobId: string): Promise<{
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    output?: any
    error?: string
    logs?: string[]
  }>
  
  // Optional: Get available models
  getAvailableModels?(): Promise<Array<{
    id: string
    name: string
    description: string
    type: 'base' | 'lora' | 'checkpoint'
  }>>
}

export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AIError'
  }
}

// Utility functions
export function generateTriggerWord(): string {
  const prefixes = ['TOK', 'SUBJ', 'PERS', 'CHAR', 'FACE']
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const randomNumber = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `${randomPrefix}${randomNumber}`
}

export function validatePrompt(prompt: string): { isValid: boolean; error?: string } {
  if (!prompt || prompt.trim().length === 0) {
    return { isValid: false, error: 'Prompt cannot be empty' }
  }
  
  if (prompt.length > 2500) {
    return { isValid: false, error: 'Prompt is too long (max 2500 characters)' }
  }
  
  // Check for potentially harmful content
  const bannedWords = ['nude', 'naked', 'nsfw', 'explicit', 'sexual']
  const lowerPrompt = prompt.toLowerCase()
  
  for (const word of bannedWords) {
    if (lowerPrompt.includes(word)) {
      return { isValid: false, error: 'Prompt contains inappropriate content' }
    }
  }
  
  return { isValid: true }
}

export function sanitizePrompt(prompt: string): string {
  return prompt
    .trim()
    .replace(/[^\w\s\-,.!?]/g, '') // Remove special characters except basic punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 1000) // Limit length
}

export function estimateTrainingTime(
  imageCount: number, 
  steps: number, 
  resolution: number
): number {
  // Base time calculation in minutes
  const baseTimePerStep = 0.1 // 6 seconds per step
  const imageMultiplier = Math.sqrt(imageCount) / 3
  const resolutionMultiplier = Math.pow(resolution / 512, 1.5)
  
  return Math.ceil(steps * baseTimePerStep * imageMultiplier * resolutionMultiplier)
}

export function estimateGenerationTime(
  width: number, 
  height: number, 
  steps: number
): number {
  // Base time calculation in seconds
  const megapixels = (width * height) / (1024 * 1024)
  const baseTime = 5 // 5 seconds base
  const stepTime = steps * 0.5 // 0.5 seconds per step
  const resolutionTime = megapixels * 2 // 2 seconds per megapixel
  
  return Math.ceil(baseTime + stepTime + resolutionTime)
}