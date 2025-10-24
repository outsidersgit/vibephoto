import { prisma } from '@/lib/prisma'

interface AstriaUsageMetrics {
  tunesCreated: number
  imagesGenerated: number
  creditsUsed: number
  averageGenerationTime: number
  enhancementUsage: {
    faceInpainting: number
    faceSwap: number
    faceCorrect: number
    superResolution: number
    hiresFix: number
  }
  modelTypeUsage: {
    faceid: number
    sd15: number
    sdxl1: number
    fluxLora: number
  }
  qualityMetrics: {
    averageUserRating: number
    successRate: number
    errorRate: number
  }
}

interface AstriaPerformanceData {
  timestamp: Date
  operation: 'training' | 'generation' | 'outpainting' | 'style_pack'
  duration: number
  status: 'success' | 'failed' | 'timeout'
  enhancementsUsed: string[]
  modelType?: string
  resourceId: string
  userId: string
  cost: number
}

export class AstriaMonitor {
  private static metrics: AstriaUsageMetrics = {
    tunesCreated: 0,
    imagesGenerated: 0,
    creditsUsed: 0,
    averageGenerationTime: 0,
    enhancementUsage: {
      faceInpainting: 0,
      faceSwap: 0,
      faceCorrect: 0,
      superResolution: 0,
      hiresFix: 0
    },
    modelTypeUsage: {
      faceid: 0,
      sd15: 0,
      sdxl1: 0,
      fluxLora: 0
    },
    qualityMetrics: {
      averageUserRating: 0,
      successRate: 0,
      errorRate: 0
    }
  }

  private static performanceData: AstriaPerformanceData[] = []

  /**
   * Registra uma operação da Astria
   */
  static async recordOperation(data: AstriaPerformanceData) {
    try {
      // Adicionar aos dados de performance
      this.performanceData.push(data)

      // Manter apenas os últimos 1000 registros em memória
      if (this.performanceData.length > 1000) {
        this.performanceData = this.performanceData.slice(-1000)
      }

      // Atualizar métricas baseadas na operação
      if (data.operation === 'training' && data.status === 'success') {
        this.metrics.tunesCreated++

        if (data.modelType) {
          this.metrics.modelTypeUsage[data.modelType as keyof typeof this.metrics.modelTypeUsage]++
        }
      } else if (data.operation === 'generation' && data.status === 'success') {
        this.metrics.imagesGenerated++

        // Contar uso de enhancements
        data.enhancementsUsed.forEach(enhancement => {
          switch (enhancement) {
            case 'face_inpainting':
              this.metrics.enhancementUsage.faceInpainting++
              break
            case 'face_swap':
              this.metrics.enhancementUsage.faceSwap++
              break
            case 'face_correct':
              this.metrics.enhancementUsage.faceCorrect++
              break
            case 'super_resolution':
              this.metrics.enhancementUsage.superResolution++
              break
            case 'hires_fix':
              this.metrics.enhancementUsage.hiresFix++
              break
          }
        })
      }

      // Atualizar créditos usados
      this.metrics.creditsUsed += data.cost

      // Recalcular tempo médio de geração
      const generationData = this.performanceData.filter(d =>
        d.operation === 'generation' && d.status === 'success'
      )

      if (generationData.length > 0) {
        this.metrics.averageGenerationTime =
          generationData.reduce((sum, d) => sum + d.duration, 0) / generationData.length
      }

      // Calcular taxa de sucesso e erro
      const totalOperations = this.performanceData.length
      const successOperations = this.performanceData.filter(d => d.status === 'success').length
      const failedOperations = this.performanceData.filter(d => d.status === 'failed').length

      this.metrics.qualityMetrics.successRate = (successOperations / totalOperations) * 100
      this.metrics.qualityMetrics.errorRate = (failedOperations / totalOperations) * 100

      // Salvar no banco de dados para persistência
      await this.saveToDatabase(data)

      console.log('📊 Astria operation recorded:', {
        operation: data.operation,
        status: data.status,
        duration: `${Math.round(data.duration / 1000)}s`,
        cost: data.cost
      })

    } catch (error) {
      console.error('❌ Error recording Astria operation:', error)
    }
  }

  /**
   * Obtém métricas atuais
   */
  static getMetrics(): AstriaUsageMetrics {
    return { ...this.metrics }
  }

  /**
   * Obtém dados de performance dos últimos N dias
   */
  static getPerformanceData(days: number = 7): AstriaPerformanceData[] {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
    return this.performanceData.filter(d => d.timestamp >= cutoffDate)
  }

