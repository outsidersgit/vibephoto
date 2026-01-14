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

Analise esta foto de ${photoDescription} para treinar um modelo de IA de ${subjectType}.

✅ CRITÉRIOS IDEAIS (se a foto tiver isso, está ótima):
- Ombros para cima (close de rosto) OU cintura para cima OU corpo inteiro
- Olhando para a câmera
- Fotos de dias diferentes
- Mudança de fundos, iluminação e roupas
- Pessoa sozinha na foto

❌ PROBLEMAS CRÍTICOS (marque se encontrar):
${subjectType === 'pessoa' ? `
1. Imagens geradas por IA (rostos artificiais, arte digital)
2. Pessoas extras na foto (visíveis e próximas - ignore reflexos ou pessoas muito distantes no fundo)
3. Caretas ou expressões muito exageradas
4. Filtros digitais pesados (preto e branco artístico, Snapchat, Instagram com distorção)
5. Iluminação muito ruim (muito escura, muito clara, pessoa quase invisível)
6. Desfocada demais (impossível ver detalhes do rosto)
7. Chapéu ou boné cobrindo boa parte da cabeça/cabelo
8. Óculos escuros cobrindo os olhos
9. Ângulos muito extremos (de baixo para cima, de cima para baixo demais)
10. Rosto cortado ou partes importantes fora do enquadramento
11. Qualidade muito baixa ou pixelizada
12. Mão cobrindo rosto, máscara, cachecol no rosto
` : `
1. Múltiplos animais na mesma foto
2. Pessoas muito visíveis junto com o animal
3. Animal com fantasias ou roupas exageradas
4. Animal dormindo ou de olhos fechados
5. Iluminação muito ruim
6. Foto muito desfocada
`}

⚠️ ATENÇÃO - Estas NÃO são problemas:
- Óculos de grau transparentes (OK ✅)
- Pessoa pequena ao longe no fundo desfocado (OK ✅)
- Iluminação natural não perfeita mas dá pra ver bem (OK ✅)
- Leve desfoque ou granulação normal (OK ✅)
- Expressões normais: sorriso, sério, pensativo (OK ✅)
- Fundos urbanos, natureza, interiores comuns (OK ✅)
- Filtro suave de cor que não distorce (OK ✅)
- Boné/chapéu apenas na cabeça sem cobrir muito (OK ✅)

Responda APENAS em JSON válido (sem markdown):
{
  "hasIssues": <true se encontrar algum problema da lista vermelha, false se estiver OK>,
  "criticalIssues": [<array com códigos dos problemas encontrados: "ai_generated", "multiple_people", "making_faces", "heavy_filters", "low_light", "blurry", "hat_or_cap", "sunglasses", "extreme_angle", "face_cut_off", "low_quality", "face_covered">],
  "minorIssues": [],
  "issuesSummary": "<se hasIssues=true, descreva os problemas encontrados em 1 frase. Ex: 'Óculos escuros e pessoa extra ao fundo'. Se false, omita>"
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
