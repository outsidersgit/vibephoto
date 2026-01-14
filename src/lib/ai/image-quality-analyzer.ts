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

      const qualityScore: ImageQualityScore = JSON.parse(jsonMatch[0])
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
    console.log(`📦 Analyzing ${images.length} images with OpenAI GPT-4o...`)

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
   * Build the analysis prompt based on photo type
   */
  private buildAnalysisPrompt(options: ImageQualityAnalysisOptions): string {
    const { photoType, modelClass } = options

    const subjectType = modelClass === 'ANIMAL' ? 'animal' : 'pessoa'
    const photoDescription = this.getPhotoTypeDescription(photoType)

    return `Você é um especialista em análise de fotos para fine-tuning de modelos de IA (FLUX, Stable Diffusion).

Analise esta foto de ${photoDescription} e avalie se ela é adequada para treinar um modelo de IA personalizado de ${subjectType}.

CRITÉRIOS DE AVALIAÇÃO:

1. QUALIDADE TÉCNICA (0-25 pontos):
   - Nitidez e foco adequados
   - Iluminação balanceada (sem sombras duras ou superexposição)
   - Resolução suficiente (mínimo 512x512, ideal 1024x1024+)
   - Sem artefatos de compressão ou ruído excessivo

2. COMPOSIÇÃO (0-25 pontos):
   - ${subjectType === 'pessoa' ? 'Pessoa' : 'Animal'} centralizado(a) e bem enquadrado(a)
   - Fundo não muito distrativo ou confuso
   - Distância adequada da câmera (nem muito longe, nem muito perto)
   - Pose não cortada (corpo completo visível para fotos de corpo inteiro)

3. ADEQUAÇÃO PARA FINE-TUNING (0-50 pontos) - MAIS IMPORTANTE:

   PROBLEMAS CRÍTICOS que prejudicam MUITO o treinamento:
   ${subjectType === 'pessoa' ? `
   ❌ Boné, chapéu, gorro ou qualquer coisa cobrindo a cabeça/cabelo
   ❌ Óculos escuros (óculos de grau transparente são OK se a pessoa usa sempre)
   ❌ Máscaras faciais, cachecóis ou mãos cobrindo o rosto
   ❌ Outras pessoas visíveis na foto (mesmo parcialmente ou ao fundo)
   ❌ Caretas, língua para fora, olhos fechados ou piscando
   ❌ Expressões muito extremas ou não naturais
   ❌ Filtros pesados (Instagram, Snapchat, beautify)
   ❌ Ângulos muito extremos (muito de cima, muito de baixo, perfil completo)
   ` : `
   ❌ Múltiplos animais na foto
   ❌ Pessoas muito visíveis junto com o animal
   ❌ Animal com acessórios exagerados (fantasias, roupas muito chamativas)
   ❌ Animal dormindo ou com olhos fechados
   `}

   ✅ FOTO IDEAL: ${subjectType} sozinho(a), ${subjectType === 'pessoa' ? 'rosto descoberto, sem acessórios que cubram características faciais (cabelo, olhos, sobrancelhas)' : 'animal em destaque'}, expressão/pose natural, boa iluminação, sem filtros, fundo simples

IMPORTANTE: Seja RIGOROSO com acessórios que cobrem o rosto (bonés, chapéus, óculos escuros). Estes são os problemas MAIS GRAVES pois impedem o modelo de aprender características faciais corretamente.

Responda APENAS em JSON válido (sem markdown, sem \`\`\`json):
{
  "score": <número 0-100>,
  "technicalQuality": <número 0-25>,
  "composition": <número 0-25>,
  "finetuningReadiness": <número 0-50>,
  "criticalIssues": [<array de strings: "hat_or_cap", "sunglasses", "face_covered", "multiple_people", "making_faces", "eyes_closed", "heavy_filters", "hand_covering_face", "extreme_angle", "mask">],
  "minorIssues": [<array de strings: "slight_blur", "low_light", "busy_background", "low_resolution", "overexposed", "underexposed", "artifacts", "poor_framing">],
  "feedback": "<texto curto em português (max 150 caracteres) explicando a avaliação geral>",
  "recommendations": [<array com 1-3 recomendações específicas em português para melhorar a foto, se houver problemas>]
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
