import Replicate from 'replicate'
import { AIError } from '../base'
import { AI_CONFIG } from '../config'

export interface UpscaleResult {
  jobId: string
  status: 'processing' | 'succeeded' | 'failed'
  result?: string[]
  requiresStorage?: boolean
}

export class NanoBananaUpscaler {
  private replicate: Replicate
  private modelName = 'google/nano-banana-pro'

  // Prompt consolidado aprovado pelo usuário
  private readonly UPSCALE_PROMPT = `Enhance and upscale the image to ultra-high resolution (4K quality) while preserving the original identity, proportions, colors, and composition.

Increase clarity and fine details in a natural and realistic way.
Reduce noise, grain, compression artifacts, and AI imperfections.
Improve texture definition (skin, hair, fabric, materials, surfaces) without over-sharpening.

Do NOT change the subject, facial features, body proportions, style, lighting, or framing.
Do NOT add, remove, or redesign any elements.
Do NOT introduce artistic effects or stylization.

The final result must look like the same image, only sharper, cleaner, and higher resolution — suitable for professional use, printing, and high-quality digital displays.

IMPORTANT: Avoid the following issues:
over-sharpening, artificial texture, plastic skin, exaggerated details, style change, color shift, facial distortion, added elements, unrealistic enhancement, halos, artifacts.`

  constructor() {
    if (!AI_CONFIG.replicate.apiToken) {
      throw new AIError('Replicate API token not configured', 'REPLICATE_CONFIG_ERROR')
    }

    this.replicate = new Replicate({
      auth: AI_CONFIG.replicate.apiToken,
      userAgent: 'VibePhoto-Upscale/2.0-NanoBanana'
    })

    console.log(`🍌 Nano Banana Pro Upscaler initialized (4K quality)`)
  }

  /**
   * Upscale de uma imagem usando Nano Banana Pro (4K)
   * Interface compatível com TopazUpscaler para substituição seamless
   */
  async upscaleImage(
    imageUrl: string,
    options: any = {},
    preferSync: boolean = true
  ): Promise<UpscaleResult> {
    console.log('🍌 Starting Nano Banana Pro upscale (4K):', { imageUrl: imageUrl.substring(0, 50) })

    // Valida URL da imagem (HTTP/HTTPS only)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      throw new AIError(
        'Invalid image URL: Nano Banana Pro requires HTTP(S) URLs, not data URLs',
        'INVALID_IMAGE_URL'
      )
    }

    try {
      // Configurar webhook para processamento assíncrono (produção)
      const webhookConfig: any = {}
      const baseUrl = process.env.NEXTAUTH_URL

      // Só adiciona webhook se não preferir sync E se tiver HTTPS
      if (!preferSync && baseUrl && baseUrl.startsWith('https://')) {
        webhookConfig.webhook = `${baseUrl}/api/webhooks/replicate`
        webhookConfig.webhook_events_filter = ['start', 'output', 'completed']
        console.log('🔗 Webhook configurado para upscale assíncrono:', webhookConfig.webhook)
      } else {
        if (preferSync) {
          console.log('⚡ Processamento síncrono preferido (sem webhook)')
        } else {
          console.log('⚠️ Webhook ignorado (dev mode - sem HTTPS)')
        }
      }

      // Preparar input para Nano Banana Pro
      const input: any = {
        prompt: this.UPSCALE_PROMPT,
        image_input: [imageUrl], // Array com single URL
        output_format: 'jpg',
        aspect_ratio: 'match_input_image', // Preserva proporções originais
        resolution: '4K', // Máxima qualidade
        safety_filter_level: 'block_only_high'
      }

      console.log('🍌 Nano Banana Pro input:', {
        imageUrl: imageUrl.substring(0, 80) + '...',
        outputFormat: input.output_format,
        aspectRatio: input.aspect_ratio,
        resolution: input.resolution,
        safetyLevel: input.safety_filter_level
      })

      // Opções da prediction
      // Usar SDK do Replicate (aceita 'model' em vez de 'version')
      const predictionOptions: any = {
        model: this.modelName,
        input,
        ...webhookConfig
      }

      // Usar Replicate SDK em vez de fetch direto
      console.log('🔧 Creating prediction via Replicate SDK...')
      const prediction = await this.replicate.predictions.create(predictionOptions)

      console.log('✅ Upscale job criado:', prediction.id, 'status:', prediction.status)

      // Se completou imediatamente (improvável mas possível)
      if (prediction.status === 'succeeded' && prediction.output) {
        const outputUrl = typeof prediction.output === 'string' ? prediction.output : prediction.output[0]
        console.log('✅ Upscale completado imediatamente!')

        return {
          jobId: prediction.id,
          status: 'succeeded',
          result: [outputUrl],
          requiresStorage: true
        }
      }

      return {
        jobId: prediction.id,
        status: 'processing'
      }

    } catch (error) {
      console.error('❌ Nano Banana Pro upscale error:', error)

      if (error instanceof AIError) {
        throw error
      }

      throw new AIError(
        `Falha no upscale (Nano Banana Pro): ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPSCALE_FAILED'
      )
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
      const prediction = await this.replicate.predictions.get(jobId)

      return {
        status: prediction.status,
        progress: this.calculateProgress(prediction.status),
        result: prediction.output ? [prediction.output as string] : undefined,
        error: prediction.error as string | undefined
      }
    } catch (error) {
      console.error('❌ Error checking Nano Banana upscale status:', error)
      throw new AIError('Falha ao verificar status do upscale', 'STATUS_CHECK_FAILED')
    }
  }

  /**
   * Cancela um job de upscale
   */
  async cancelUpscale(jobId: string): Promise<boolean> {
    try {
      await this.replicate.predictions.cancel(jobId)
      console.log('🛑 Upscale job cancelled:', jobId)
      return true
    } catch (error) {
      console.error('❌ Error cancelling upscale:', error)
      return false
    }
  }

  /**
   * Upscale em batch (múltiplas imagens)
   */
  async batchUpscale(
    imageUrls: string[],
    options: any = {}
  ): Promise<{ jobIds: string[]; totalJobs: number }> {
    console.log('📦 Starting batch upscale com Nano Banana Pro:', { count: imageUrls.length })

    const jobIds: string[] = []
    const errors: string[] = []

    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        console.log(`🔄 Processing image ${index + 1}/${imageUrls.length}`)

        const result = await this.upscaleImage(imageUrl, options, false) // Async para batch
        jobIds.push(result.jobId)

        // Pausa entre requests para evitar rate limiting
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
      console.warn('⚠️ Algumas imagens falharam no upscale:', errors)
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
   * Health check do serviço
   */
  async healthCheck(): Promise<boolean> {
    try {
      const models = await this.replicate.models.list()
      return Array.isArray(models.results)
    } catch (error) {
      console.error('❌ Nano Banana Pro health check failed:', error)
      return false
    }
  }
}
