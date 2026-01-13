import { GoogleGenerativeAI } from '@google/generative-ai'
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
 * Uses Gemini 2.5 Flash Lite to analyze photos for AI model training
 * Checks for: technical quality, composition, and fine-tuning best practices
 */
export class ImageQualityAnalyzer {
  private client: GoogleGenerativeAI
  private model: any

  constructor() {
    if (!AI_CONFIG.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    this.client = new GoogleGenerativeAI(AI_CONFIG.gemini.apiKey)

    // Use Gemini 2.5 Flash Lite - fast and free tier
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent analysis
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      }
    })
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
      console.log(`🔍 Analyzing image quality: ${filename} (${options.photoType})`)

      const prompt = this.buildAnalysisPrompt(options)

      // Prepare image for Gemini
      const imagePart = {
        inlineData: {
          data: imageData.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: this.getMimeType(imageData)
        }
      }

      // Call Gemini Vision API
      const result = await this.model.generateContent([prompt, imagePart])
      const response = await result.response
      const text = response.text()

      console.log(`📊 Raw Gemini response for ${filename}:`, text.substring(0, 200))

      // Parse JSON response
      let analysisData: any
      try {
        analysisData = JSON.parse(text)
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response:', text)
        throw new Error('Invalid JSON response from Gemini')
      }

      // Build quality score
      const qualityScore: ImageQualityScore = {
        score: analysisData.score || 0,
        technicalQuality: analysisData.technicalQuality || 0,
        composition: analysisData.composition || 0,
        finetuningReadiness: analysisData.finetuningReadiness || 0,
        criticalIssues: analysisData.criticalIssues || [],
        minorIssues: analysisData.minorIssues || [],
        feedback: analysisData.feedback || 'Análise não disponível',
        recommendations: analysisData.recommendations || [],
        status: getQualityStatus(analysisData.score || 0)
      }

      const processingTime = Date.now() - startTime

      const result: ImageQualityAnalysisResult = {
        filename,
        quality: qualityScore,
        isAcceptable: qualityScore.score >= 50,
        isRecommended: qualityScore.score >= 70,
        processingTime
      }

      console.log(`✅ Analysis complete: ${filename} - Score: ${qualityScore.score} (${qualityScore.status})`)

      return result

    } catch (error) {
      console.error(`❌ Error analyzing ${filename}:`, error)

      // Return a default poor quality result on error
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
          feedback: 'Erro ao analisar a imagem. Por favor, tente novamente.',
          recommendations: ['Verifique se a imagem não está corrompida e tente fazer upload novamente.'],
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
    console.log(`📸 Starting batch analysis of ${images.length} images`)

    const results: ImageQualityAnalysisResult[] = []

    // Analyze images sequentially to avoid rate limits
    for (const image of images) {
      const result = await this.analyzeImage(image.data, image.filename, options)
      results.push(result)
    }

    // Calculate summary
    const summary = {
      total: results.length,
      perfect: results.filter(r => r.quality.score >= 90).length,
      excellent: results.filter(r => r.quality.score >= 70 && r.quality.score < 90).length,
      acceptable: results.filter(r => r.quality.score >= 50 && r.quality.score < 70).length,
      poor: results.filter(r => r.quality.score < 50).length,
      averageScore: results.reduce((sum, r) => sum + r.quality.score, 0) / results.length,
      recommendedCount: results.filter(r => r.isRecommended).length,
      acceptableCount: results.filter(r => r.isAcceptable).length
    }

    // Generate overall recommendation
    let overallRecommendation = ''
    if (summary.averageScore >= 80) {
      overallRecommendation = '✅ Excelente! Suas fotos têm alta qualidade e são ideais para treinamento.'
    } else if (summary.averageScore >= 70) {
      overallRecommendation = '✅ Bom! A maioria das suas fotos é adequada para treinamento.'
    } else if (summary.averageScore >= 50) {
      overallRecommendation = '⚠️ Atenção: Algumas fotos precisam ser substituídas para melhores resultados. Veja as recomendações abaixo.'
    } else {
      overallRecommendation = '❌ Aviso: A maioria das fotos está abaixo do recomendado. Substitua as fotos marcadas para garantir um bom treinamento.'
    }

    console.log(`📊 Batch analysis complete - Average score: ${summary.averageScore.toFixed(1)}`)

    return {
      results,
      summary,
      overallRecommendation
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
