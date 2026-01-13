import {
  ImageQualityScore,
  ImageQualityAnalysisResult,
  BatchQualityAnalysisResult,
  ImageQualityAnalysisOptions,
  getQualityStatus,
  CriticalIssue,
  MinorIssue
} from '@/types/image-quality'
import { AI_CONFIG } from './config'

/**
 * Image Quality Analyzer for Fine-Tuning Photos
 * Uses Astria Image Inspection API to analyze photos for AI model training
 * Checks for: glasses, sunglasses, blur, multiple people, headwear, etc.
 */

interface AstriaInspectionResponse {
  age?: string
  ethnicity?: string
  eye_color?: string
  facial_hair?: string
  gender?: string
  glasses?: string
  hair_color?: string
  hair_length?: string
  body_type?: string
  soft_prompts?: string[]
  sunglasses?: boolean
  blurry?: boolean
  long_shot?: boolean
  multiple_people?: boolean
  selfie?: boolean
  headwear?: string
}

export class ImageQualityAnalyzer {
  private apiKey: string

  constructor() {
    if (!AI_CONFIG.astria.apiKey) {
      throw new Error('ASTRIA_API_KEY not configured')
    }
    this.apiKey = AI_CONFIG.astria.apiKey
  }

  /**
   * Analyze a single image for quality and fine-tuning readiness
   */
  async analyzeImage(
    imageData: string,
    filename: string,
    options: ImageQualityAnalysisOptions
  ): Promise<ImageQualityAnalysisResult> {
    const startTime = Date.now()

    try {
      console.log(`🔍 Analyzing with Astria: ${filename} (${options.photoType})`)

      // Convert base64 to blob
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const binaryData = atob(base64Data)
      const bytes = new Uint8Array(binaryData.length)
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: this.getMimeType(imageData) })

      // Prepare form data
      const formData = new FormData()
      formData.append('file', blob, filename)
      const className = this.mapClassToAstriaName(options.modelClass)
      formData.append('name', className)

