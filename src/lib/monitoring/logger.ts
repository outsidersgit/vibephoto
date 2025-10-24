import { prisma } from '@/lib/db'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  userId?: string
  requestId?: string
  metadata?: Record<string, any>
  stack?: string
}

export interface SystemMetrics {
  memory_usage: number
  cpu_usage: number
  disk_usage: number
  database_connections: number
  active_users: number
  api_calls_per_minute: number
  error_rate: number
}

class Logger {
  private static instance: Logger
  private requestId: string | null = null

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setRequestId(requestId: string) {
    this.requestId = requestId
  }

  clearRequestId() {
    this.requestId = null
  }

  async log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error) {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      requestId: this.requestId || undefined,
      metadata: metadata || {},
      stack: error?.stack
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      this.consoleLog(logEntry)
    }

    // Database logging for production
    if (process.env.NODE_ENV === 'production') {
      await this.databaseLog(logEntry)
    }

    // External service logging (Sentry, etc.)
    await this.externalLog(logEntry, error)
  }

  private consoleLog(entry: LogEntry) {
    const timestamp = entry.timestamp.toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.metadata)
        break
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.metadata)
        break
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.metadata)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.metadata, entry.stack)
        break
    }
  }

  private async databaseLog(entry: LogEntry) {
    try {
      // Log to SystemLog model
      // @ts-ignore - systemLog will be available after running migration and prisma generate
      await prisma.systemLog.create({
        data: {
          level: entry.level,
          message: entry.message,
          userId: entry.userId || undefined,
          requestId: entry.requestId || undefined,
          metadata: entry.metadata || undefined,
          stack: entry.stack || undefined
        }
      })
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to log to database:', error)
      this.consoleLog(entry)
    }
  }

  private async externalLog(entry: LogEntry, error?: Error) {
    // Sentry integration
    if (process.env.SENTRY_DSN && (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL)) {
      try {
        // In a real implementation, you would import and use Sentry here
        // const Sentry = require('@sentry/nextjs')
        // Sentry.captureException(error || new Error(entry.message), {
        //   level: entry.level,
        //   extra: entry.metadata,
        //   user: { id: entry.userId }
        // })
      } catch (err) {
        console.error('Failed to log to Sentry:', err)
      }
    }

    // Custom webhook logging
    if (process.env.LOG_WEBHOOK_URL && entry.level === LogLevel.ERROR) {
      try {
        await fetch(process.env.LOG_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entry)
        })
      } catch (err) {
        console.error('Failed to send webhook log:', err)
      }
    }
  }

  // Convenience methods
  async debug(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.DEBUG, message, metadata)
  }

  async info(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.INFO, message, metadata)
  }

  async warn(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.WARN, message, metadata)
  }

  async error(message: string, error?: Error, metadata?: Record<string, any>) {
    await this.log(LogLevel.ERROR, message, metadata, error)
  }

  async fatal(message: string, error?: Error, metadata?: Record<string, any>) {
    await this.log(LogLevel.FATAL, message, metadata, error)
  }

  // System metrics collection
  async collectMetrics(): Promise<SystemMetrics> {
    try {
      const [
        memoryUsage,
        dbConnections,
        activeUsers,
        recentLogs
      ] = await Promise.all([
        this.getMemoryUsage(),
        this.getDatabaseConnections(),
        this.getActiveUsers(),
        this.getRecentErrorLogs()
      ])

      const apiCalls = await this.getAPICallsPerMinute()
      const errorRate = await this.calculateErrorRate(recentLogs)

      return {
        memory_usage: memoryUsage,
        cpu_usage: await this.getCPUUsage(),
        disk_usage: await this.getDiskUsage(),
        database_connections: dbConnections,
        active_users: activeUsers,
        api_calls_per_minute: apiCalls,
        error_rate: errorRate
      }
    } catch (error) {
      await this.error('Failed to collect system metrics', error as Error)
      return {
        memory_usage: 0,
        cpu_usage: 0,
        disk_usage: 0,
        database_connections: 0,
        active_users: 0,
        api_calls_per_minute: 0,
        error_rate: 0
      }
    }
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage()
    return Math.round((usage.heapUsed / usage.heapTotal) * 100)
  }

  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage estimation
    const startUsage = process.cpuUsage()
    await new Promise(resolve => setTimeout(resolve, 100))
    const endUsage = process.cpuUsage(startUsage)
    
    const totalUsage = endUsage.user + endUsage.system
    return Math.round((totalUsage / 100000) * 100) / 100 // Convert to percentage
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const fs = await import('fs/promises')
      const stats = await fs.stat(process.cwd())
      // This is a simplified implementation
      // In production, you'd want to check actual disk space
      return 0
    } catch (error) {
      return 0
    }
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `
      return Number(result[0]?.count || 0)
    } catch (error) {
      return 0
    }
  }

  private async getActiveUsers(): Promise<number> {
    try {
      // Since lastLoginAt doesn't exist, estimate based on recent activity
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
      const count = await prisma.user.count({
        where: {
          generations: {
            some: {
              createdAt: {
                gte: fifteenMinutesAgo
              }
            }
          }
        }
      })
      return count
    } catch (error) {
      return 0
    }
  }

  private async getAPICallsPerMinute(): Promise<number> {
    try {
      // Since rateLimitLog doesn't exist, estimate based on generation/training actions
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
      const count = await prisma.usageLog.count({
        where: {
          action: {
            in: ['generation', 'training']
          },
          createdAt: {
            gte: oneMinuteAgo
          }
        }
      })
      return count
    } catch (error) {
      return 0
    }
  }

  private async getRecentErrorLogs(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const count = await prisma.usageLog.count({
        where: {
          action: 'system_error',
          createdAt: {
            gte: oneHourAgo
          }
        }
      })
      return count
    } catch (error) {
      return 0
    }
  }

  private async calculateErrorRate(errorCount: number): Promise<number> {
    try {
      // Since we don't have a comprehensive log system anymore,
      // we'll estimate based on error logs vs total system actions
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const totalSystemActions = await prisma.usageLog.count({
        where: {
          createdAt: {
            gte: oneHourAgo
          }
        }
      })
      
      return totalSystemActions > 0 ? Math.round((errorCount / totalSystemActions) * 100) : 0
    } catch (error) {
      return 0
    }
  }

  // Cleanup old logs
  async cleanupOldLogs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      // Clean up old system error logs from usageLog
      await prisma.usageLog.deleteMany({
        where: {
          action: 'system_error',
          createdAt: {
            lt: thirtyDaysAgo
          }
        }
      })

      await this.info('Cleaned up old system error logs', { cutoff: thirtyDaysAgo })
    } catch (error) {
      await this.error('Failed to cleanup old logs', error as Error)
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Middleware helper for request logging
export function withRequestLogging<T extends (...args: any[]) => any>(
  fn: T,
  operation: string
): T {
  return (async (...args: any[]) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.setRequestId(requestId)
    
    const startTime = Date.now()
    
    try {
      await logger.info(`${operation} started`, { requestId })
      const result = await fn(...args)
      
      const duration = Date.now() - startTime
      await logger.info(`${operation} completed`, { requestId, duration })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      await logger.error(`${operation} failed`, error as Error, { requestId, duration })
      throw error
    } finally {
      logger.clearRequestId()
    }
  }) as T
}