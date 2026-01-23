import { GoogleGenerativeAI } from '@google/generative-ai'
import { 
  AIProvider, 
  TrainingRequest, 
  TrainingResponse, 
  GenerationRequest, 
  GenerationResponse,
  AIError 
} from '../base'
import { AI_CONFIG } from '../config'

export interface ImageEditRequest {
  imageData: string // Base64 image data
  prompt: string
  operation: 'edit' | 'add' | 'remove' | 'style' | 'combine'
  mimeType?: string
}

export interface ImageEditResponse {
  id: string
  status: 'processing' | 'succeeded' | 'failed'
  resultImage?: string // Base64 image data
  error?: string
  metadata?: {
    operation: string
    prompt: string
    processedAt: string
  }
}

export class GeminiProvider extends AIProvider {
  private client: GoogleGenerativeAI
  private model: any

  constructor() {
    super()
    
    if (!AI_CONFIG.gemini.apiKey) {
      console.warn('⚠️ Gemini API key not configured. Image editing will not work.')
      throw new AIError(
        'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables to use Nano Banana image editing.',
        'GEMINI_CONFIG_ERROR'
      )
    }

    try {
      this.client = new GoogleGenerativeAI(AI_CONFIG.gemini.apiKey)
      // Use Nano Banana model for image editing
      this.model = this.client.getGenerativeModel({ 
        model: AI_CONFIG.gemini.imageModel,
        generationConfig: {
          temperature: AI_CONFIG.gemini.temperature,
          topP: AI_CONFIG.gemini.topP,
          topK: AI_CONFIG.gemini.topK,
          maxOutputTokens: AI_CONFIG.gemini.maxTokens,
        }
      })
      console.log('🍌 Nano Banana (Gemini 2.5 Flash Image) initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Gemini client:', error)
      throw new AIError(
        'Failed to initialize Gemini client. Please check your API key.',
        'GEMINI_INIT_ERROR'
      )
    }
  }

