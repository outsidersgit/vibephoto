import { prisma } from '@/lib/db'
import { withFallback } from '@/lib/db/utils'

export interface UserStats {
  totalModels: number
  totalGenerations: number
  generationsThisMonth: number
  trainingInProgress: number
  weeklyActivity: number
}

/**
 * Busca estatísticas reais do usuário
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    // Data de início do mês atual
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Data de início da semana atual (domingo)
    const startOfWeek = new Date()
    const dayOfWeek = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)

    // Buscar dados em paralelo
    const [
      totalModels,
      totalGenerations, 
      generationsThisMonth,
      trainingInProgress,
      weeklyActivity
    ] = await Promise.allSettled([
      // Total de modelos criados
      withFallback(
        () => prisma.aIModel.count({ where: { userId } }),
        0
      ),

      // Total de gerações
      withFallback(
        () => prisma.generation.count({ where: { userId } }),
        0
      ),

      // Gerações deste mês
      withFallback(
        () => prisma.generation.count({
          where: {
            userId,
            createdAt: { gte: startOfMonth }
          }
        }),
        0
      ),

      // Modelos em treinamento
      withFallback(
        () => prisma.aIModel.count({
          where: {
            userId,
            status: 'TRAINING'
          }
        }),
        0
      ),

      // Atividade semanal (sessões/ações)
      withFallback(
        () => prisma.usageLog.count({
          where: {
            userId,
            createdAt: { gte: startOfWeek }
          }
        }),
        0
      )
    ])

    return {
      totalModels: totalModels.status === 'fulfilled' ? totalModels.value : 0,
      totalGenerations: totalGenerations.status === 'fulfilled' ? totalGenerations.value : 0,
      generationsThisMonth: generationsThisMonth.status === 'fulfilled' ? generationsThisMonth.value : 0,
      trainingInProgress: trainingInProgress.status === 'fulfilled' ? trainingInProgress.value : 0,
      weeklyActivity: weeklyActivity.status === 'fulfilled' ? weeklyActivity.value : 0
    }

  } catch (error) {
    console.error('Erro ao buscar estatísticas do usuário:', error)
    // Retorna valores zerados em caso de erro
    return {
      totalModels: 0,
      totalGenerations: 0,
      generationsThisMonth: 0,
      trainingInProgress: 0,
      weeklyActivity: 0
    }
  }
}

/**
 * Busca o progresso mensal do usuário (percentual de uso de créditos)
 */
export async function getMonthlyProgress(userId: string) {
  try {
    const user = await withFallback(
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          plan: true
        }
      }),
      null
    )

    if (!user) {
      return { percentage: 0, used: 0, total: 10 }
    }

    const used = user.creditsUsed || 0
    const total = user.creditsLimit || 10
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0

    return { percentage, used, total }
  } catch (error) {
    console.error('Erro ao buscar progresso mensal:', error)
    return { percentage: 0, used: 0, total: 10 }
  }
}

/**
 * Busca informações do último projeto/modelo
 */
export async function getLastProject(userId: string) {
  try {
    const lastModel = await withFallback(
      () => prisma.aIModel.findFirst({
        where: {
          userId,
          status: 'READY'
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      }),
      null
    )

    return lastModel
  } catch (error) {
    console.error('Erro ao buscar último projeto:', error)
    return null
  }
}