import { NanoBananaProvider, NanoBananaEditResponse } from './providers/nano-banana'
import { AI_CONFIG } from './config'
import { AIError } from './base'

// Re-export types for backward compatibility
export type ImageEditResponse = NanoBananaEditResponse

export class ImageEditor {
  private provider: NanoBananaProvider | null = null
  private isConfigured: boolean = false

  constructor() {
    try {
      this.provider = new NanoBananaProvider()
      this.isConfigured = true
    } catch (error) {
      console.warn('🍌 Nano Banana via Replicate not configured:', error)
      this.provider = null
      this.isConfigured = false
    }
  }

  private checkConfiguration() {
    if (!this.isConfigured || !this.provider) {
      throw new AIError(
        'Nano Banana via Replicate not configured. Please check your REPLICATE_API_TOKEN.',
        'NANO_BANANA_NOT_CONFIGURED'
      )
    }
  }

  /**
   * Check if the image editor is properly configured
   * @returns boolean - true if configured, false otherwise
   */
  isNanoBananaConfigured(): boolean {
    return this.isConfigured && this.provider !== null
  }

  /**
   * Edit an image with a text prompt
   * @param imageFile - The image file to edit
   * @param promptText - Text description of the desired edit
   * @returns Promise<ImageEditResponse>
   */
  async editImageWithPrompt(imageFile: File, promptText: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🍌 Starting Nano Banana image edit via Replicate:', { fileName: imageFile.name, prompt: promptText })
      
      // Validate input
      if (!imageFile) {
        throw new AIError('Image file is required', 'INVALID_INPUT')
      }
      
      if (!promptText || promptText.trim().length === 0) {
        throw new AIError('Prompt text is required', 'INVALID_INPUT')
      }

      // Validate file type
      if (!imageFile.type.startsWith('image/')) {
        throw new AIError('File must be an image', 'INVALID_FILE_TYPE')
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (imageFile.size > maxSize) {
        throw new AIError('Image file too large (max 10MB)', 'FILE_TOO_LARGE')
      }

      // Convert file to data URL for Replicate
      const imageUrl = await NanoBananaProvider.fileToUrl(imageFile)
      
      // Call Nano Banana provider via Replicate
      const result = await this.provider!.editWithPrompt(imageUrl, promptText, 'png')

      console.log('✅ Nano Banana edit completed:', result.id)
      return result

    } catch (error) {
      console.error('❌ Nano Banana edit failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Nano Banana editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NANO_BANANA_EDIT_ERROR'
      )
    }
  }

