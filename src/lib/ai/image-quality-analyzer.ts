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

    return `## Análise de Foto para Treinamento de IA

**Foto:** ${photoDescription}
**Tipo de sujeito:** ${subjectType}

---

### 🎯 Objetivo
Avaliar se a foto deve ser **APROVADA** ou **REPROVADA** para treino de um modelo de IA.

> **REGRA DE OURO:**
> Na dúvida, **APROVE**.
> Só **REPROVE** se houver um problema **MUITO claro e GRAVE** que impeça aprender o rosto/identidade.

> **Consistência é obrigatória:**
> A mesma foto deve **sempre** receber a **mesma avaliação**.

---

## ✅ CRITÉRIOS IDEAIS (bônus – não obrigatórios)
- Ombros para cima (close de rosto) **OU** cintura para cima **OU** corpo inteiro
- Olhando para a câmera (ou levemente de lado)
- Pessoa/animal é o foco principal da foto

---

## 🔴 REPROVAR — **APENAS se for MUITO claro**

${subjectType === 'pessoa' ? `### 🔹 Se o sujeito for **PESSOA**
Reprove **somente** se ocorrer **pelo menos 1 item abaixo**, de forma clara:

- Imagem **claramente gerada por IA** (arte digital, pele irreal, inconsistências evidentes).
- **Outra pessoa** com o **rosto claramente visível e nítido**, ocupando parte relevante da imagem.
  - ✅ **Permita** se a outra pessoa estiver desfocada, ao fundo, de costas, cortada ou irreconhecível.
- **Filtros pesados** (Snapchat/AR): distorções, embelezamento extremo.
- **Careta extrema** que deforma o rosto (língua para fora, olhos arregalados, boca exageradamente aberta).
- **Desfoque severo**: não dá para distinguir olhos, nariz e boca.
- **Qualidade muito baixa**: pixelização grave **OU** rosto muito pequeno (< ~80–100px de altura).
- **Corte crítico do rosto**: falta testa **OU** falta queixo **OU** ambos os olhos não aparecem.
- **Oclusão grande**: ~40% ou mais do rosto coberto **OU** olhos/nariz encobertos.
- **Iluminação extrema**: rosto quase invisível ou estourado a ponto de apagar detalhes.
- **ÓCULOS ESCUROS**: qualquer tipo que esconda os olhos.
- **BONÉ / CHAPÉU / GORRO**: qualquer tipo que esconda a testa/linha do cabelo de forma relevante.` : `### 🔹 Se o sujeito for **ANIMAL**
Reprove **somente** se ocorrer **pelo menos 1 item abaixo**, de forma clara:

- **Múltiplos animais** claramente visíveis como sujeitos principais.
- **Pessoas muito visíveis e nítidas** competindo com o animal.
- **Fantasias/roupas exageradas** que alterem a aparência real do animal.
- Animal **dormindo/olhos fechados**, sem visual claro do rosto.
- **Desfoque severo** ou **iluminação extrema** que impeça ver os traços.`}

---

## 🟡 ALERTAS (NÃO reprovar — apenas registrar, se quiser)
Marque como **alerta**, mas **APROVE**, quando houver:

- Sombra parcial no rosto, **desde que** olhos/nariz/boca sejam reconhecíveis.
- Luz dura, contraluz moderado, iluminação "imperfeita".
- Leve desfoque, granulação ou compressão.
- Rosto levemente de lado (perfil 3/4), selfie normal.
- Objeto/mão cobrindo pouco do rosto (não esconder os dois olhos).
- Pedaço de outra pessoa aparecendo **sem** rosto reconhecível.
- Pessoa ao fundo **sem** competir com o sujeito.

---

## ✅ ACEITÁVEL — exemplos explícitos
- Sombras fortes no rosto **com traços visíveis** ✅
- Parte de outra pessoa **sem rosto reconhecível** ✅
- Praia, sol forte, sombra de árvore/coqueiro ✅
- Criança/bebê parcialmente aparecendo **sem competir** ✅
- Expressões normais: sorrindo, sério, rindo ✅
- Óculos de grau **transparentes** ✅

---

Responda APENAS em JSON válido (sem markdown):
{
  "hasIssues": <true APENAS se houver problema GRAVE E ÓBVIO que impeça o treino, false se OK ou duvidoso>,
  "criticalIssues": [<array com códigos: "ai_generated", "multiple_people", "making_faces", "heavy_filters", "low_light", "blurry", "hat_or_cap", "sunglasses", "extreme_angle", "face_cut_off", "low_quality", "face_covered">],
  "minorIssues": [],
  "issuesSummary": "<se hasIssues=true, descreva APENAS os problemas graves de forma objetiva. Ex: 'Óculos escuros'. Se false, omita>"
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
