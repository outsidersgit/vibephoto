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
}