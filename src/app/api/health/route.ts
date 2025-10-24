import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getConnectionStats } from '@/app/api/events/stream/route'

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  checks: {
    database: boolean
    filesystem: boolean
    ai_providers: boolean
    storage: boolean
    payment: boolean
  }
  metrics: {
    uptime: number
    memory_usage: number
    database_connections: number
    response_time: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const checks = {
      database: await checkDatabase(),
      filesystem: await checkFilesystem(),
      ai_providers: await checkAIProviders(),
      storage: await checkStorage(),
      payment: await checkPayment()
    }

    // Get WebSocket connection stats
    const connectionStats = getConnectionStats()

    // Check recent webhook activity (temporarily disabled due to prepared statement issues)
    const recentGenerations = 0 // await prisma.generation.count()

    const allHealthy = Object.values(checks).every(check => check === true)
    const someHealthy = Object.values(checks).some(check => check === true)

    const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy'
    const responseTime = Date.now() - startTime

    const healthCheck: HealthCheck = {
      status,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        database_connections: await getDatabaseConnections(),
        response_time: responseTime
      }
    }

    // Add webhook system specific info
    const webhookHealthCheck = {
      ...healthCheck,
      system: {
        type: 'webhook-driven',
        pollingDisabled: true,
        eventDriven: true
      },
      websocket: {
        enabled: true,
        totalConnections: connectionStats.totalConnections,
        avgUptime: connectionStats.avgUptime,
        activeUsers: connectionStats.connectionsByUser.size
      },
      webhook: {
        configured: !!process.env.REPLICATE_WEBHOOK_SECRET,
        recentActivity: recentGenerations,
        endpoint: '/api/webhooks/replicate',
        secured: !!process.env.REPLICATE_WEBHOOK_SECRET
      }
    }

    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 207 : 503

    return NextResponse.json(webhookHealthCheck, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      response_time: Date.now() - startTime
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    })
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Simple connection test without prepared statements
    await prisma.$connect()
    await prisma.$disconnect()
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

async function checkFilesystem(): Promise<boolean> {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const testPath = path.join(process.cwd(), 'tmp')
    const testFile = path.join(testPath, 'health-check.txt')
    
    // Ensure tmp directory exists
    try {
      await fs.mkdir(testPath, { recursive: true })
    } catch (err) {
      // Directory might already exist
    }
    
    // Test write
    await fs.writeFile(testFile, 'health-check')
    
    // Test read
    const content = await fs.readFile(testFile, 'utf-8')
    
    // Cleanup
    await fs.unlink(testFile)
    
    return content === 'health-check'
  } catch (error) {
    console.error('Filesystem health check failed:', error)
    return false
  }
}

async function checkAIProviders(): Promise<boolean> {
  try {
    // Test AI provider connectivity
    const aiProvider = process.env.AI_PROVIDER || 'local'
    
    switch (aiProvider) {
      case 'replicate':
        return await checkReplicate()
      case 'runpod':
        return await checkRunPod()
      case 'local':
        return true // Local provider is always available
      default:
        return true
    }
  } catch (error) {
    console.error('AI providers health check failed:', error)
    return false
  }
}

async function checkReplicate(): Promise<boolean> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) return false
    
    const response = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
      }
    })
    
    return response.ok
  } catch (error) {
    return false
  }
}

async function checkRunPod(): Promise<boolean> {
  try {
    if (!process.env.RUNPOD_API_KEY) return false
    
    const response = await fetch('https://api.runpod.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        query: 'query { myself { id } }'
      })
    })
    
    return response.ok
  } catch (error) {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    const storageProvider = process.env.STORAGE_PROVIDER || 'local'
    
    switch (storageProvider) {
      case 'aws':
        return await checkAWS()
      case 'cloudinary':
        return await checkCloudinary()
      case 'local':
        return true // Local storage is always available
      default:
        return true
    }
  } catch (error) {
    console.error('Storage health check failed:', error)
    return false
  }
}

async function checkAWS(): Promise<boolean> {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return false
    }
    
    // Test AWS S3 connectivity with a simple head bucket operation
    const response = await fetch(`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`, {
      method: 'HEAD'
    })
    
    return response.status !== 500 // 403 is ok (no public access), 500 is server error
  } catch (error) {
    return false
  }
}

async function checkCloudinary(): Promise<boolean> {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return false
    }
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/usage`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64')}`
      }
    })
    
    return response.ok
  } catch (error) {
    return false
  }
}

async function checkPayment(): Promise<boolean> {
  try {
    if (!process.env.ASAAS_API_KEY) return false
    
    const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
      ? 'https://www.asaas.com'
      : 'https://sandbox.asaas.com'
    
    const response = await fetch(`${baseUrl}/api/v3/myAccount`, {
      headers: {
        'access_token': process.env.ASAAS_API_KEY
      }
    })
    
    return response.ok
  } catch (error) {
    return false
  }
}

async function getDatabaseConnections(): Promise<number> {
  try {
    // Temporarily return 0 to avoid prepared statement issues
    return 0
  } catch (error) {
    return 0
  }
}