  /**
   * Analisa performance e identifica problemas
   */
  static analyzePerformance(): {
    alerts: string[]
    recommendations: string[]
    summary: {
      averageResponseTime: number
      errorRate: number
      costEfficiency: number
      popularEnhancements: string[]
    }
  } {
    const recentData = this.getPerformanceData(7)
    const alerts: string[] = []
    const recommendations: string[] = []

    // Análise de tempo de resposta
    const avgResponseTime = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.duration, 0) / recentData.length
      : 0

    if (avgResponseTime > 120000) { // Mais de 2 minutos
      alerts.push('Tempo de resposta médio da Astria está alto')
      recommendations.push('Considere usar modelos FaceID para operações mais rápidas')
    }

    // Análise de taxa de erro
    const errorRate = recentData.length > 0
      ? (recentData.filter(d => d.status === 'failed').length / recentData.length) * 100
      : 0

    if (errorRate > 10) {
      alerts.push('Taxa de erro da Astria está elevada')
      recommendations.push('Verifique configurações de API e créditos disponíveis')
    }

    // Análise de custo-benefício
    const totalCost = recentData.reduce((sum, d) => sum + d.cost, 0)
    const successfulGenerations = recentData.filter(d =>
      d.operation === 'generation' && d.status === 'success'
    ).length

    const costPerGeneration = successfulGenerations > 0 ? totalCost / successfulGenerations : 0

    if (costPerGeneration > 5) {
      recommendations.push('Custos por geração estão altos - considere otimizar uso de enhancements')
    }

    // Identificar enhancements mais populares
    const enhancementCounts: { [key: string]: number } = {}
    recentData.forEach(d => {
      d.enhancementsUsed.forEach(enhancement => {
        enhancementCounts[enhancement] = (enhancementCounts[enhancement] || 0) + 1
      })
    })

    const popularEnhancements = Object.entries(enhancementCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([enhancement]) => enhancement)

