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
        let errorData: any = {}
        let errorText = ''
        try {
          errorText = await response.text()
          errorData = errorText ? JSON.parse(errorText) : {}
          console.error(`❌ [ASTRIA_API_ERROR] Error Response:`, {
            endpoint: `${this.baseUrl}${endpoint}`,
            method,
            status: response.status,
            statusText: response.statusText,
            errorData,
            errorText,
            rawError: errorText
          })
        } catch (parseError) {
          console.error(`❌ [ASTRIA_API_ERROR] Failed to parse error response:`, {
            parseError,
            rawText: errorText,
            status: response.status,
            statusText: response.statusText
          })
        }
        
        // Construir mensagem de erro mais informativa
        const errorMessage = errorData.detail || errorData.message || errorData.error || response.statusText
        const fullErrorMessage = errorText ? `HTTP ${response.status}: ${errorMessage}. Raw response: ${errorText}` : `HTTP ${response.status}: ${errorMessage}`
        
        throw new Error(fullErrorMessage)
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
    title?: string // Idempotent title (idealmente modelId)
  } = {}): Promise<{ id: string; status: string }> {
    try {
      // Conforme documentação Astria, podemos enviar JSON com image_urls
      // https://docs.astria.ai/docs/api/tune/create/
      const tuneName = (options.classWord || options.name || 'person')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 30)

      if (!tuneName) {
        throw new AIError('Astria tune name is required', 'INVALID_MODEL_NAME')
      }

      if (images.length === 0) {
        throw new AIError('At least one image is required for tune creation', 'MISSING_IMAGES')
      }

      const modelType = options.modelType || 'lora'
      const token = modelType !== 'faceid' ? (options.triggerWord || 'ohwx') : undefined

      const payload: any = {
        tune: {
          // Idempotent title: se fornecido (modelId), Astria retornará tune existente em caso de retry
          // Conforme: https://docs.astria.ai/docs/api/overview/#idempotency
          title: options.title || options.name || tuneName,
          name: tuneName,
          model_type: modelType,
          image_urls: images,
          // Conforme documentação, permitir definir um base_tune específico
          // Valor fixo solicitado: 1504944 (Flux1.dev na doc)
          base_tune_id: 1504944,
          // Preset recomendado para LoRA (doc Astria)
          preset: 'flux-lora-portrait'
        }
      }

      if (token) payload.tune.token = token
      if (options.callback) payload.tune.callback = options.callback
      if (options.testMode) payload.tune.branch = 'fast'

      // Retry resiliente para 429/5xx (ex.: 503 Service Unavailable)
      const maxAttempts = 5
      let lastError: any = null
      let result: any

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          result = await this.makeRequest('POST', '/tunes', payload)
          break
        } catch (error) {
          lastError = error
          const message = error instanceof Error ? error.message : String(error)
          const shouldRetry = /HTTP\s(429|5\d\d)/.test(message)

          if (!shouldRetry || attempt === maxAttempts) {
            throw new AIError(
              `Failed to create Astria tune: ${message}`,
              'TUNE_CREATION_ERROR'
            )
          }

          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000)
          const jitter = Math.floor(Math.random() * 400)
          const delayMs = backoff + jitter
          console.warn(`⚠️ Astria /tunes attempt ${attempt} failed (${message}). Retrying in ${delayMs}ms...`)
          await new Promise(res => setTimeout(res, delayMs))
        }
      }

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
      // title = modelId para idempotência (Astria retornará tune existente se já criado)
      const tuneResult = await this.createTune(request.imageUrls, {
        name: request.name,
        modelType: 'lora', // Usar LoRA conforme especificação
        testMode: process.env.ASTRIA_TEST_MODE === 'true',
        triggerWord: request.triggerWord || 'ohwx',
        classWord: request.classWord, // Será usado como tune[name] conforme docs
        callback: request.webhookUrl,
        title: request.modelId // Idempotent title conforme doc Astria
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

  /**
   * Find tune by title (for idempotency recovery)
   * Lista tunes recentes e busca pelo título exato
   */
  async findTuneByTitle(title: string): Promise<{ id: string; status: string } | null> {
    try {
      console.log(`🔍 Searching for Astria tune with title: ${title}`)
      
      // List recent tunes (paginação - buscar primeiras páginas)
      // Astria não oferece filtro por título, então listamos e filtramos client-side
      const maxPages = 3
      const perPage = 50
      
      for (let page = 1; page <= maxPages; page++) {
        try {
          // GET /tunes (lista todos)
          const tunes = await this.makeRequest('GET', `/tunes?page=${page}&per_page=${perPage}`)
          
          // Se for array, buscar diretamente
          const tunesList = Array.isArray(tunes) ? tunes : (tunes.tunes || [])
          
          const found = tunesList.find((tune: any) => tune.title === title)
          
          if (found) {
            console.log(`✅ Found Astria tune by title "${title}": ID ${found.id}, status: ${found.status}`)
            return {
              id: String(found.id),
              status: found.status || 'unknown'
            }
          }
          
          // Se última página ou lista vazia, parar
          if (tunesList.length < perPage) {
            break
          }
        } catch (pageError) {
          console.warn(`⚠️ Failed to fetch page ${page} of tunes:`, pageError)
          if (page === 1) {
            // Se primeira página falhar, não continuar
            break
          }
        }
      }
      
      console.log(`⚠️ Astria tune with title "${title}" not found in recent tunes`)
      return null
    } catch (error) {
      console.error(`❌ Error searching for tune by title "${title}":`, error)
      return null
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

      // Preparar FormData para Astria conforme documentação:
      // https://docs.astria.ai/docs/api/prompt/create/
      const formData = new FormData()
      
      // text (required) - Descrição da imagem
      formData.append('prompt[text]', finalPrompt)
      
      // negative_prompt (optional)
      if (request.negativePrompt) {
        formData.append('prompt[negative_prompt]', request.negativePrompt)
      }
      
      // num_images (optional) - Range: 1-8
      const numImages = Math.min(Math.max(1, request.params.num_outputs || 1), 8)
      formData.append('prompt[num_images]', String(numImages))

      // Dimensões: usar aspect_ratio OU w/h (não ambos)
      // Se aspectRatio fornecido, usar aspect_ratio; senão usar w/h
      if (request.params.aspectRatio) {
        // aspect_ratio enum: 1:1, 16:9, 9:16, etc
        formData.append('prompt[aspect_ratio]', request.params.aspectRatio)
      } else {
        // w e h em múltiplos de 8
        const width = Math.floor((request.params.width || 1024) / 8) * 8
        const height = Math.floor((request.params.height || 1024) / 8) * 8
        formData.append('prompt[w]', String(width))
        formData.append('prompt[h]', String(height))
      }

      // cfg_scale (fixo em 3 conforme solicitado)
      formData.append('prompt[cfg_scale]', '3')

      // steps (optional) - Integer 0-50
      if (request.params.steps) {
        formData.append('prompt[steps]', String(Math.min(50, Math.max(0, request.params.steps))))
      }

      // scheduler (optional) - enum
      if (request.params.scheduler) {
        formData.append('prompt[scheduler]', request.params.scheduler)
      } else {
        formData.append('prompt[scheduler]', 'euler_a')
      }

      // Seed (optional) - Range: 0 to 2^32
      if (request.params.seed !== undefined && request.params.seed !== null) {
        formData.append('prompt[seed]', String(request.params.seed))
      }

      // Enhancements fixos conforme solicitado
      // super_resolution sempre true
      // NOTA: Astria pode esperar boolean true/false ou string "true"/"false"
      // Testando com string primeiro (conforme documentação de exemplos)
      formData.append('prompt[super_resolution]', 'true')

      // inpaint_faces sempre true
      // NOTA: Pode não ser compatível com todos os tipos de modelo LoRA
      // Se der erro 422, tentar removendo este parâmetro
      formData.append('prompt[inpaint_faces]', 'true')

      // NOTA: style não é enviado (conforme solicitado)
      // NOTA: color_grading não é enviado (conforme solicitado)
      // NOTA: film_grain sempre false, então não enviamos (conforme solicitado)
      // NOTA: use_lpw sempre false, então não enviamos (conforme solicitado)

      // CRÍTICO: NÃO enviar face_correct, face_swap, hires_fix para LoRA
      // Conforme documentação e comentários anteriores no código

      // Debug completo dos FormData parameters sendo enviados
      console.log(`📋 [ASTRIA_DEBUG] FormData parameters being sent to Astria API:`)
      const formDataEntries: { [key: string]: string } = {}
      for (const [key, value] of formData.entries()) {
        formDataEntries[key] = value as string
        console.log(`  ${key}: ${value}`)
      }
      console.log(`📊 [ASTRIA_DEBUG] Total parameters: ${Object.keys(formDataEntries).length}`)

      // Verificar especificamente os parâmetros de enhancement
      const criticalParams = [
        'prompt[super_resolution]',
        'prompt[inpaint_faces]',
        'prompt[cfg_scale]'
      ]
      console.log(`🔍 [ASTRIA_CRITICAL] Fixed parameters verification:`)
      criticalParams.forEach(param => {
        console.log(`  ${param}: ${formDataEntries[param] || 'NOT SET'}`)
      })
      console.log(`  ✅ Fixed values: super_resolution=true, inpaint_faces=true, cfg_scale=3`)
      console.log(`  ✅ Omitted params: style, color_grading, film_grain (false), use_lpw (false)`)
      console.log(`  ✅ Incompatible LoRA params (face_correct, face_swap, hires_fix) are NOT sent`)

      // Configurar callback se disponível - permitir HTTP em desenvolvimento
      const hasValidWebhook = request.webhookUrl && (
        request.webhookUrl.startsWith('https://') ||
        (process.env.NODE_ENV === 'development' && request.webhookUrl.startsWith('http://'))
      )
      if (hasValidWebhook && request.webhookUrl) {
        formData.append('prompt[callback]', request.webhookUrl)
        console.log('📡 Callback configured for generation:', request.webhookUrl)
      } else if (request.webhookUrl) {
        console.warn('⚠️ Invalid callback URL (must be HTTPS in production):', request.webhookUrl)
      }

      console.log('🎨 Astria generation input parameters:', {
        prompt: finalPrompt.substring(0, 100) + '...',
        dimensions: request.params.aspectRatio 
          ? `aspect_ratio: ${request.params.aspectRatio}`
          : `${request.params.width || 1024}x${request.params.height || 1024}`,
        num_images: numImages,
        hasCustomModel: !!request.modelUrl,
        modelUrl: request.modelUrl,
        fixedParameters: {
          cfg_scale: '3',
          super_resolution: 'true',
          inpaint_faces: 'true',
          film_grain: 'false (not sent)',
          use_lpw: 'false (not sent)'
        },
        omittedParams: ['style', 'color_grading'],
        incompatibleParamsOmitted: ['face_correct', 'face_swap', 'hires_fix', 'output_quality']
      })

      // Validar se temos tune ID para modelos customizados
      if (!request.modelUrl) {
        throw new AIError('Model URL (tune ID) is required for generation', 'MISSING_TUNE_ID')
      }

      // Fazer request para Astria usando URL e FormData corretas
      const endpoint = `/tunes/${request.modelUrl}/prompts`
      
      console.log(`🚀 [ASTRIA_POST] Sending POST to: ${this.baseUrl}${endpoint}`)
      console.log(`📦 [ASTRIA_POST] FormData entries count: ${Array.from(formData.entries()).length}`)
      
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
        const fullMessage = error.message

        // Log detalhado do erro para debugging
        console.error(`❌ [ASTRIA_GENERATION_ERROR] Full error message:`, {
          message: error.message,
          stack: error.stack,
          modelUrl: request.modelUrl,
          endpoint: request.modelUrl ? `/tunes/${request.modelUrl}/prompts` : '/prompts',
          prompt: request.prompt.substring(0, 100)
        })

        if (errorMessage.includes('422')) {
          // Incluir mensagem original do erro para ajudar no debugging
          // Se o erro mencionar inpaint_faces, pode ser incompatibilidade com o modelo
          console.error(`⚠️ [ASTRIA_422] Possible causes:`, {
            message: fullMessage,
            possibleIssues: [
              'inpaint_faces may not be compatible with this model type',
              'aspect_ratio format may be incorrect',
              'model (tune) may not accept certain parameters',
              'parameter combination may be invalid'
            ],
            suggestion: 'Try removing inpaint_faces if error persists'
          })
          
          throw new AIError(
            `Invalid parameters (422). Astria API error: ${fullMessage}. Check your settings and ensure all parameters are valid. If the error persists, the model may not support inpaint_faces.`,
            'INVALID_INPUT'
          )
        } else if (errorMessage.includes('429')) {
          throw new AIError('Rate limit exceeded. Please wait a few seconds.', 'RATE_LIMIT_ERROR')
        } else if (errorMessage.includes('500')) {
          throw new AIError('Server error. Trying again...', 'SERVER_ERROR')
        } else if (errorMessage.includes('504')) {
          throw new AIError('Timeout. Generation may still be in progress.', 'TIMEOUT_ERROR')
        } else if (errorMessage.includes('404')) {
          throw new AIError(`Model (tune) not found. Tune ID: ${request.modelUrl}. The model may not exist or may have been deleted.`, 'MODEL_NOT_FOUND')
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