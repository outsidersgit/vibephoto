import { NextRequest, NextResponse } from 'next/server'
import { checkDatabaseHealth, testDatabaseFallbacks } from '@/lib/db/health-check'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testFallbacks = searchParams.get('test-fallbacks') === 'true'
    
    const health = await checkDatabaseHealth()
    
    let fallbackTests = null
    if (testFallbacks) {
      fallbackTests = await testDatabaseFallbacks()
    }
    
    return NextResponse.json({
      database: health,
      fallbacks: fallbackTests,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
      }
    }, { 
      status: health.connected ? 200 : 503
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { 
      status: 500 
    })
  }
}