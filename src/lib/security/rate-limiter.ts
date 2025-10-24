import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'

export interface RateLimit {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: Date
  retryAfter?: number // seconds
}

export interface RateLimitConfig {
  requests: number
  windowMs: number // window in milliseconds
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export const RATE_LIMITS: Record<string, Record<Plan, RateLimitConfig>> = {
  // API calls gerais
  api: {
    STARTER: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
    PREMIUM: { requests: 500, windowMs: 15 * 60 * 1000 }, // 500 requests per 15 minutes
    GOLD: { requests: 1000, windowMs: 15 * 60 * 1000 } // 1000 requests per 15 minutes
  },
  
  // Upload de arquivos
  upload: {
    STARTER: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 uploads per hour
    PREMIUM: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100 uploads per hour
    GOLD: { requests: 500, windowMs: 60 * 60 * 1000 } // 500 uploads per hour
  },
  
  // Treinamento de modelos
  training: {
    STARTER: { requests: 1, windowMs: 24 * 60 * 60 * 1000 }, // 1 training per day
    PREMIUM: { requests: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 trainings per day
    GOLD: { requests: 20, windowMs: 24 * 60 * 60 * 1000 } // 20 trainings per day
  },
  
  // Geração de imagens
  generation: {
    STARTER: { requests: 10, windowMs: 60 * 60 * 1000 }, // 10 generations per hour
    PREMIUM: { requests: 50, windowMs: 60 * 60 * 1000 }, // 50 generations per hour
    GOLD: { requests: 200, windowMs: 60 * 60 * 1000 } // 200 generations per hour
  },
  
  // Login/Authentication
  auth: {
    STARTER: { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 login attempts per 15 minutes
    PREMIUM: { requests: 5, windowMs: 15 * 60 * 1000 },
    GOLD: { requests: 5, windowMs: 15 * 60 * 1000 }
  }
}

export class RateLimiter {
  static async checkLimit(
    userId: string,
    action: string,
    userPlan: Plan = 'STARTER'
  ): Promise<RateLimit> {
    const config = RATE_LIMITS[action]?.[userPlan]
    
    if (!config) {
      throw new Error(`Rate limit configuration not found for action: ${action}`)
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - config.windowMs)

    // Buscar tentativas recentes
    const recentAttempts = await prisma.usageLog.findMany({
      where: {
        userId,
        action: `rate_limit_${action}`,
        createdAt: {
          gte: windowStart
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const currentCount = recentAttempts.length
    const remaining = Math.max(0, config.requests - currentCount)
    const allowed = currentCount < config.requests

    // Calcular tempo de reset
    const oldestAttempt = recentAttempts[recentAttempts.length - 1]
    const resetTime = oldestAttempt 
      ? new Date(oldestAttempt.createdAt.getTime() + config.windowMs)
      : new Date(now.getTime() + config.windowMs)

    const retryAfter = !allowed 
      ? Math.ceil((resetTime.getTime() - now.getTime()) / 1000)
      : undefined

    return {
      allowed,
      limit: config.requests,
      remaining,
      resetTime,
      retryAfter
    }
  }

  static async recordAttempt(
    userId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.usageLog.create({
        data: {
          userId,
          action: `rate_limit_${action}`,
          details: metadata || {},
          creditsUsed: 0
        }
      })
    } catch (error) {
      console.error('Failed to record rate limit attempt:', error)
    }
  }

  static async cleanupOldLogs(): Promise<void> {
    // Limpar logs antigos (mais de 7 dias)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    try {
      await prisma.usageLog.deleteMany({
        where: {
          action: {
            startsWith: 'rate_limit_'
          },
          createdAt: {
            lt: sevenDaysAgo
          }
        }
      })
    } catch (error) {
      console.error('Failed to cleanup old rate limit logs:', error)
    }
  }

  static async getUsageStats(
    userId: string,
    action?: string
  ): Promise<Record<string, {
    current: number
    limit: number
    resetTime: Date
  }>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    })

    const userPlan = user?.plan || 'STARTER'
    const actions = action ? [action] : Object.keys(RATE_LIMITS)
    const stats: Record<string, any> = {}

    for (const actionKey of actions) {
      const limit = await this.checkLimit(userId, actionKey, userPlan)
      stats[actionKey] = {
        current: limit.limit - limit.remaining,
        limit: limit.limit,
        resetTime: limit.resetTime
      }
    }

    return stats
  }

  static async isUserBlocked(userId: string): Promise<{
    isBlocked: boolean
    reason?: string
    unblockTime?: Date
  }> {
    // Verificar se o usuário está temporariamente bloqueado
    const recentViolations = await prisma.usageLog.count({
      where: {
        userId,
        action: {
          startsWith: 'rate_limit_'
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        },
        details: {
          path: ['violation'],
          equals: true
        }
      }
    })

    // Bloquear usuário se muitas violações recentes
    if (recentViolations >= 10) {
      return {
        isBlocked: true,
        reason: 'Too many rate limit violations',
        unblockTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour block
      }
    }

    // Since status and banReason don't exist, check for excessive violations
    const totalViolations = await prisma.usageLog.count({
      where: {
        userId,
        action: {
          startsWith: 'rate_limit_'
        },
        details: {
          path: ['violation'],
          equals: true
        }
      }
    })

    if (totalViolations >= 50) {
      return {
        isBlocked: true,
        reason: 'Account suspended due to excessive rate limit violations'
      }
    }

    return { isBlocked: false }
  }

  static async getSystemStats(): Promise<{
    totalRequests: number
    violatedRequests: number
    topUsers: Array<{ userId: string; count: number }>
    topActions: Array<{ action: string; count: number }>
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalRequests,
      violatedRequests,
      userStats,
      actionStats
    ] = await Promise.all([
      prisma.usageLog.count({
        where: {
          action: { startsWith: 'rate_limit_' },
          createdAt: { gte: oneDayAgo }
        }
      }),
      prisma.usageLog.count({
        where: {
          action: { startsWith: 'rate_limit_' },
          createdAt: { gte: oneDayAgo },
          details: {
            path: ['violation'],
            equals: true
          }
        }
      }),
      prisma.usageLog.groupBy({
        by: ['userId'],
        _count: { userId: true },
        where: {
          action: { startsWith: 'rate_limit_' },
          createdAt: { gte: oneDayAgo }
        },
        orderBy: {
          _count: { userId: 'desc' }
        },
        take: 10
      }),
      prisma.usageLog.groupBy({
        by: ['action'],
        _count: { action: true },
        where: {
          action: { startsWith: 'rate_limit_' },
          createdAt: { gte: oneDayAgo }
        },
        orderBy: {
          _count: { action: 'desc' }
        },
        take: 10
      })
    ])

    return {
      totalRequests,
      violatedRequests,
      topUsers: userStats.map(stat => ({
        userId: stat.userId,
        count: stat._count.userId
      })),
      topActions: actionStats.map(stat => ({
        action: stat.action,
        count: stat._count.action
      }))
    }
  }
}