  /**
   * Add an element to an image
   * @param imageFile - The base image file
   * @param prompt - Description of what to add
   * @returns Promise<ImageEditResponse>
   */
  async addElementToImage(imageFile: File, prompt: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🎨 Adding element to image:', { fileName: imageFile.name, element: prompt })
      
      if (!imageFile || !prompt?.trim()) {
        throw new AIError('Image file and prompt are required', 'INVALID_INPUT')
      }

      if (!imageFile.type.startsWith('image/')) {
        throw new AIError('File must be an image', 'INVALID_FILE_TYPE')
      }

      const imageUrl = await NanoBananaProvider.fileToUrl(imageFile)
      const result = await this.provider!.addElementToImage(imageUrl, prompt, 'png')

      console.log('✅ Element added successfully:', result.id)
      return result

    } catch (error) {
      console.error('❌ Add element failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Adding element failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ADD_ELEMENT_ERROR'
      )
    }
  }

  /**
   * Remove an element from an image
   * @param imageFile - The base image file
   * @param prompt - Description of what to remove
   * @returns Promise<ImageEditResponse>
   */
  async removeElementFromImage(imageFile: File, prompt: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🎨 Removing element from image:', { fileName: imageFile.name, element: prompt })
      
      if (!imageFile || !prompt?.trim()) {
        throw new AIError('Image file and prompt are required', 'INVALID_INPUT')
      }

      if (!imageFile.type.startsWith('image/')) {
        throw new AIError('File must be an image', 'INVALID_FILE_TYPE')
      }

      const imageUrl = await NanoBananaProvider.fileToUrl(imageFile)
      const result = await this.provider!.removeElementFromImage(imageUrl, prompt, 'png')

      console.log('✅ Element removed successfully:', result.id)
      return result

    } catch (error) {
      console.error('❌ Remove element failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Removing element failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REMOVE_ELEMENT_ERROR'
      )
    }
  }

  /**
   * Apply style transfer to an image
   * @param imageFile - The base image file
   * @param stylePrompt - Description of the desired style
   * @returns Promise<ImageEditResponse>
   */
  async transferImageStyle(imageFile: File, stylePrompt: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🎨 Applying style transfer:', { fileName: imageFile.name, style: stylePrompt })
      
      if (!imageFile || !stylePrompt?.trim()) {
        throw new AIError('Image file and style prompt are required', 'INVALID_INPUT')
      }

      if (!imageFile.type.startsWith('image/')) {
        throw new AIError('File must be an image', 'INVALID_FILE_TYPE')
      }

      const imageUrl = await NanoBananaProvider.fileToUrl(imageFile)
      const result = await this.provider!.transferStyle(imageUrl, stylePrompt, 'png')

      console.log('✅ Style transfer completed:', result.id)
      return result

    } catch (error) {
      console.error('❌ Style transfer failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Style transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STYLE_TRANSFER_ERROR'
      )
    }
  }

  /**
   * Blend multiple images using Nano Banana's advanced capabilities (recommended)
   * @param imageFiles - Array of image files to blend (max 3)
   * @param prompt - Description of how to blend them
   * @returns Promise<ImageEditResponse>
   */
  async blendImages(imageFiles: File[], prompt: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🍌 Blending images with Nano Banana:', { 
        fileCount: imageFiles.length, 
        files: imageFiles.map(f => f.name),
        prompt 
      })
      
      if (!imageFiles || imageFiles.length === 0) {
        throw new AIError('At least one image file is required', 'INVALID_INPUT')
      }

      if (imageFiles.length > 3) {
        throw new AIError('Maximum 3 images can be blended at once', 'TOO_MANY_IMAGES')
      }

      if (!prompt?.trim()) {
        throw new AIError('Blending prompt is required', 'INVALID_INPUT')
      }

      // Validate all files
      for (const file of imageFiles) {
        if (!file.type.startsWith('image/')) {
          throw new AIError(`File ${file.name} is not an image`, 'INVALID_FILE_TYPE')
        }
      }

      // Convert all files to URLs
      const imageUrls = await Promise.all(
        imageFiles.map(file => NanoBananaProvider.fileToUrl(file))
      )

      const result = await this.provider!.blendImages(imageUrls, prompt, 'png')

      console.log('✅ Images blended successfully with Nano Banana:', result.id)
      return result

    } catch (error) {
      console.error('❌ Nano Banana blend images failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Blending images failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BLEND_IMAGES_ERROR'
      )
    }
  }

  /**
   * Combine multiple images based on a prompt (legacy method)
   * @param imageFiles - Array of image files to combine
   * @param prompt - Description of how to combine them
   * @returns Promise<ImageEditResponse>
   */
  async combineImages(imageFiles: File[], prompt: string): Promise<ImageEditResponse> {
    this.checkConfiguration()
    
    try {
      console.log('🎨 Combining images:', { 
        fileCount: imageFiles.length, 
        files: imageFiles.map(f => f.name),
        prompt 
      })
      
      if (!imageFiles || imageFiles.length === 0) {
        throw new AIError('At least one image file is required', 'INVALID_INPUT')
      }

      if (imageFiles.length > 5) {
        throw new AIError('Maximum 5 images can be combined at once', 'TOO_MANY_IMAGES')
      }

      if (!prompt?.trim()) {
        throw new AIError('Combination prompt is required', 'INVALID_INPUT')
      }

      // Validate all files
      for (const file of imageFiles) {
        if (!file.type.startsWith('image/')) {
          throw new AIError(`File ${file.name} is not an image`, 'INVALID_FILE_TYPE')
        }
      }

      // Convert all files to URLs
      const imageUrls = await Promise.all(
        imageFiles.map(file => NanoBananaProvider.fileToUrl(file))
      )

      // Use blend method for combining (Nano Banana's strength)
      const result = await this.provider!.blendImages(imageUrls, prompt, 'png')

      console.log('✅ Images combined successfully:', result.id)
      return result

    } catch (error) {
      console.error('❌ Combine images failed:', error)
      throw error instanceof AIError ? error : new AIError(
        `Combining images failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMBINE_IMAGES_ERROR'
      )
    }
  }

  /**
   * Create a download URL from an image edit response
   * @param response - The image edit response containing image URL
   * @param filename - Optional filename for the download
   * @returns string - Download URL
   */
  createDownloadUrl(response: ImageEditResponse, filename?: string): string {
    if (!response.resultImage) {
      throw new AIError('No result image data available', 'NO_RESULT_IMAGE')
    }

    // Nano Banana returns URLs directly from Replicate
    return response.resultImage
  }

  /**
   * Download an edited image from URL
   * @param response - The image edit response
   * @param filename - Optional filename (defaults to operation_timestamp.png)
   */
  async downloadImage(response: ImageEditResponse, filename?: string): Promise<void> {
    if (!response.resultImage) {
      throw new AIError('No result image data available', 'NO_RESULT_IMAGE')
    }

    const defaultFilename = `nanoBanana_${response.metadata?.operation || 'edited'}_${Date.now()}.png`
    const downloadFilename = filename || defaultFilename

    try {
      // Fetch the image from URL
      const imageResponse = await fetch(response.resultImage)
      const blob = await imageResponse.blob()
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download image:', error)
      throw new AIError('Failed to download image', 'DOWNLOAD_ERROR')
    }
  }

  /**
   * Get supported image formats for Nano Banana
   * @returns Array of supported MIME types
   */
  getSupportedFormats(): string[] {
    return [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ]
  }

  /**
   * Validate if a file is a supported image format
   * @param file - File to validate
   * @returns boolean
   */
  isValidImageFile(file: File): boolean {
    return this.getSupportedFormats().includes(file.type)
  }

  /**
   * Get maximum file size limit
   * @returns number - Max file size in bytes
   */
  getMaxFileSize(): number {
    return 10 * 1024 * 1024 // 10MB
  }
}

// Export a singleton instance
export const imageEditor = new ImageEditor()

// Export types for use in components
export type { ImageEditResponse }