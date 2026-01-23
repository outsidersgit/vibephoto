import Replicate from 'replicate'
import { AI_CONFIG } from '../config'
import { AIError } from '../base'
import { UPSCALE_CONFIG, UpscaleOptions, UpscaleJob } from './upscale-config'
import { 
  validateImageUrl, 
  validateUpscaleOptions, 
  mergeUpscaleOptions,
  generateUpscaleJobId,
  generateRandomSeed 
} from './upscale-utils'
import { downloadAndStoreImages } from '@/lib/storage/utils'

export class TopazUpscaler {
  private client: Replicate

  constructor() {
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured', 'REPLICATE_CONFIG_ERROR')
    }

    this.client = new Replicate({
      auth: AI_CONFIG.replicate.apiToken,
      // Add default headers including Prefer for synchronous responses
      userAgent: 'VibePhoto-Upscale/1.0'
    })
  }

  /**
   * Faz upscale de uma imagem usando Topaz Labs
   */
  async upscaleImage(
    imageUrl: string, 
    options: Partial<UpscaleOptions>,
    preferSync: boolean = true
  ): Promise<{ jobId: string; status: string; result?: string[] }> {
    console.log('🔍 Starting Topaz Labs upscale:', { imageUrl: imageUrl.substring(0, 50), options })

    // Valida URL da imagem
    const urlValidation = validateImageUrl(imageUrl)
    if (!urlValidation.isValid) {
      throw new AIError(urlValidation.error!, 'INVALID_IMAGE_URL')
    }

    // Mescla opções com defaults
    const fullOptions = mergeUpscaleOptions(options)
    
    // Gera seed aleatório se não fornecido
    if (!fullOptions.seed) {
      fullOptions.seed = generateRandomSeed()
    }

    // Valida opções
    const validation = validateUpscaleOptions(fullOptions)
    if (!validation.isValid) {
      throw new AIError(
        `Opções inválidas: ${validation.errors.join(', ')}`,
        'INVALID_UPSCALE_OPTIONS'
      )
    }

    try {
      console.log('🚀 Sending upscale request to Topaz Labs via Replicate')
      console.log('🔑 API Token configured:', AI_CONFIG.replicate.apiToken ? 'YES' : 'NO')
      
      // Configure webhook for upscale completion - only for async processing
      const webhookConfig: any = {}
      const baseUrl = process.env.NEXTAUTH_URL

      // UPSCALE FIX: Only add webhook if NOT preferring sync (to avoid status conflicts)
      if (!preferSync && baseUrl && baseUrl.startsWith('https://')) {
        webhookConfig.webhook = `${baseUrl}/api/webhooks/replicate`
        webhookConfig.webhook_events_filter = ['start', 'output', 'completed']
        console.log('🔗 Using webhook for async upscale:', webhookConfig.webhook)
      } else {
        if (preferSync) {
          console.log('⚡ Skipping webhook (synchronous processing preferred - no conflicts)')
        } else {
          console.log('⚠️ Skipping webhook (development mode - no HTTPS URL available)')
        }
      }

      // Configure request options for Topaz Labs model
      const requestOptions: any = {
        version: "2fdc3b86a01d338ae89ad58e5d9241398a8a01de9b0dda41ba8a0434c8a00dc3",
        input: {
          image: imageUrl,
          upscale_factor: fullOptions.upscale_factor || (fullOptions.scale_factor ? fullOptions.scale_factor + "x" : "2x"),
          enhance_model: fullOptions.enhance_model || "Standard V2",
          output_format: fullOptions.output_format || "jpg", // OTIMIZAÇÃO: JPG por padrão
          face_enhancement: fullOptions.face_enhancement !== undefined ? fullOptions.face_enhancement : true,
          subject_detection: fullOptions.subject_detection || "None",
          face_enhancement_strength: fullOptions.face_enhancement_strength || 0.8,
          face_enhancement_creativity: fullOptions.face_enhancement_creativity || 0.0
        },
        ...webhookConfig
      }

      // Add Prefer header if preferring synchronous response
      let prediction
      if (preferSync) {
        try {
          prediction = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${AI_CONFIG.replicate.apiToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'wait=60'
            },
            body: JSON.stringify(requestOptions)
          })
          
          if (prediction.ok) {
            const result = await prediction.json()
            console.log('✅ Synchronous upscale response received:', result.status)
            
            // If completed synchronously, return with results
            if (result.status === 'succeeded' && result.output) {
              const outputUrls = Array.isArray(result.output) ? result.output : [result.output]
              console.log('✅ Synchronous upscale completed, preparing permanent storage...')
              
              return {
                jobId: result.id,
                status: result.status,
                result: outputUrls,
                requiresStorage: true // Flag indicating these URLs need immediate storage
              }
            }
            
            // If still processing, continue with normal polling
            return {
              jobId: result.id,
              status: result.status
            }
          } else {
            console.warn('⚠️ Synchronous request failed, falling back to async')
          }
        } catch (syncError) {
          console.warn('⚠️ Synchronous request error, falling back to async:', syncError)
        }
      }

      // Fallback to standard async prediction using direct fetch
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${AI_CONFIG.replicate.apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VibePhoto-Upscale/1.0'
        },
        body: JSON.stringify(requestOptions)
      })
      
      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Request to ${response.url} failed with status ${response.status} ${response.statusText}: ${errorBody}`)
      }
      
      prediction = await response.json()

      console.log('✅ Upscale job created:', prediction.id)

      return {
        jobId: prediction.id,
        status: prediction.status
      }

    } catch (error) {
      console.error('❌ Topaz Labs upscale error:', error)
      
      if (error instanceof Error) {
        throw new AIError(
          `Falha no upscale: ${error.message}`,
          'UPSCALE_FAILED'
        )
      }
      
      throw new AIError('Erro desconhecido no upscale', 'UNKNOWN_UPSCALE_ERROR')
    }
  }

  /**
   * Verifica o status de um job de upscale
   */
  async getUpscaleStatus(jobId: string): Promise<{
    status: string
    progress?: number
    result?: string[]
    error?: string
  }> {
    try {
      const prediction = await this.client.predictions.get(jobId)
      
      return {
        status: prediction.status,
        progress: this.calculateProgress(prediction.status),
        result: prediction.output ? (Array.isArray(prediction.output) ? prediction.output : [prediction.output]) : undefined,
        error: prediction.error
      }
    } catch (error) {
      console.error('❌ Error checking Topaz upscale status:', error)
      throw new AIError('Falha ao verificar status do upscale', 'STATUS_CHECK_FAILED')
    }
  }

  /**
   * Cancela um job de upscale
   */
  async cancelUpscale(jobId: string): Promise<boolean> {
    try {
      await this.client.predictions.cancel(jobId)
      console.log('🛑 Upscale job cancelled:', jobId)
      return true
    } catch (error) {
      console.error('❌ Error cancelling upscale:', error)
      return false
    }
  }

  /**
   * Faz upscale de múltiplas imagens (batch)
   */
  async batchUpscale(
    imageUrls: string[],
    options: Partial<UpscaleOptions>
  ): Promise<{ jobIds: string[]; totalJobs: number }> {
    console.log('📦 Starting batch upscale:', { count: imageUrls.length })

    const jobIds: string[] = []
    const errors: string[] = []

    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        console.log(`🔄 Processing image ${index + 1}/${imageUrls.length}`)
        
        const result = await this.upscaleImage(imageUrl, options)
        jobIds.push(result.jobId)
        
        // Pequena pausa entre requests para evitar rate limiting
        if (index < imageUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        errors.push(`Imagem ${index + 1}: ${errorMessage}`)
        console.error(`❌ Failed to upscale image ${index + 1}:`, error)
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️ Some images failed to upscale:', errors)
    }

    return {
      jobIds,
      totalJobs: imageUrls.length
    }
  }

  /**
   * Verifica status de múltiplos jobs
   */
  async getBatchStatus(jobIds: string[]): Promise<{
    completed: number
    processing: number
    failed: number
    results: string[]
  }> {
    const statuses = await Promise.all(
      jobIds.map(jobId => this.getUpscaleStatus(jobId).catch(() => ({ status: 'failed' })))
    )

    const completed = statuses.filter(s => s.status === 'succeeded').length
    const processing = statuses.filter(s => s.status === 'processing' || s.status === 'starting').length
    const failed = statuses.filter(s => s.status === 'failed' || s.status === 'canceled').length
    
    const results = statuses
      .filter(s => s.result && s.result.length > 0)
      .flatMap(s => s.result!)

    return { completed, processing, failed, results }
  }

  /**
   * Calcula progresso baseado no status
   */
  private calculateProgress(status: string): number {
    const progressMap: Record<string, number> = {
      'starting': 10,
      'processing': 50,
      'succeeded': 100,
      'failed': 0,
      'canceled': 0
    }
    
    return progressMap[status] || 0
  }

  /**
   * Verifica se o serviço está disponível
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Tenta fazer uma requisição simples para verificar conectividade
      const models = await this.client.models.list()
      return Array.isArray(models.results)
    } catch (error) {
      console.error('❌ Topaz Labs health check failed:', error)
      return false
    }
  }

  /**
   * Melhora qualidade de imagem (wrapper simplificado)
   */
  async enhanceQuality(
    imageUrl: string,
    settings?: {
      enhance_model?: string
      face_enhancement?: boolean
      output_format?: string
    }
  ): Promise<{ jobId: string; status: string }> {
    const enhanceOptions: Partial<UpscaleOptions> = {
      upscale_factor: "2x", // Mínimo para melhoria
      enhance_model: settings?.enhance_model || "High Fidelity V2", // Para qualidade
      face_enhancement: settings?.face_enhancement || true,
      output_format: settings?.output_format || "jpg", // OTIMIZAÇÃO: JPG por padrão
      subject_detection: "All"
    }

    return this.upscaleImage(imageUrl, enhanceOptions)
  }

  /**
   * Redimensiona com IA (wrapper para casos específicos)
   */
  async smartResize(
    imageUrl: string,
    targetScale: 2 | 4 | 6,
    preserveDetails: boolean = true
  ): Promise<{ jobId: string; status: string }> {
    const resizeOptions: Partial<UpscaleOptions> = {
      upscale_factor: `${targetScale}x` as "2x" | "4x" | "6x",
      enhance_model: preserveDetails ? "High Fidelity V2" : "Standard V2",
      face_enhancement: true,
      subject_detection: "All",
      output_format: "jpg" // OTIMIZAÇÃO: JPG por padrão
    }

    return this.upscaleImage(imageUrl, resizeOptions)
  }
}