  // Image editing specific methods using Nano Banana capabilities
  async editImageWithPrompt(imageData: string, prompt: string, mimeType: string = 'image/png'): Promise<ImageEditResponse> {
    try {
      const requestId = `nanoBanana_edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.log(`🍌 Starting Nano Banana image editing: ${requestId}`)
      
      // Enhanced prompt for Nano Banana's advanced capabilities
      const nanoBananaPrompt = `Using advanced AI image editing capabilities, modify this image according to the following instruction: "${prompt}". 
      
      Apply the changes with:
      - High precision and attention to detail
      - Maintain character consistency and natural lighting
      - Preserve image quality and resolution
      - Blend changes seamlessly with existing elements
      
      Return only the edited image as output.`
      
      const result = await this.model.generateContent([
        { text: nanoBananaPrompt },
        { 
          inlineData: { 
            mimeType: mimeType,
            data: imageData 
          }
        }
      ])

      const response = await result.response
      
      // Check for API errors in response
      if (!response || !response.candidates) {
        console.error('❌ Invalid response from Gemini:', response)
        throw new AIError('Invalid response from Nano Banana API', 'NANO_BANANA_INVALID_RESPONSE')
      }

      const content = response.candidates?.[0]?.content?.parts

      if (!content || content.length === 0) {
        throw new AIError('No content returned from Nano Banana', 'NANO_BANANA_NO_CONTENT')
      }

      // Extract image data from response
      let resultImageData: string | undefined

      for (const part of content) {
        if (part.inlineData && part.inlineData.data) {
          resultImageData = part.inlineData.data
          break
        }
      }

      if (!resultImageData) {
        throw new AIError('No image data returned from Nano Banana', 'NANO_BANANA_NO_IMAGE_DATA')
      }

      return {
        id: requestId,
        status: 'succeeded',
        resultImage: resultImageData,
        metadata: {
          operation: 'edit',
          prompt,
          processedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Nano Banana image editing failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      throw new AIError(
        `Nano Banana editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NANO_BANANA_EDIT_ERROR'
      )
    }
  }

  async addElementToImage(imageData: string, prompt: string, mimeType: string = 'image/png'): Promise<ImageEditResponse> {
    const nanoBananaAddPrompt = `Using Nano Banana's precision, add the following element to this image: "${prompt}". 
    
    Requirements:
    - Seamlessly integrate the new element with existing composition
    - Match lighting, shadows, and perspective accurately
    - Maintain consistent style and color palette
    - Ensure realistic proportions and placement
    
    Return only the enhanced image.`
    
    return this.editImageWithPrompt(imageData, nanoBananaAddPrompt, mimeType)
  }

  async removeElementFromImage(imageData: string, prompt: string, mimeType: string = 'image/png'): Promise<ImageEditResponse> {
    const nanoBananaRemovePrompt = `Using advanced content-aware removal, eliminate the following from this image: "${prompt}". 
    
    Requirements:
    - Remove the specified element completely
    - Fill background naturally using surrounding context
    - Preserve image quality and resolution
    - Maintain natural lighting and shadows
    - Ensure seamless blending with no artifacts
    
    Return only the cleaned image.`
    
    return this.editImageWithPrompt(imageData, nanoBananaRemovePrompt, mimeType)
  }

  async transferImageStyle(imageData: string, stylePrompt: string, mimeType: string = 'image/png'): Promise<ImageEditResponse> {
    const nanoBananaStylePrompt = `Apply sophisticated style transfer to transform this image with the following style: "${stylePrompt}". 
    
    Requirements:
    - Preserve subject identity and facial features
    - Maintain composition and proportions
    - Apply style consistently across all elements
    - Ensure high artistic quality
    - Blend style naturally without over-processing
    
    Return only the stylized image.`
    
    return this.editImageWithPrompt(imageData, nanoBananaStylePrompt, mimeType)
  }

  // New method for Nano Banana's advanced blending capabilities
  async blendImages(images: Array<{data: string, mimeType?: string}>, prompt: string): Promise<ImageEditResponse> {
    try {
      if (images.length > AI_CONFIG.gemini.nanoBanana.maxImagesPerRequest) {
        throw new AIError(`Maximum ${AI_CONFIG.gemini.nanoBanana.maxImagesPerRequest} images can be blended`, 'TOO_MANY_IMAGES')
      }

      const requestId = `nanoBanana_blend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.log(`🍌 Starting Nano Banana image blending: ${requestId}`)
      
      const nanoBananaBlendPrompt = `Using Nano Banana's advanced multi-image blending capabilities, combine these ${images.length} images according to: "${prompt}". 
      
      Advanced blending requirements:
      - Seamlessly merge objects, colors, and textures from all images
      - Create natural transitions between different elements
      - Maintain consistent lighting and perspective
      - Preserve high image quality and detail
      - Apply sophisticated composition techniques
      - Ensure the result looks naturally cohesive
      
      Return only the perfectly blended final image.`
      
      const contentParts: any[] = [{ text: nanoBananaBlendPrompt }]
      
      // Add all images to the content
      for (const image of images) {
        contentParts.push({
          inlineData: {
            mimeType: image.mimeType || 'image/png',
            data: image.data
          }
        })
      }

      const result = await this.model.generateContent(contentParts)
      const response = await result.response
      const content = response.candidates?.[0]?.content?.parts

      if (!content || content.length === 0) {
        throw new AIError('No content returned from Nano Banana', 'NANO_BANANA_NO_CONTENT')
      }

      // Extract image data from response
      let resultImageData: string | undefined

      for (const part of content) {
        if (part.inlineData && part.inlineData.data) {
          resultImageData = part.inlineData.data
          break
        }
      }

      if (!resultImageData) {
        throw new AIError('No image data returned from Nano Banana', 'NANO_BANANA_NO_IMAGE_DATA')
      }

      return {
        id: requestId,
        status: 'succeeded',
        resultImage: resultImageData,
        metadata: {
          operation: 'blend',
          prompt,
          processedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Nano Banana image blending failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      throw new AIError(
        `Nano Banana blending failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NANO_BANANA_BLEND_ERROR'
      )
    }
  }

  async combineImages(images: Array<{data: string, mimeType?: string}>, prompt: string): Promise<ImageEditResponse> {
    try {
      const requestId = `combine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.log(`🎨 Starting image combination with Gemini: ${requestId}`)
      
      const combinePrompt = `Combine these images according to the following instruction: ${prompt}. Create a cohesive composition that integrates all elements naturally. Return only the combined image.`
      
      const contentParts: any[] = [{ text: combinePrompt }]
      
      // Add all images to the content
      for (const image of images) {
        contentParts.push({
          inlineData: {
            mimeType: image.mimeType || 'image/png',
            data: image.data
          }
        })
      }

      const result = await this.model.generateContent(contentParts)
      const response = await result.response
      const content = response.candidates?.[0]?.content?.parts

      if (!content || content.length === 0) {
        throw new AIError('No content returned from Gemini', 'GEMINI_NO_CONTENT')
      }

      // Extract image data from response
      let resultImageData: string | undefined

      for (const part of content) {
        if (part.inlineData && part.inlineData.data) {
          resultImageData = part.inlineData.data
          break
        }
      }

      if (!resultImageData) {
        throw new AIError('No image data returned from Gemini', 'GEMINI_NO_IMAGE_DATA')
      }

      return {
        id: requestId,
        status: 'succeeded',
        resultImage: resultImageData,
        metadata: {
          operation: 'combine',
          prompt,
          processedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Gemini image combination failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      throw new AIError(
        `Image combination failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GEMINI_COMBINE_ERROR'
      )
    }
  }

  // Required AIProvider methods (not implemented for image editing focus)
  async startTraining(request: TrainingRequest): Promise<TrainingResponse> {
    throw new AIError('Training not supported by Gemini provider', 'GEMINI_TRAINING_NOT_SUPPORTED')
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResponse> {
    throw new AIError('Training not supported by Gemini provider', 'GEMINI_TRAINING_NOT_SUPPORTED')
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    throw new AIError('Training not supported by Gemini provider', 'GEMINI_TRAINING_NOT_SUPPORTED')
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const requestId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.log(`🎨 Starting image generation with Gemini: ${requestId}`)
      
      const result = await this.model.generateContent([
        { text: `Generate an image based on this description: ${request.prompt}. Create a high-quality, detailed image.` }
      ])

      const response = await result.response
      const content = response.candidates?.[0]?.content?.parts

      if (!content || content.length === 0) {
        throw new AIError('No content returned from Gemini', 'GEMINI_NO_CONTENT')
      }

      // Extract image data from response
      let imageData: string | undefined

      for (const part of content) {
        if (part.inlineData && part.inlineData.data) {
          imageData = part.inlineData.data
          break
        }
      }

      if (!imageData) {
        throw new AIError('No image data returned from Gemini', 'GEMINI_NO_IMAGE_DATA')
      }

      // Convert base64 to URL (you might want to save this to storage)
      const imageUrl = `data:image/png;base64,${imageData}`

      return {
        id: requestId,
        status: 'succeeded',
        urls: [imageUrl],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: {
          prompt: request.prompt,
          seed: 0,
          params: request.params
        }
      }

    } catch (error) {
      console.error('❌ Gemini image generation failed:', error)
      
      if (error instanceof AIError) {
        throw error
      }
      
      throw new AIError(
        `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GEMINI_GENERATION_ERROR'
      )
    }
  }

  async getGenerationStatus(generationId: string): Promise<GenerationResponse> {
    // Gemini operations are synchronous, so we don't track status
    throw new AIError('Status tracking not needed for Gemini provider', 'GEMINI_STATUS_NOT_SUPPORTED')
  }

  async cancelGeneration(generationId: string): Promise<boolean> {
    // Gemini operations are synchronous, so cancellation is not applicable
    return false
  }

  async validateModel(modelUrl: string): Promise<boolean> {
    // For Gemini, we always use the configured model
    return true
  }

  // Utility method to convert file to base64
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Utility method to convert base64 to blob
  static base64ToBlob(base64Data: string, mimeType: string = 'image/png'): Blob {
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  // Utility method to create download URL from base64
  static createDownloadUrl(base64Data: string, mimeType: string = 'image/png'): string {
    const blob = this.base64ToBlob(base64Data, mimeType)
    return URL.createObjectURL(blob)
  }

  /**
   * Optimize a user prompt for better generation results
   * Uses Gemini 2.5 Flash Lite - fastest and most cost-effective model
   * @param userPrompt The original user prompt to optimize
   * @param type Whether optimizing for 'image' or 'video' generation
   * @returns The optimized prompt
   */
  async optimizePrompt(userPrompt: string, type: 'image' | 'video' = 'image'): Promise<string> {
    try {
      // Use Gemini 2.5 Flash Lite for fast, efficient prompt optimization
      const optimizerModel = this.client.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })

      const systemPrompt = type === 'image'
        ? `Você é um especialista técnico em engenharia de prompts para modelos de geração de imagens como FLUX, Stable Diffusion e Midjourney.

Tarefa: Otimize o prompt do usuário adicionando APENAS detalhes técnicos e de qualidade, mantendo 100% o conceito original.

Diretrizes CRÍTICAS:
- NÃO invente elementos novos (objetos, pessoas, locais, cores específicas não mencionadas)
- NÃO mude a ideia central do usuário
- MANTENHA exatamente o que foi pedido
- ADICIONE apenas: qualidade técnica (8k, ultra detalhado, fotorrealista), iluminação profissional, composição, textura, profundidade de campo
- FOQUE em aspectos técnicos: tipo de lente, abertura, ISO, balanço de brancos, pós-processamento
- Especifique renderização realista e física precisa
- Seja técnico, não criativo
- Máximo 200 palavras
- Use o mesmo idioma da entrada (português ou inglês)
- Retorne APENAS o prompt otimizado, sem explicações

Exemplo CORRETO:
Entrada: "cachorro correndo"
Saída: "cachorro correndo com movimento dinâmico e fluido, anatomia canina precisa, física de movimento realista, pelagem com textura detalhada, captura de alta velocidade, iluminação natural balanceada, profundidade de campo cinematográfica, resolução 8k, fotografia profissional de ação, motion blur sutil, músculos definidos, expressão natural, fotorrealismo extremo"

Exemplo ERRADO (não faça assim):
Entrada: "cachorro correndo"
Saída: "golden retriever correndo alegremente em uma praia tropical ao pôr do sol com céu rosa e laranja" ❌

Agora otimize este prompt:`
        : `Você é um especialista técnico em engenharia de prompts para modelos de geração de vídeo.

Tarefa: Otimize o prompt do usuário adicionando APENAS detalhes técnicos cinematográficos, mantendo 100% o conceito original.

Diretrizes CRÍTICAS:
- NÃO invente cenários, locais ou elementos novos não mencionados pelo usuário
- NÃO mude a ação ou cena descrita
- MANTENHA exatamente o que foi pedido
- ADICIONE apenas: movimento de câmera (pan, tilt, dolly, steadicam), ângulos (wide shot, close-up, over-shoulder), iluminação cinematográfica, frame rate, qualidade técnica
- FOQUE em aspectos técnicos: transições suaves, motion blur, estabilização, gradação de cor profissional, resolução 4k
- Especifique física de movimento realista e timing preciso
- Seja técnico, não criativo
- Máximo 150 palavras
- Use o mesmo idioma da entrada (português ou inglês)
- Retorne APENAS o prompt otimizado, sem explicações

Exemplo CORRETO:
Entrada: "pessoa caminhando"
Saída: "pessoa caminhando com movimento natural e fluido, câmera em steadicam acompanhando lateralmente, plano médio, transição suave, física de movimento realista, iluminação balanceada, profundidade de campo cinematográfica, motion blur natural, 24fps, resolução 4k, gradação de cor profissional, estabilização avançada"

Exemplo ERRADO (não faça assim):
Entrada: "pessoa caminhando"
Saída: "mulher de vestido vermelho caminhando em um campo de girassóis ao entardecer" ❌

Agora otimize este prompt de vídeo:`

      const result = await optimizerModel.generateContent(`${systemPrompt}\n\nPrompt do usuário: "${userPrompt}"`)
      const response = await result.response
      const optimizedPrompt = response.text().trim()

      // Remove any markdown formatting or quotes
      const cleanedPrompt = optimizedPrompt
        .replace(/^["']|["']$/g, '')
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/^`|`$/g, '')
        .trim()

      console.log('✨ Prompt otimizado:', {
        original: userPrompt.substring(0, 50) + '...',
        optimized: cleanedPrompt.substring(0, 50) + '...',
        type
      })

      return cleanedPrompt
    } catch (error) {
      console.error('❌ Falha ao otimizar prompt:', error)
      throw new AIError(
        `Falha ao otimizar prompt: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        'PROMPT_OPTIMIZATION_ERROR'
      )
    }
  }
}