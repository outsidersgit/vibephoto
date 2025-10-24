import { prisma } from '@/lib/db'

export interface ModerationResult {
  isAllowed: boolean
  reason?: string
  severity: 'low' | 'medium' | 'high'
  categories: string[]
  confidence: number
}

export interface ContentAnalysis {
  prompt: string
  userId: string
  result: ModerationResult
  timestamp: Date
}

export class ContentModerator {
  // Lista de palavras proibidas por categoria
  private static readonly BANNED_WORDS = {
    explicit: [
      'nude', 'naked', 'nsfw', 'explicit', 'sexual', 'porn', 'erotic',
      'sex', 'xxx', 'adult', 'aroused', 'orgasm', 'genitals', 'intimate'
    ],
    violence: [
      'violence', 'blood', 'gore', 'death', 'kill', 'murder', 'weapon',
      'gun', 'knife', 'sword', 'bomb', 'torture', 'pain', 'hurt'
    ],
    hate: [
      'hate', 'racist', 'nazi', 'terrorist', 'supremacist', 'bigot',
      'slur', 'discrimination', 'prejudice'
    ],
    drugs: [
      'drug', 'cocaine', 'heroin', 'marijuana', 'weed', 'meth', 'alcohol',
      'drunk', 'high', 'stoned', 'addiction'
    ],
    minors: [
      'child', 'kid', 'minor', 'baby', 'toddler', 'teen', 'underage',
      'school', 'student', 'young'
    ]
  }

  // Padrões suspeitos
  private static readonly SUSPICIOUS_PATTERNS = [
    /\b(very\s+)?(young|little|small)\s+(girl|boy|child)\b/i,
    /\b(barely|just|recently)\s+(18|legal|adult)\b/i,
    /\b(school|uniform|student)\s+(girl|boy)\b/i,
    /\b(realistic|photorealistic)\s+(child|minor|kid)\b/i,
    /\b(deepfake|fake\s+porn|non\-?consensual)\b/i
  ]

  static async moderateContent(prompt: string, userId: string): Promise<ModerationResult> {
    const normalizedPrompt = prompt.toLowerCase().trim()
    const categories: string[] = []
    let severity: 'low' | 'medium' | 'high' = 'low'
    let confidence = 0

    // Verificar palavras banidas
    for (const [category, words] of Object.entries(this.BANNED_WORDS)) {
      const foundWords = words.filter(word => 
        normalizedPrompt.includes(word.toLowerCase())
      )
      
      if (foundWords.length > 0) {
        categories.push(category)
        confidence += foundWords.length * 0.2
        
        // Categorias mais severas
        if (['explicit', 'minors', 'violence'].includes(category)) {
          severity = 'high'
        } else if (severity !== 'high') {
          severity = 'medium'
        }
      }
    }

    // Verificar padrões suspeitos
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(normalizedPrompt)) {
        categories.push('suspicious_pattern')
        confidence += 0.4
        severity = 'high'
      }
    }

    // Verificar combinações perigosas
    const dangerousCombinations = [
      ['young', 'naked'],
      ['child', 'sexual'],
      ['minor', 'explicit'],
      ['school', 'nude'],
      ['realistic', 'underage']
    ]

    for (const [word1, word2] of dangerousCombinations) {
      if (normalizedPrompt.includes(word1) && normalizedPrompt.includes(word2)) {
        categories.push('dangerous_combination')
        confidence += 0.6
        severity = 'high'
      }
    }

    // Verificar histórico do usuário
    const userViolations = await this.getUserViolationHistory(userId)
    if (userViolations > 0) {
      confidence += userViolations * 0.1
      if (userViolations >= 3) {
        severity = 'high'
      }
    }

    confidence = Math.min(confidence, 1.0)
    const isAllowed = confidence < 0.5 && severity !== 'high'

    const result: ModerationResult = {
      isAllowed,
      reason: !isAllowed ? this.generateReason(categories, severity) : undefined,
      severity,
      categories,
      confidence
    }

    // Log da moderação
    await this.logModerationResult({
      prompt,
      userId,
      result,
      timestamp: new Date()
    })

    return result
  }

  static async moderateImage(imageUrl: string, userId: string): Promise<ModerationResult> {
    // Placeholder para moderação de imagens
    // Em produção, integrar com serviços como AWS Rekognition, Google Vision AI, etc.
    
    try {
      // Simulação de análise de imagem
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        isAllowed: true,
        severity: 'low',
        categories: [],
        confidence: 0.1
      }
    } catch (error) {
      console.error('Image moderation error:', error)
      
      return {
        isAllowed: false,
        reason: 'Unable to verify image content',
        severity: 'medium',
        categories: ['analysis_failed'],
        confidence: 0.5
      }
    }
  }

  private static async getUserViolationHistory(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const violations = await prisma.usageLog.count({
      where: {
        userId,
        action: 'content_violation',
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    return violations
  }

  private static generateReason(categories: string[], severity: string): string {
    if (categories.includes('minors')) {
      return 'Content involving minors is strictly prohibited'
    }
    
    if (categories.includes('explicit')) {
      return 'Explicit or sexual content is not allowed'
    }
    
    if (categories.includes('violence')) {
      return 'Violent content is not permitted'
    }
    
    if (categories.includes('hate')) {
      return 'Hate speech or discriminatory content is prohibited'
    }
    
    if (categories.includes('suspicious_pattern')) {
      return 'Content matches prohibited patterns'
    }
    
    if (categories.includes('dangerous_combination')) {
      return 'Content contains prohibited keyword combinations'
    }
    
    return 'Content violates community guidelines'
  }

  private static async logModerationResult(analysis: ContentAnalysis): Promise<void> {
    try {
      // Only log violations to reduce noise
      if (!analysis.result.isAllowed) {
        await prisma.usageLog.create({
          data: {
            userId: analysis.userId,
            action: 'content_violation',
            details: {
              content: analysis.prompt,
              severity: analysis.result.severity,
              categories: analysis.result.categories,
              confidence: analysis.result.confidence,
              reason: analysis.result.reason
            },
            creditsUsed: 0
          }
        })
      }
    } catch (error) {
      console.error('Failed to log moderation result:', error)
    }
  }

  static async getViolationStats(userId?: string): Promise<{
    total: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    recent: number
  }> {
    const where = userId ? { userId } : {}
    
    const [total, recent, violations] = await Promise.all([
      prisma.usageLog.count({
        where: { ...where, action: 'content_violation' }
      }),
      prisma.usageLog.count({
        where: {
          ...where,
          action: 'content_violation',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.usageLog.findMany({
        where: { ...where, action: 'content_violation' },
        select: {
          details: true
        }
      })
    ])

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}

    violations.forEach(violation => {
      const details = violation.details as any
      if (details?.categories) {
        details.categories.forEach((category: string) => {
          byCategory[category] = (byCategory[category] || 0) + 1
        })
      }
      if (details?.severity) {
        bySeverity[details.severity] = (bySeverity[details.severity] || 0) + 1
      }
    })

    return {
      total,
      byCategory,
      bySeverity,
      recent
    }
  }

  static async checkUserStatus(userId: string): Promise<{
    isBanned: boolean
    isRestricted: boolean
    violationCount: number
    banReason?: string
  }> {
    // Since status and banReason fields don't exist, check violation history
    const violationCount = await this.getUserViolationHistory(userId)
    
    // Consider user banned if they have too many violations
    const isBanned = violationCount >= 10
    const isRestricted = violationCount >= 5

    return {
      isBanned,
      isRestricted,
      violationCount,
      banReason: isBanned ? 'Too many content violations' : undefined
    }
  }
}