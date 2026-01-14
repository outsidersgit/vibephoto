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
 * Uses OpenAI GPT-4o Vision API to analyze photos for AI model training
 * Checks for: glasses, sunglasses, blur, multiple people, headwear, etc.
 */

interface OpenAIVisionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class ImageQualityAnalyzer {
  private apiKey: string
  private model: string
  private endpoint: string

  constructor() {
    if (!AI_CONFIG.openai.apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    this.apiKey = AI_CONFIG.openai.apiKey
    this.model = AI_CONFIG.openai.model
    this.endpoint = AI_CONFIG.openai.endpoint
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
      console.log(`🔍 Analyzing with OpenAI GPT-4o: ${filename} (${options.photoType})`)

      // Build the analysis prompt
      const prompt = this.buildAnalysisPrompt(options)

      // Call OpenAI API with base64 image
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData // Already in data:image/jpeg;base64,... format
                  }
                }
              ]
            }
          ],
          max_tokens: AI_CONFIG.openai.maxTokens,
          temperature: AI_CONFIG.openai.temperature
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ OpenAI API error:', errorText)
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data: OpenAIVisionResponse = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      console.log(`📊 OpenAI response for ${filename}:`, content.substring(0, 200))

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in OpenAI response')
      }

      const apiResponse = JSON.parse(jsonMatch[0])
      const processingTime = Date.now() - startTime

      // Build quality score with new simplified format + legacy fields
      const qualityScore: ImageQualityScore = {
        hasIssues: apiResponse.hasIssues || false,
        criticalIssues: apiResponse.criticalIssues || [],
        minorIssues: apiResponse.minorIssues || [],
        issuesSummary: apiResponse.issuesSummary,
        // Legacy fields for backward compatibility
        score: apiResponse.hasIssues ? 30 : 95,
        technicalQuality: 20,
        composition: 20,
        finetuningReadiness: apiResponse.hasIssues ? 10 : 45,
        feedback: apiResponse.issuesSummary || 'Foto adequada para treinamento',
        recommendations: apiResponse.hasIssues && apiResponse.issuesSummary
          ? [`Substitua esta foto: ${apiResponse.issuesSummary}`]
          : ['Foto aprovada'],
        status: apiResponse.hasIssues ? 'poor' : 'excellent'
      }

      const result: ImageQualityAnalysisResult = {
        filename,
        quality: qualityScore,
        isAcceptable: !apiResponse.hasIssues,
        isRecommended: !apiResponse.hasIssues,
        processingTime
      }

      console.log(`✅ Analysis complete: ${filename} - ${apiResponse.hasIssues ? '⚠️ Issues found' : '✓ OK'}`)

      return result

    } catch (error) {
      console.error(`❌ Error analyzing ${filename}:`, error)
      const processingTime = Date.now() - startTime

      return {
        filename,
        quality: {
          hasIssues: true,
          criticalIssues: [],
          minorIssues: [],
          issuesSummary: 'Erro ao analisar',
          score: 0,
          technicalQuality: 0,
          composition: 0,
          finetuningReadiness: 0,
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
    console.log(`📦 Analyzing ${images.length} images with OpenAI GPT-4o...`)

    const results: ImageQualityAnalysisResult[] = []

    for (const image of images) {
      const result = await this.analyzeImage(image.data, image.filename, options)
      results.push(result)
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const totalProcessingTime = Date.now() - startTime
    const photosWithIssues = results.filter(r => r.quality.hasIssues).length
    const photosOk = results.length - photosWithIssues

    console.log(`✅ Batch complete: ${results.length} images in ${totalProcessingTime}ms`)
    console.log(`📊 Photos OK: ${photosOk}, With issues: ${photosWithIssues}`)

    return {
      results,
      summary: {
        totalImages: images.length,
        photosWithIssues,
        photosOk,
        processingTime: totalProcessingTime,
        // Legacy fields
        averageScore: photosWithIssues === 0 ? 95 : 50,
        acceptableCount: photosOk,
        recommendedCount: photosOk
      }
    }
  }

  /**
   * Build the analysis prompt based on photo type
   */
  private buildAnalysisPrompt(options: ImageQualityAnalysisOptions): string {
    const { photoType, modelClass } = options

    const subjectType = modelClass === 'ANIMAL' ? 'animal' : 'pessoa'
    const photoDescription = this.getPhotoTypeDescription(photoType)

    return `Você é um especialista em análise de fotos para fine-tuning de modelos de IA (FLUX, Stable Diffusion).

Analise esta foto de ${photoDescription} e identifique APENAS problemas ÓBVIOS e GRAVES que impedem seu uso para treinar um modelo de IA de ${subjectType}.

SEJA CONSERVADOR: só marque como problema se tiver CERTEZA absoluta. Quando em dúvida, aprove a foto.

PROBLEMAS CRÍTICOS (só marque se MUITO evidente):
${subjectType === 'pessoa' ? `
❌ Boné/chapéu cobrindo MAIOR PARTE da cabeça ou cabelo
❌ Óculos escuros GROSSOS cobrindo os olhos
❌ Rosto coberto por máscara, cachecol ou mão
❌ MÚLTIPLAS pessoas claramente visíveis (não conte reflexos ou pessoas muito ao fundo)
❌ Caretas EXTREMAS, língua para fora, olhos TOTALMENTE fechados
❌ Filtros PESADOS tipo Snapchat (orelhas de gato, efeitos digitais óbvios)
❌ Ângulos MUITO extremos (de baixo, de cima demais)
` : `
❌ Múltiplos animais
❌ Pessoas muito visíveis
❌ Animal com fantasias exageradas
❌ Animal dormindo ou olhos fechados
`}

PROBLEMAS MENORES (só marque se MUITO grave):
⚠️ Foto MUITO desfocada (impossível ver detalhes)
⚠️ Iluminação EXTREMAMENTE ruim (quase não dá pra ver a pessoa)
⚠️ Resolução MUITO baixa (pixelizada)
⚠️ Enquadramento cortando partes importantes (metade do rosto fora)

IMPORTANTE:
- Óculos de grau normais: OK ✅
- Pessoa ao LONGE no fundo: OK ✅
- Iluminação não perfeita mas dá pra ver: OK ✅
- Pequeno desfoque ou granulação: OK ✅
- Expressões normais (sorriso, sério): OK ✅
- Fundos urbanos/naturais comuns: OK ✅

Responda APENAS em JSON válido (sem markdown):
{
  "hasIssues": <true APENAS se houver problema GRAVE e ÓBVIO, false caso contrário>,
  "criticalIssues": [<array com códigos: "hat_or_cap", "sunglasses", "face_covered", "multiple_people", "making_faces", "eyes_closed", "heavy_filters", "hand_covering_face", "extreme_angle", "mask">],
  "minorIssues": [<array com códigos: "slight_blur", "low_light", "low_resolution", "poor_framing">],
  "issuesSummary": "<se hasIssues=true, liste APENAS os problemas graves em 1 frase curta. Ex: 'Óculos escuros cobrindo os olhos'. Se false, omita este campo>"
}`
  }

  /**
   * Get photo type description in Portuguese
   */
  private getPhotoTypeDescription(photoType: string): string {
    switch (photoType) {
      case 'face':
        return 'rosto (close-up do rosto)'
      case 'half_body':
        return 'meio corpo (da cintura para cima)'
      case 'full_body':
        return 'corpo inteiro'
      default:
        return 'rosto'
    }
  }
}

// Singleton instance for use across the application
export const imageQualityAnalyzer = new ImageQualityAnalyzer()