    return {
      alerts,
      recommendations,
      summary: {
        averageResponseTime: Math.round(avgResponseTime / 1000), // em segundos
        errorRate: Math.round(errorRate * 100) / 100,
        costEfficiency: Math.round(costPerGeneration * 100) / 100,
        popularEnhancements
      }
    }
  }

  /**
   * Compara performance entre Replicate e Astria
   */
  static async compareWithReplicate(): Promise<{
    astria: {
      averageTime: number
      successRate: number
      averageCost: number
      qualityScore: number
    }
    replicate: {
      averageTime: number
      successRate: number
      averageCost: number
      qualityScore: number
    }
    recommendation: string
  }> {
    try {
      // Obter dados da Astria
      const astriaData = this.getPerformanceData(30)
      const astriaGenerations = astriaData.filter(d => d.operation === 'generation')

      const astriaStats = {
        averageTime: astriaGenerations.length > 0
          ? astriaGenerations.reduce((sum, d) => sum + d.duration, 0) / astriaGenerations.length / 1000
          : 0,
        successRate: astriaGenerations.length > 0
          ? (astriaGenerations.filter(d => d.status === 'success').length / astriaGenerations.length) * 100
          : 0,
        averageCost: astriaGenerations.length > 0
          ? astriaGenerations.reduce((sum, d) => sum + d.cost, 0) / astriaGenerations.length
          : 0,
        qualityScore: 85 // Score baseado em feedback de usuários (placeholder)
      }

      // Obter dados do Replicate do banco de dados
      const replicateGenerations = await prisma.generation.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // últimos 30 dias
          },
          // Assumindo que gerações sem provider específico são do Replicate
          NOT: {
            jobId: {
              startsWith: 'astria_'
            }
          }
        },
        select: {
          processingTime: true,
          status: true,
          createdAt: true,
          completedAt: true
        }
      })

      const replicateStats = {
        averageTime: replicateGenerations.length > 0
          ? replicateGenerations
              .filter(g => g.processingTime)
              .reduce((sum, g) => sum + (g.processingTime || 0), 0) / replicateGenerations.length / 1000
          : 0,
        successRate: replicateGenerations.length > 0
          ? (replicateGenerations.filter(g => g.status === 'COMPLETED').length / replicateGenerations.length) * 100
          : 0,
        averageCost: 2.5, // Custo médio estimado para Replicate
        qualityScore: 75 // Score baseado em feedback de usuários (placeholder)
      }

      // Gerar recomendação
      let recommendation = ''
      if (astriaStats.qualityScore > replicateStats.qualityScore) {
        if (astriaStats.averageCost <= replicateStats.averageCost * 1.5) {
          recommendation = 'Astria oferece melhor qualidade com custo similar - recomendado para alta fidelidade'
        } else {
          recommendation = 'Astria oferece melhor qualidade mas com custo mais alto - use para casos críticos'
        }
      } else if (replicateStats.averageTime < astriaStats.averageTime) {
        recommendation = 'Replicate é mais rápido - recomendado para prototipagem rápida'
      } else {
        recommendation = 'Ambos têm performance similar - escolha baseada nas necessidades específicas'
      }

      return {
        astria: astriaStats,
        replicate: replicateStats,
        recommendation
      }

    } catch (error) {
      console.error('Error comparing providers:', error)
      throw error
    }
  }

  /**
   * Salva dados no banco de dados
   */
  private static async saveToDatabase(data: AstriaPerformanceData) {
    try {
      await prisma.usageLog.create({
        data: {
          userId: data.userId,
          action: `astria_${data.operation}`,
          details: {
            operation: data.operation,
            duration: data.duration,
            status: data.status,
            enhancementsUsed: data.enhancementsUsed,
            modelType: data.modelType,
            resourceId: data.resourceId
          },
          creditsUsed: data.cost,
          createdAt: data.timestamp
        }
      })
    } catch (error) {
      console.error('Error saving Astria data to database:', error)
    }
  }

  /**
   * Gera relatório de uso
   */
  static generateUsageReport(): {
    summary: string
    metrics: AstriaUsageMetrics
    performance: ReturnType<typeof AstriaMonitor.analyzePerformance>
  } {
    const metrics = this.getMetrics()
    const performance = this.analyzePerformance()

    const summary = `
Relatório de Uso da Astria AI:

📊 Estatísticas Gerais:
• ${metrics.tunesCreated} modelos treinados
• ${metrics.imagesGenerated} imagens geradas
• ${metrics.creditsUsed} créditos utilizados
• ${Math.round(metrics.averageGenerationTime / 1000)}s tempo médio de geração

🎨 Enhancements Mais Utilizados:
• Face Inpainting: ${metrics.enhancementUsage.faceInpainting} usos
• Super Resolution: ${metrics.enhancementUsage.superResolution} usos
• Face Swap: ${metrics.enhancementUsage.faceSwap} usos

🤖 Modelos Mais Populares:
• FaceID: ${metrics.modelTypeUsage.faceid} usos
• SDXL: ${metrics.modelTypeUsage.sdxl1} usos
• Flux LoRA: ${metrics.modelTypeUsage.fluxLora} usos

✅ Qualidade:
• Taxa de sucesso: ${Math.round(metrics.qualityMetrics.successRate)}%
• Taxa de erro: ${Math.round(metrics.qualityMetrics.errorRate)}%
    `.trim()

    return {
      summary,
      metrics,
      performance
    }
  }

  /**
   * Reset das métricas (para testes)
   */
  static resetMetrics() {
    this.metrics = {
      tunesCreated: 0,
      imagesGenerated: 0,
      creditsUsed: 0,
      averageGenerationTime: 0,
      enhancementUsage: {
        faceInpainting: 0,
        faceSwap: 0,
        faceCorrect: 0,
        superResolution: 0,
        hiresFix: 0
      },
      modelTypeUsage: {
        faceid: 0,
        sd15: 0,
        sdxl1: 0,
        fluxLora: 0
      },
      qualityMetrics: {
        averageUserRating: 0,
        successRate: 0,
        errorRate: 0
      }
    }
    this.performanceData = []
  }
}

// Função para integrar monitoramento no AstriaProvider
export function instrumentAstriaOperation(
  operation: 'training' | 'generation' | 'outpainting' | 'style_pack',
  resourceId: string,
  userId: string,
  enhancementsUsed: string[] = [],
  modelType?: string
) {
  const startTime = Date.now()

  return {
    recordSuccess: (cost: number = 0) => {
      AstriaMonitor.recordOperation({
        timestamp: new Date(),
        operation,
        duration: Date.now() - startTime,
        status: 'success',
        enhancementsUsed,
        modelType,
        resourceId,
        userId,
        cost
      })
    },
    recordFailure: (cost: number = 0) => {
      AstriaMonitor.recordOperation({
        timestamp: new Date(),
        operation,
        duration: Date.now() - startTime,
        status: 'failed',
        enhancementsUsed,
        modelType,
        resourceId,
        userId,
        cost
      })
    },
    recordTimeout: (cost: number = 0) => {
      AstriaMonitor.recordOperation({
        timestamp: new Date(),
        operation,
        duration: Date.now() - startTime,
        status: 'timeout',
        enhancementsUsed,
        modelType,
        resourceId,
        userId,
        cost
      })
    }
  }
}