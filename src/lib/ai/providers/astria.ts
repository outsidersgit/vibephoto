import {
  AIProvider,
  TrainingRequest,
  TrainingResponse,
  GenerationRequest,
  GenerationResponse,
  AIError
} from '../base'

export class AstriaProvider extends AIProvider {
  private apiKey: string
  private baseUrl: string = 'https://api.astria.ai'

  constructor() {
    super()

    this.apiKey = process.env.ASTRIA_API_KEY || ''

    if (!this.apiKey) {
      throw new AIError('Astria API key not configured', 'ASTRIA_CONFIG_ERROR')
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }

    // For FormData requests (file uploads), remove Content-Type header
    if (data instanceof FormData) {
      delete headers['Content-Type']
    }

    const options: RequestInit = {
      method,
      headers,
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
    }

    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Astria API request failed (${method} ${endpoint}):`, error)
      throw error
    }
  }

  async createTune(images: string[], options: {
    name?: string
    modelType?: 'sd15' | 'sdxl1' | 'flux-lora' | 'faceid' | 'lora'
    testMode?: boolean
    callback?: string
    triggerWord?: string
    classWord?: string
  } = {}): Promise<{ id: string; status: string }> {
    try {
      const formData = new FormData()

      // Configurações do tune - limpar nome para atender validação Astria
      const cleanName = (options.name || 'person')
        .replace(/[^a-zA-Z0-9\s]/g, ' ') // Remove caracteres especiais
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim()
        .substring(0, 30) // Limita tamanho

      if (!cleanName || cleanName.length === 0) {
        throw new AIError('Model name cannot be empty after cleaning', 'INVALID_MODEL_NAME')
      }

      formData.append('tune[name]', cleanName)
      formData.append('tune[title]', cleanName) // Adicionar title também

      const modelType = options.modelType || 'lora'
      formData.append('tune[model_type]', modelType)

      // Trigger word (token) - usar 'ohwx' como padrão
      if (modelType !== 'faceid') {
        const triggerWord = options.triggerWord || 'ohwx'
        formData.append('tune[token]', triggerWord)
      }

      // Class word - sempre incluir se fornecido
      if (options.classWord) {
        formData.append('tune[class_word]', options.classWord)
      }

      // Configurações específicas para cada tipo de modelo
      if (modelType === 'lora') {
        // Configurações para LoRA
        formData.append('tune[branch]', 'flux1')
        formData.append('tune[preset]', 'flux-lora-portrait')
        formData.append('tune[base_tune]', 'Flux.1 dev')
      } else if (modelType === 'sd15') {
        formData.append('tune[base_tune_id]', '1')
      } else if (modelType === 'sdxl1') {
        formData.append('tune[base_tune_id]', '2')
      }

      // Modo de teste (gratuito)
      if (options.testMode) {
        formData.append('tune[branch]', 'fast')
      }

      // Adicionar callback se fornecido
      if (options.callback) {
        formData.append('tune[callback]', options.callback)
      }

      // Baixar e anexar as imagens como arquivos
      if (images.length === 0) {
        throw new AIError('At least one image is required for tune creation', 'MISSING_IMAGES')
      }

      console.log(`📥 Downloading ${images.length} images for Astria tune...`)

      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i]
        try {
          console.log(`📥 Downloading image ${i + 1}/${images.length}: ${imageUrl.substring(0, 100)}...`)

          const response = await fetch(imageUrl)
          if (!response.ok) {
            throw new Error(`Failed to download image: HTTP ${response.status}`)
          }

          const buffer = await response.arrayBuffer()

          // Detectar content type da resposta
          const contentType = response.headers.get('content-type') || 'image/jpeg'

          // Extrair extensão da URL ou usar jpg como padrão
          const extension = imageUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)?.[1] || 'jpg'
          const filename = `image_${i + 1}.${extension}`

          // Criar File object com dados corretos
          const file = new File([buffer], filename, { type: contentType })
          formData.append('tune[images][]', file)
          console.log(`✅ Image ${i + 1} downloaded and added: ${filename}`)
        } catch (error) {
          console.error(`❌ Failed to download image ${i + 1}:`, error)
          throw new AIError(`Failed to download image ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'IMAGE_DOWNLOAD_ERROR')
        }
      }

      const result = await this.makeRequest('POST', '/tunes', formData)

      return {
        id: result.id,
        status: this.mapAstriaStatus(result.status)
      }
    } catch (error) {
      throw new AIError(
        `Failed to create Astria tune: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TUNE_CREATION_ERROR'
      )
    }
  }

  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    try {
      // Validar request
      if (!request.name || !request.imageUrls || request.imageUrls.length === 0) {
        throw new AIError('Invalid training request: missing name or images', 'INVALID_REQUEST')
      }

      // Criar tune na Astria com configurações LoRA
      const tuneResult = await this.createTune(request.imageUrls, {
        name: request.name,
        modelType: 'lora', // Usar LoRA conforme especificação
        testMode: process.env.ASTRIA_TEST_MODE === 'true',
        triggerWord: request.triggerWord || 'ohwx',
        classWord: request.classWord,
        callback: request.webhookUrl
      })

      console.log(`✅ Astria tune created with ID: ${tuneResult.id}`)

      return {
        id: tuneResult.id,
        status: this.mapAstriaStatus(tuneResult.status),
        createdAt: new Date().toISOString(),
        estimatedTime: this.estimateTrainingTime(request.imageUrls.length, request.params.steps),
        metadata: {
          tuneId: tuneResult.id,
          triggerWord: request.triggerWord || 'TOK',
          modelType: 'faceid'
        }
      }
    } catch (error) {
      console.error('❌ Astria training start failed:', error)

      if (error instanceof AIError) {
        throw error
      }

      throw new AIError(
        `Failed to start Astria training: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAINING_START_ERROR'
      )
    }
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    try {
      const training = await this.makeRequest('GET', `/tunes/${trainingId}`)

      return {
        id: training.id,
        status: this.mapAstriaStatus(training.status),
        model: training.status === 'trained' ? {
          url: `${training.id}`, // Para Astria, o ID do tune é usado como model URL
          name: training.name || 'Astria Model'
        } : undefined,
        logs: training.logs ? [training.logs] : undefined,
        error: training.error_message as string | undefined,
        createdAt: training.created_at,
        completedAt: training.trained_at || undefined
      }
    } catch (error) {
      throw new AIError(
        `Failed to get Astria training status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAINING_STATUS_ERROR'
      )
    }
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    try {
      await this.makeRequest('DELETE', `/tunes/${trainingId}`)
      return true
    } catch (error) {
      console.error('Failed to cancel Astria training:', error)
      return false
    }
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      // Preparar prompt para Astria
      console.log(`🔍 [ASTRIA_DEBUG] Received generation request:`, {
        modelUrl: request.modelUrl,
        triggerWord: request.triggerWord,
        classWord: request.classWord,
        originalPrompt: request.prompt,
        promptLength: request.prompt.length
      })

      // ARQUITETURA CORRETA DO ASTRIA:
      // Quando usamos o endpoint /tunes/{tuneId}/prompts, o Astria automaticamente:
      // 1. Carrega o modelo (tune)
      // 2. Aplica o LoRA internamente
      // 3. Mas PRECISAMOS incluir o token e classWord no início do prompt
      //
      // Formato correto: "token classWord, prompt"
      // Exemplo: "ohwx person, elegante executivo minimalista"

      // Construir prompt com token e classWord (com fallbacks para compatibilidade)
      const token = request.triggerWord || 'ohwx' // Default token usado no treinamento
      const classWord = request.classWord || 'person' // Fallback para modelos antigos

      // Verificar se o prompt já inclui o token (para evitar duplicação)
      const promptLower = request.prompt.toLowerCase()
      const tokenLower = token.toLowerCase()
      const hasToken = promptLower.startsWith(tokenLower) || promptLower.includes(` ${tokenLower} `)

      const finalPrompt = hasToken
        ? request.prompt // Prompt já tem token, usar como está
        : `${token} ${classWord}, ${request.prompt}` // Adicionar token e classWord

      console.log(`📝 [ASTRIA_DEBUG] Prompt construction complete:`, {
        tuneId: request.modelUrl,
        token,
        classWord,
        hadToken: hasToken,
        originalPrompt: request.prompt.substring(0, 80),
        finalPrompt: finalPrompt.substring(0, 150),
        endpoint: request.modelUrl ? `/tunes/${request.modelUrl}/prompts` : '/prompts',
        note: 'LoRA will be applied automatically by Astria API'
      })

      // Preparar FormData para Astria (não JSON)
      const formData = new FormData()
      formData.append('prompt[text]', finalPrompt)
      formData.append('prompt[num_images]', String(request.params.num_outputs || 1))

      // Dimensões
      formData.append('prompt[w]', String(request.params.width || 1024))
      formData.append('prompt[h]', String(request.params.height || 1024))

      // CORRIGIDO: Parâmetros corretos conforme documentação oficial
      formData.append('prompt[cfg_scale]', String(request.params.guidance_scale || 7.5))
      formData.append('prompt[steps]', String(request.params.steps || 50))

      // Usar scheduler padrão ou especificado
      formData.append('prompt[scheduler]', 'euler_a')

      // CORRIGIDO: Enhancements compatíveis com LoRA conforme documentação
      formData.append('prompt[super_resolution]', 'true')
      formData.append('prompt[inpaint_faces]', 'true')

      // CRÍTICO: NÃO enviar parâmetros não suportados por LoRA
      // A API Astria considera qualquer valor presente (mesmo 'false' string) como ativado
      // Solução: simplesmente não incluir esses parâmetros no FormData

      // CORRIGIDO: Qualidade de output conforme documentação
      formData.append('prompt[output_quality]', String(request.params.output_quality || 95))

      // Seed para reprodutibilidade
      if (request.params.seed) {
        formData.append('prompt[seed]', String(request.params.seed))
      }

      // CRÍTICO: Debug completo dos FormData parameters sendo enviados
      console.log(`📋 [ASTRIA_DEBUG] FormData parameters being sent:`)
      const formDataEntries: { [key: string]: string } = {}
      for (const [key, value] of formData.entries()) {
        formDataEntries[key] = value as string
        console.log(`  ${key}: ${value}`)
      }
      console.log(`📊 [ASTRIA_DEBUG] Total parameters: ${Object.keys(formDataEntries).length}`)

      // CRÍTICO: Verificar especificamente os parâmetros de enhancement
      const criticalParams = [
        'prompt[super_resolution]',
        'prompt[inpaint_faces]'
      ]
      console.log(`🔍 [ASTRIA_CRITICAL] Enhancement parameters verification:`)
      criticalParams.forEach(param => {
        console.log(`  ${param}: ${formDataEntries[param] || 'NOT SET'}`)
      })
      console.log(`  ✅ Incompatible LoRA params (face_correct, face_swap, hires_fix) are NOT sent`)

      // Configurar callback se disponível - permitir HTTP em desenvolvimento
      const hasValidWebhook = request.webhookUrl && (
        request.webhookUrl.startsWith('https://') ||
        (process.env.NODE_ENV === 'development' && request.webhookUrl.startsWith('http://'))
      )
      if (hasValidWebhook) {
        formData.append('prompt[callback]', request.webhookUrl)
        console.log('📡 Callback configured for generation:', request.webhookUrl)
      } else if (request.webhookUrl) {
        console.warn('⚠️ Invalid callback URL (must be HTTPS in production):', request.webhookUrl)
      }

      console.log('🎨 Astria generation input parameters:', {
        prompt: finalPrompt.substring(0, 100) + '...',
        dimensions: `${request.params.width || 1024}x${request.params.height || 1024}`,
        hasCustomModel: !!request.modelUrl,
        modelUrl: request.modelUrl,
        enhancementsEnabled: {
          super_resolution: true,
          inpaint_faces: true
        },
        incompatibleParamsOmitted: ['face_correct', 'face_swap', 'hires_fix']
      })

      // Fazer request para Astria usando URL e FormData corretas
      const endpoint = request.modelUrl ? `/tunes/${request.modelUrl}/prompts` : '/prompts'
      const prediction = await this.makeRequest('POST', endpoint, formData)
      // CRÍTICO: usar sempre o modelUrl como tune_id correto, pois prediction.tune_id retorna o prompt_id
      const tuneId = request.modelUrl || prediction.tune_id

      console.log('✅ Astria prediction created:', prediction.id, prediction.status)
      console.log(`📊 [ASTRIA_GENERATE] Generation created:`, {
        predictionId: prediction.id,
        tuneId,
        status: prediction.status,
        endpoint: endpoint
      })

      return {
        id: prediction.id,
        status: this.mapAstriaStatus(prediction.status),
        createdAt: prediction.created_at,
        estimatedTime: this.estimateGenerationTime(
          request.params.width || 1024,
          request.params.height || 1024,
          request.params.steps || 30
        ),
        metadata: {
          prompt: request.prompt,
          seed: request.params.seed || 0,
          params: request.params,
          tune_id: tuneId, // CRÍTICO: armazenar tune_id para polling correto
          modelUrl: request.modelUrl,
          endpoint_used: endpoint
        }
      }
    } catch (error) {
      console.error('❌ Astria generation failed:', error)

      if (error instanceof AIError) {
        throw error
      }

      // Tratar erros específicos da Astria
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        if (errorMessage.includes('422')) {
          throw new AIError('Invalid parameters. Check your settings.', 'INVALID_INPUT')
        } else if (errorMessage.includes('429')) {
          throw new AIError('Rate limit exceeded. Please wait a few seconds.', 'RATE_LIMIT_ERROR')
        } else if (errorMessage.includes('500')) {
          throw new AIError('Server error. Trying again...', 'SERVER_ERROR')
        } else if (errorMessage.includes('504')) {
          throw new AIError('Timeout. Generation may still be in progress.', 'TIMEOUT_ERROR')
        }
      }

      throw new AIError(
        `Failed to start Astria generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_START_ERROR'
      )
    }
  }

  async getGenerationStatus(generationId: string, tuneId?: string): Promise<GenerationResponse> {
    try {
      console.log(`🔍 [ASTRIA_STATUS] Checking status for prompt ${generationId} (tune: ${tuneId || 'unknown'})`)

      let response: any
      let endpoint: string

      // Usar endpoint específico baseado em tune_id se disponível
      if (tuneId) {
        endpoint = `/tunes/${tuneId}/prompts/${generationId}`
        console.log(`📍 [ASTRIA_STATUS] Using tune-specific endpoint: ${endpoint}`)
      } else {
        endpoint = `/prompts/${generationId}`
        console.log(`📍 [ASTRIA_STATUS] Using direct endpoint: ${endpoint}`)
      }

      // Fazer request com headers apropriados
      try {
        const url = `${this.baseUrl}${endpoint}`
        const headers = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }

        console.log(`🌐 [ASTRIA_STATUS] Requesting: ${url}`)
        const fetchResponse = await fetch(url, { headers })

        if (!fetchResponse.ok) {
          console.error(`❌ [ASTRIA_STATUS] HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)

          // Se falhou com tune_id, tentar endpoint direto como fallback
          if (tuneId && fetchResponse.status === 404) {
            console.log(`🔄 [ASTRIA_STATUS] Trying fallback to direct endpoint...`)
            const fallbackUrl = `${this.baseUrl}/prompts/${generationId}`
            const fallbackResponse = await fetch(fallbackUrl, { headers })

            if (fallbackResponse.ok) {
              response = await fallbackResponse.json()
              console.log(`✅ [ASTRIA_STATUS] Found via fallback endpoint`)
            } else {
              throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`)
            }
          } else {
            throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
          }
        } else {
          response = await fetchResponse.json()
          console.log(`✅ [ASTRIA_STATUS] Successfully retrieved prompt data`)
        }

      } catch (fetchError) {
        console.error(`❌ [ASTRIA_STATUS] Request failed:`, fetchError)
        throw fetchError
      }

      // DETECÇÃO CRÍTICA DE IMAGENS - seguir especificação exata do usuário
      const urls: string[] = []
      let imageCount = 0

      console.log(`🔍 [ASTRIA_STATUS] Analyzing response for images...`)
      console.log(`📊 [ASTRIA_STATUS] Response keys:`, Object.keys(response))
      console.log(`📊 [ASTRIA_STATUS] Raw status:`, response.status)

      // 🔧 CORREÇÃO CRÍTICA: Astria retorna array de strings diretas em 'images'
      if (response.images && Array.isArray(response.images)) {
        console.log(`🖼️ [ASTRIA_STATUS] Found images array with ${response.images.length} items`)

        for (let i = 0; i < response.images.length; i++) {
          const imageUrl = response.images[i]
          console.log(`🖼️ [ASTRIA_STATUS] Image ${i + 1}:`, typeof imageUrl, imageUrl?.substring(0, 100) + '...')

          // Astria retorna strings diretas, não objetos
          if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
            const imgUrl = imageUrl.trim()

            // Filtrar URLs de API JSON também no array de imagens
            if (!imgUrl.includes('.json') && !imgUrl.includes('/prompts/') && !imgUrl.includes('api.astria.ai')) {
              urls.push(imgUrl)
              imageCount++
              console.log(`✅ [ASTRIA_STATUS] Valid image URL ${i + 1}: ${imgUrl.substring(0, 100)}...`)
            } else {
              console.log(`⚠️ [ASTRIA_STATUS] Skipping JSON endpoint in images array: ${imgUrl.substring(0, 100)}...`)
            }
          }
        }
      }

      // Verificar outros possíveis campos de imagem
      if (response.output && Array.isArray(response.output)) {
        console.log(`🔍 [ASTRIA_STATUS] Found output array with ${response.output.length} items`)
        response.output.forEach((url: any, i: number) => {
          if (typeof url === 'string' && url.trim().length > 0) {
            const outputUrl = url.trim()

            // Filtrar URLs de API JSON também no array de output
            if (!outputUrl.includes('.json') && !outputUrl.includes('/prompts/') && !outputUrl.includes('api.astria.ai')) {
              urls.push(outputUrl)
              imageCount++
              console.log(`🖼️ [ASTRIA_STATUS] Output ${i + 1}: ${outputUrl.substring(0, 100)}...`)
            } else {
              console.log(`⚠️ [ASTRIA_STATUS] Skipping JSON endpoint in output array: ${outputUrl.substring(0, 100)}...`)
            }
          }
        })
      }

      // ⚠️ CRÍTICO: Não incluir response.url se for endpoint JSON da API
      if (response.url && typeof response.url === 'string') {
        const url = response.url.trim()

        // Filtrar URLs de API JSON (endpoints que terminam com .json ou contêm /prompts/)
        if (!url.includes('.json') && !url.includes('/prompts/') && !url.includes('api.astria.ai')) {
          urls.push(url)
          imageCount++
          console.log(`🖼️ [ASTRIA_STATUS] Single URL found: ${url.substring(0, 100)}...`)
        } else {
          console.log(`⚠️ [ASTRIA_STATUS] Skipping JSON endpoint URL: ${url.substring(0, 100)}...`)
        }
      }

      // 🔧 CORREÇÃO CRÍTICA: Inferir status baseado em presença de dados, não campo "status"
      const hasRealImages = imageCount > 0
      const hasError = response.user_error || response.error_message
      const isCompleted = hasRealImages && (response.updated_at || response.trained_at)

      console.log(`🎯 [ASTRIA_STATUS] Status inference:`, {
        totalUrls: urls.length,
        imageCount,
        hasRealImages,
        hasError: !!hasError,
        isCompleted,
        rawStatus: response.status,
        updatedAt: response.updated_at,
        trainedAt: response.trained_at
      })

      // Status final baseado na presença de imagens e dados
      let finalStatus: string
      if (hasError) {
        finalStatus = 'failed'
        console.log(`❌ [ASTRIA_STATUS] FAILED - Error detected:`, hasError)
      } else if (hasRealImages && isCompleted) {
        finalStatus = 'succeeded'
        console.log(`✅ [ASTRIA_STATUS] COMPLETED - Found ${imageCount} images ready for download`)
      } else {
        finalStatus = 'processing'
        console.log(`⏳ [ASTRIA_STATUS] PROCESSING - No images available yet or incomplete`)
      }

      return {
        id: response.id,
        status: finalStatus as any,
        urls: hasRealImages ? urls : undefined,
        images: hasRealImages ? urls : undefined, // 🔧 CRÍTICO: Adicionar campo 'images' para compatibilidade com polling
        error: response.error_message || response.user_error as string | undefined,
        createdAt: response.created_at,
        completedAt: hasRealImages ? (response.updated_at || new Date().toISOString()) : undefined,
        metadata: {
          prompt: response.text,
          seed: response.seed || 0,
          params: response,
          tune_id: tuneId,
          imageCount,
          detectionLog: {
            hasImagesArray: !!(response.images && Array.isArray(response.images)),
            hasOutputArray: !!(response.output && Array.isArray(response.output)),
            hasSingleUrl: !!response.url,
            totalUrls: urls.length,
            inferredFromData: true
          }
        }
      }
    } catch (error) {
      console.error(`❌ [ASTRIA_STATUS] Status check failed for ${generationId}:`, error)
      throw new AIError(
        `Failed to get Astria generation status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_STATUS_ERROR'
      )
    }
  }

  async cancelGeneration(generationId: string): Promise<boolean> {
    try {
      await this.makeRequest('DELETE', `/prompts/${generationId}`)
      return true
    } catch (error) {
      console.error('Failed to cancel Astria generation:', error)
      return false
    }
  }

  async validateModel(modelUrl: string): Promise<boolean> {
    try {
      // Para Astria, modelUrl é o tune ID
      const response = await this.makeRequest('GET', `/tunes/${modelUrl}`)
      return response.status === 'trained'
    } catch (error) {
      console.error('Astria model validation failed:', error)
      return false
    }
  }

  async getAvailableModels() {
    // Retornar modelos base disponíveis na Astria
    return [
      {
        id: 'faceid',
        name: 'FaceID',
        description: 'Rápido, alta preservação facial',
        type: 'base' as const
      },
      {
        id: 'sd15',
        name: 'Stable Diffusion 1.5',
        description: 'Modelo clássico, boa qualidade',
        type: 'base' as const
      },
      {
        id: 'sdxl1',
        name: 'SDXL',
        description: 'Alta resolução, qualidade premium',
        type: 'base' as const
      },
      {
        id: 'flux-lora',
        name: 'Flux LoRA',
        description: 'Última geração, máxima qualidade',
        type: 'base' as const
      }
    ]
  }

  private mapAstriaStatus(status: string): TrainingResponse['status'] | GenerationResponse['status'] {
    switch (status) {
      case 'queued':
      case 'training':
      case 'generating':
        return 'processing'
      case 'trained':
      case 'generated':
        return 'succeeded'
      case 'failed':
        return 'failed'
      case 'cancelled':
        return 'canceled'
      default:
        return 'processing'
    }
  }

  private estimateTrainingTime(imageCount: number, steps: number): number {
    // Estimativa de tempo de treinamento em minutos para Astria
    const baseTime = 20 // 20 minutos base
    const stepMultiplier = steps / 1000
    const imageMultiplier = Math.sqrt(imageCount) / 3

    return Math.ceil(baseTime * stepMultiplier * imageMultiplier)
  }

  private estimateGenerationTime(width: number, height: number, steps: number): number {
    // Estimativa de tempo de geração em segundos para Astria
    const megapixels = (width * height) / (1024 * 1024)
    const baseTime = 15 // 15 segundos base (Astria é um pouco mais lenta devido aos aperfeiçoamentos)
    const stepTime = steps * 0.8
    const resolutionTime = megapixels * 4

    return Math.ceil(baseTime + stepTime + resolutionTime)
  }

  // Funcionalidades especiais da Astria

  /**
   * Outpainting - Expansão de imagem existente
   */
  async expandImage(request: {
    inputImageUrl: string
    prompt: string
    expandDirection: 'center' | 'left' | 'right' | 'up' | 'down'
    outputWidth?: number
    outputHeight?: number
    denoisingStrength?: number
    modelUrl?: string
  }): Promise<GenerationResponse> {
    try {
      // Preparar prompt de outpainting
      const outpaintPrompt = `--outpaint ${request.expandDirection} --outpaint_width ${request.outputWidth || 1792} --outpaint_height ${request.outputHeight || 1024}`
      const finalPrompt = request.modelUrl
        ? `<faceid:${request.modelUrl}:1.0> ${request.prompt}`
        : request.prompt

      const input = {
        text: `${finalPrompt} ${outpaintPrompt}`,
        input_image_url: request.inputImageUrl,
        denoising_strength: request.denoisingStrength || 0, // 0 para apenas expandir

        // Qualidade máxima para outpainting
        super_resolution: true,
        inpaint_faces: true,
        face_correct: true,
        hires_fix: true,

        // Parâmetros de qualidade
        cfg_scale: 7.5,
        steps: 30,
        scheduler: 'euler_a',
        output_quality: 95
      }

      console.log('🖼️ Astria outpainting request:', {
        direction: request.expandDirection,
        inputUrl: request.inputImageUrl.substring(0, 50) + '...',
        outputSize: `${request.outputWidth || 1792}x${request.outputHeight || 1024}`
      })

      const prediction = await this.makeRequest('POST', '/prompts', input)

      return {
        id: prediction.id,
        status: this.mapAstriaStatus(prediction.status),
        createdAt: prediction.created_at,
        estimatedTime: this.estimateGenerationTime(
          request.outputWidth || 1792,
          request.outputHeight || 1024,
          30
        ),
        metadata: {
          prompt: request.prompt,
          seed: 0,
          params: {
            width: request.outputWidth || 1792,
            height: request.outputHeight || 1024,
            steps: 30,
            guidance_scale: 7.5
          }
        }
      }
    } catch (error) {
      throw new AIError(
        `Failed to start Astria outpainting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OUTPAINTING_ERROR'
      )
    }
  }

  /**
   * Geração com Pack de estilos
   */
  async generateWithStylePack(request: {
    prompt: string
    packId: number
    modelUrl?: string
    callbackUrl?: string
  }): Promise<{ packJobId: string; estimatedTime: number }> {
    try {
      // Preparar prompt para pack
      let finalPrompt = request.prompt
      if (request.modelUrl) {
        finalPrompt = `<faceid:${request.modelUrl}:1.0> ${request.prompt}`
      }

      const input = {
        text: finalPrompt,
        pack_id: request.packId,

        // Sempre ativar enhancements para packs
        super_resolution: true,
        inpaint_faces: true,
        face_correct: true,
        face_swap: !!request.modelUrl,

        // Callback para receber todos os resultados do pack
        prompts_callback: request.callbackUrl
      }

      console.log('🎨 Astria style pack generation:', {
        packId: request.packId,
        hasCustomModel: !!request.modelUrl,
        prompt: finalPrompt.substring(0, 100) + '...'
      })

      const result = await this.makeRequest('POST', '/packs', input)

      return {
        packJobId: result.id,
        estimatedTime: 180 // Packs levam mais tempo (múltiplos estilos)
      }
    } catch (error) {
      throw new AIError(
        `Failed to start Astria style pack generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STYLE_PACK_ERROR'
      )
    }
  }

  /**
   * Quick Generation - Geração rápida sem fine-tuning usando FaceID
   */
  async quickGenerate(request: {
    referenceImages: string[]
    prompt: string
    params?: {
      width?: number
      height?: number
      steps?: number
      guidance_scale?: number
      num_outputs?: number
    }
  }): Promise<GenerationResponse> {
    try {
      console.log('⚡ Astria quick generation with FaceID')

      // Primeiro criar tune FaceID rápido
      const tune = await this.createTune(request.referenceImages, {
        modelType: 'faceid',
        name: 'quick-person',
        testMode: process.env.ASTRIA_TEST_MODE === 'true'
      })

      // Aguardar o tune ficar pronto (FaceID é rápido)
      let attempts = 0
      const maxAttempts = 20 // 10 minutos max

      while (attempts < maxAttempts) {
        const tuneStatus = await this.getTrainingStatus(tune.id)

        if (tuneStatus.status === 'succeeded') {
          break
        } else if (tuneStatus.status === 'failed') {
          throw new Error('Quick tune creation failed')
        }

        await new Promise(resolve => setTimeout(resolve, 30000)) // Wait 30 seconds
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('Quick tune creation timed out')
      }

      // Gerar com sintaxe FaceID
      const enhancedPrompt = `<faceid:${tune.id}:1.0> ${request.prompt}`

      const generationRequest = {
        modelUrl: tune.id,
        prompt: enhancedPrompt,
        params: {
          width: request.params?.width || 1024,
          height: request.params?.height || 1024,
          steps: request.params?.steps || 30,
          guidance_scale: request.params?.guidance_scale || 7.5,
          num_outputs: request.params?.num_outputs || 1
        }
      }

      return await this.generateImage(generationRequest)
    } catch (error) {
      throw new AIError(
        `Failed to start Astria quick generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QUICK_GENERATION_ERROR'
      )
    }
  }

  /**
   * Batch Generation - Múltiplas gerações com diferentes parâmetros
   */
  async batchGenerate(requests: Array<{
    prompt: string
    modelUrl?: string
    params?: any
    metadata?: any
  }>): Promise<Array<{ id: string; request: any }>> {
    try {
      console.log(`🔄 Astria batch generation: ${requests.length} requests`)

      const results = []

      for (const request of requests) {
        try {
          const response = await this.generateImage({
            modelUrl: request.modelUrl,
            prompt: request.prompt,
            params: request.params || {
              width: 1024,
              height: 1024,
              steps: 30,
              guidance_scale: 7.5,
              num_outputs: 1
            }
          })

          results.push({
            id: response.id,
            request: {
              ...request,
              generationId: response.id
            }
          })

          // Pequeno delay entre requests para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error('Batch generation item failed:', error)
          results.push({
            id: 'failed',
            request: {
              ...request,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      }

      return results
    } catch (error) {
      throw new AIError(
        `Failed to start Astria batch generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_GENERATION_ERROR'
      )
    }
  }

  /**
   * Utilitário para aguardar conclusão de operações
   */
  async waitForCompletion(
    resourceType: 'tune' | 'prompt',
    resourceId: string,
    maxAttempts: number = 60,
    pollInterval: number = 5000
  ): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.makeRequest('GET', `/${resourceType}s/${resourceId}`)

      if (resourceType === 'tune' && response.status === 'trained') {
        return response
      } else if (resourceType === 'prompt' && response.status === 'generated') {
        return response
      } else if (response.status === 'failed' || response.status === 'cancelled') {
        throw new Error(`${resourceType} ${resourceId} failed: ${response.error_message || 'Unknown error'}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Timeout waiting for ${resourceType} ${resourceId} to complete`)
  }
}