import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { prisma } from '@/lib/db'

// System metrics API for monitoring dashboards
export async function GET(request: NextRequest) {
  try {
    // Basic auth check for monitoring endpoints
    const authHeader = request.headers.get('authorization')
    const monitoringToken = process.env.MONITORING_TOKEN
    
    if (monitoringToken && authHeader !== `Bearer ${monitoringToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('range') || '1h' // 1h, 24h, 7d, 30d
    const format = searchParams.get('format') || 'json' // json, prometheus

    const metrics = await collectMetrics(timeRange)

    if (format === 'prometheus') {
      return new Response(formatPrometheusMetrics(metrics), {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    await logger.error('Metrics collection failed', error as Error)
    
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    )
  }
}

async function collectMetrics(timeRange: string) {
  const timeRangeMs = getTimeRangeMs(timeRange)
  const startTime = new Date(Date.now() - timeRangeMs)

  const [
    systemMetrics,
    userMetrics,
    aiMetrics,
    securityMetrics,
    performanceMetrics
  ] = await Promise.all([
    collectSystemMetrics(startTime),
    collectUserMetrics(startTime),
    collectAIMetrics(startTime),
    collectSecurityMetrics(startTime),
    collectPerformanceMetrics(startTime)
  ])

  return {
    system: systemMetrics,
    users: userMetrics,
    ai: aiMetrics,
    security: securityMetrics,
    performance: performanceMetrics,
    range: timeRange,
    collected_at: new Date().toISOString()
  }
}

async function collectSystemMetrics(startTime: Date) {
  const [dbConnections, memoryUsage] = await Promise.all([
    getDatabaseConnections(),
    getMemoryUsage()
  ])

  return {
    database_connections: dbConnections,
    memory_usage_mb: memoryUsage,
    uptime_seconds: Math.floor(process.uptime()),
    node_version: process.version,
    environment: process.env.NODE_ENV
  }
}

async function collectUserMetrics(startTime: Date) {
  const [
    totalUsers,
    activeUsers,
    newUsers,
    usersByPlan
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        updatedAt: { gte: startTime }
      }
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: startTime }
      }
    }),
    prisma.user.groupBy({
      by: ['plan'],
      _count: { plan: true }
    })
  ])

  const planDistribution = usersByPlan.reduce((acc, item) => {
    acc[item.plan.toLowerCase()] = item._count.plan
    return acc
  }, {} as Record<string, number>)

  return {
    total_users: totalUsers,
    active_users: activeUsers,
    new_users: newUsers,
    plan_distribution: planDistribution
  }
}

async function collectAIMetrics(startTime: Date) {
  const [
    totalModels,
    totalGenerations,
    completedGenerations,
    failedGenerations,
    avgGenerationTime
  ] = await Promise.all([
    prisma.aIModel.count(),
    prisma.generation.count({
      where: { createdAt: { gte: startTime } }
    }),
    prisma.generation.count({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startTime }
      }
    }),
    prisma.generation.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: startTime }
      }
    }),
    getAverageGenerationTime(startTime)
  ])

  const successRate = totalGenerations > 0 
    ? Math.round((completedGenerations / totalGenerations) * 100)
    : 0

  return {
    total_models: totalModels,
    total_generations: totalGenerations,
    completed_generations: completedGenerations,
    failed_generations: failedGenerations,
    success_rate_percent: successRate,
    average_generation_time_ms: avgGenerationTime
  }
}

async function collectSecurityMetrics(startTime: Date) {
  // TODO: Implement security metrics when proper models are added
  // For now, return placeholder values
  return {
    content_violations: 0,
    rate_limit_violations: 0,
    banned_users: 0,
    blocked_requests: 0
  }
}

async function collectPerformanceMetrics(startTime: Date) {
  // TODO: Implement performance metrics when proper logging models are added
  const [
    avgResponseTime,
    slowRequests
  ] = await Promise.all([
    getAverageResponseTime(startTime),
    getSlowRequestsCount(startTime)
  ])

  return {
    // @ts-ignore - systemLog will be available after running migration and prisma generate
    error_count: await prisma.systemLog.count({
      where: {
        level: { in: ['error', 'fatal'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    }),
    average_response_time_ms: avgResponseTime,
    slow_requests: slowRequests
  }
}

async function getDatabaseConnections(): Promise<number> {
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

function getMemoryUsage(): number {
  const usage = process.memoryUsage()
  return Math.round(usage.heapUsed / 1024 / 1024) // MB
}

async function getAverageGenerationTime(startTime: Date): Promise<number> {
  try {
    const result = await prisma.generation.aggregate({
      where: {
        status: 'COMPLETED',
        processingTime: { not: null },
        createdAt: { gte: startTime }
      },
      _avg: { processingTime: true }
    })
    return Math.round(result._avg.processingTime || 0)
  } catch (error) {
    return 0
  }
}

async function getBlockedRequestsCount(startTime: Date): Promise<number> {
  // This would come from your rate limiting logs or security logs
  return 0
}

async function getAverageResponseTime(startTime: Date): Promise<number> {
  // This would come from your request logs
  return 0
}

async function getSlowRequestsCount(startTime: Date): Promise<number> {
  // Requests taking more than 5 seconds
  return 0
}

function getTimeRangeMs(range: string): number {
  switch (range) {
    case '1h': return 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    default: return 60 * 60 * 1000
  }
}

function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = []
  
  // System metrics
  lines.push(`# HELP ensaio_fotos_database_connections Active database connections`)
  lines.push(`# TYPE ensaio_fotos_database_connections gauge`)
  lines.push(`ensaio_fotos_database_connections ${metrics.system.database_connections}`)
  
  lines.push(`# HELP ensaio_fotos_memory_usage_mb Memory usage in megabytes`)
  lines.push(`# TYPE ensaio_fotos_memory_usage_mb gauge`)
  lines.push(`ensaio_fotos_memory_usage_mb ${metrics.system.memory_usage_mb}`)
  
  lines.push(`# HELP ensaio_fotos_uptime_seconds Application uptime in seconds`)
  lines.push(`# TYPE ensaio_fotos_uptime_seconds counter`)
  lines.push(`ensaio_fotos_uptime_seconds ${metrics.system.uptime_seconds}`)
  
  // User metrics
  lines.push(`# HELP ensaio_fotos_total_users Total number of users`)
  lines.push(`# TYPE ensaio_fotos_total_users gauge`)
  lines.push(`ensaio_fotos_total_users ${metrics.users.total_users}`)
  
  lines.push(`# HELP ensaio_fotos_active_users Active users in time range`)
  lines.push(`# TYPE ensaio_fotos_active_users gauge`)
  lines.push(`ensaio_fotos_active_users ${metrics.users.active_users}`)
  
  // AI metrics
  lines.push(`# HELP ensaio_fotos_total_generations Total generations`)
  lines.push(`# TYPE ensaio_fotos_total_generations counter`)
  lines.push(`ensaio_fotos_total_generations ${metrics.ai.total_generations}`)
  
  lines.push(`# HELP ensaio_fotos_generation_success_rate Generation success rate percentage`)
  lines.push(`# TYPE ensaio_fotos_generation_success_rate gauge`)
  lines.push(`ensaio_fotos_generation_success_rate ${metrics.ai.success_rate_percent}`)
  
  // Security metrics
  lines.push(`# HELP ensaio_fotos_content_violations Content policy violations`)
  lines.push(`# TYPE ensaio_fotos_content_violations counter`)
  lines.push(`ensaio_fotos_content_violations ${metrics.security.content_violations}`)
  
  lines.push(`# HELP ensaio_fotos_banned_users Number of banned users`)
  lines.push(`# TYPE ensaio_fotos_banned_users gauge`)
  lines.push(`ensaio_fotos_banned_users ${metrics.security.banned_users}`)
  
  return lines.join('\n') + '\n'
}