      // Call Astria inspection API
      const response = await fetch('https://api.astria.ai/images/inspect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Astria API error:', errorText)
        throw new Error(`Astria API error: ${response.status}`)
      }

      const astriaData: AstriaInspectionResponse = await response.json()
      console.log(`📊 Astria response for ${filename}:`, astriaData)

      // Build quality score based on Astria's detection
      const qualityScore = this.calculateQualityScore(astriaData, options)
      const processingTime = Date.now() - startTime

      const result: ImageQualityAnalysisResult = {
        filename,
        quality: qualityScore,
        isAcceptable: qualityScore.score >= 50,
        isRecommended: qualityScore.score >= 70,
        processingTime
      }

      console.log(`✅ Analysis complete: ${filename} - Score: ${qualityScore.score}`)

      return result

    } catch (error) {
      console.error(`❌ Error analyzing ${filename}:`, error)
      const processingTime = Date.now() - startTime

      return {
        filename,
        quality: {
          score: 0,
          technicalQuality: 0,
          composition: 0,
          finetuningReadiness: 0,
          criticalIssues: [],
          minorIssues: [],
          feedback: 'Erro ao analisar a imagem.',
          recommendations: ['Verifique se a imagem não está corrompida.'],
          status: 'poor'
        },
        isAcceptable: false,
        isRecommended: false,
        processingTime
      }
    }
  }

  /**
   * Analyze multiple images in batch
   */
  async analyzeImages(
    images: Array<{ data: string; filename: string }>,
    options: ImageQualityAnalysisOptions
  ): Promise<BatchQualityAnalysisResult> {
    const startTime = Date.now()
    console.log(`📦 Analyzing ${images.length} images with Astria...`)

    const results: ImageQualityAnalysisResult[] = []

    for (const image of images) {
      const result = await this.analyzeImage(image.data, image.filename, options)
      results.push(result)
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const totalProcessingTime = Date.now() - startTime
    const averageScore = results.reduce((sum, r) => sum + r.quality.score, 0) / results.length
    const acceptableCount = results.filter(r => r.isAcceptable).length
    const recommendedCount = results.filter(r => r.isRecommended).length

    console.log(`✅ Batch complete: ${results.length} images in ${totalProcessingTime}ms`)
    console.log(`📊 Average: ${averageScore.toFixed(1)}, Acceptable: ${acceptableCount}/${results.length}`)

    return {
      results,
      summary: {
        totalImages: images.length,
        averageScore,
        acceptableCount,
        recommendedCount,
        processingTime: totalProcessingTime
      }
    }
  }

  /**
   * Calculate quality score based on Astria inspection results
   */
  private calculateQualityScore(
    data: AstriaInspectionResponse,
    options: ImageQualityAnalysisOptions
  ): ImageQualityScore {
    let score = 100 // Start perfect
    let technicalQuality = 25
    let composition = 25
    let finetuningReadiness = 50

    const criticalIssues: CriticalIssue[] = []
    const minorIssues: MinorIssue[] = []
    const recommendations: string[] = []

    // CRITICAL ISSUES
    if (data.sunglasses === true) {
      criticalIssues.push('sunglasses')
      finetuningReadiness -= 20
      score -= 30
      recommendations.push('Remova fotos com óculos escuros - impedem o modelo de aprender características faciais')
    }

    if (data.headwear && data.headwear !== 'NONE') {
      criticalIssues.push('hat_or_cap')
      finetuningReadiness -= 20
      score -= 30
      recommendations.push('Remova fotos com chapéus, bonés ou gorros - cobrem características importantes')
    }

    if (data.multiple_people === true) {
      criticalIssues.push('multiple_people')
      finetuningReadiness -= 25
      score -= 40
      recommendations.push('Use apenas fotos com UMA pessoa - modelo pode ficar confuso com múltiplas pessoas')
    }

    if (data.blurry === true) {
      criticalIssues.push('eyes_closed') // Using as proxy for blur
      technicalQuality -= 15
      score -= 25
      recommendations.push('Foto embaçada - use imagens nítidas e focadas')
    }

    // MINOR ISSUES
    if (data.glasses && data.glasses !== 'NONE' && !data.sunglasses) {
      minorIssues.push('slight_blur') // Using as proxy for glasses
      score -= 10
      recommendations.push('Óculos de grau: OK se você sempre usa, caso contrário prefira fotos sem')
    }

    if (data.selfie === true) {
      minorIssues.push('poor_framing')
      composition -= 5
      score -= 10
      recommendations.push('Selfies podem ter ângulos não ideais - prefira fotos tiradas por outra pessoa')
    }

    if (data.long_shot === true && options.photoType === 'face') {
      minorIssues.push('poor_framing')
      composition -= 10
      score -= 15
      recommendations.push('Foto muito distante para close de rosto - aproxime mais da câmera')
    }

    // Ensure no negative scores
    score = Math.max(0, score)
    technicalQuality = Math.max(0, technicalQuality)
    composition = Math.max(0, composition)
    finetuningReadiness = Math.max(0, finetuningReadiness)

    return {
      score,
      technicalQuality,
      composition,
      finetuningReadiness,
      criticalIssues,
      minorIssues,
      feedback: this.buildFeedback(score, criticalIssues),
      recommendations: recommendations.length > 0 ? recommendations.slice(0, 3) : ['Foto adequada para treinamento'],
      status: getQualityStatus(score)
    }
  }

  /**
   * Build feedback message based on score and issues
   */
  private buildFeedback(score: number, criticalIssues: CriticalIssue[]): string {
    if (score >= 90) return 'Foto perfeita para treinamento!'
    if (score >= 70) return 'Ótima foto para treinamento.'
    if (score >= 50) {
      return criticalIssues.length > 0
        ? `Foto aceitável, mas com ${criticalIssues.length} problema(s) que podem afetar qualidade`
        : 'Foto aceitável para treinamento'
    }
    return criticalIssues.length > 0
      ? `Foto inadequada - ${criticalIssues.length} problemas críticos detectados`
      : 'Qualidade abaixo do recomendado para treinamento'
  }

  /**
   * Map model class to Astria API name parameter
   */
  private mapClassToAstriaName(modelClass?: string): string {
    const mapping: Record<string, string> = {
      'MAN': 'man',
      'WOMAN': 'woman',
      'BOY': 'boy',
      'GIRL': 'girl',
      'ANIMAL': 'dog'
    }
    return mapping[modelClass || 'MAN'] || 'man'
  }

  /**
   * Extract MIME type from base64 data URL
   */
  private getMimeType(dataUrl: string): string {
    const match = dataUrl.match(/^data:(image\/\w+);base64,/)
    return match ? match[1] : 'image/jpeg'
  }
}

// Export singleton instance
export const imageQualityAnalyzer = new ImageQualityAnalyzer()
