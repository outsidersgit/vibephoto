import { prisma } from '@/lib/db'
import { withRetry, withFallback, dbCircuitBreaker } from '@/lib/db/utils'

/**
 * Health check for database connectivity
 * Returns status and detailed information about database connection
 */
export async function checkDatabaseHealth() {
  const startTime = Date.now()
  
  try {
    // Simple connectivity test
    const result = await withRetry(
      () => dbCircuitBreaker.execute(() => 
        prisma.$queryRaw`SELECT 1 as health`
      ),
      { maxRetries: 2, baseDelay: 1000 }
    )
    
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      connected: true,
      responseTime,
      circuitBreaker: dbCircuitBreaker.getState(),
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    return {
      status: 'unhealthy',
      connected: false,
      responseTime,
      error: error.message,
      circuitBreaker: dbCircuitBreaker.getState(),
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Test fallback mechanisms
 */
export async function testDatabaseFallbacks() {
  const results: any = {}
  
  // Test user fallback
  try {
    const userResult = await withFallback(
      () => prisma.user.findFirst({ where: { id: 'non-existent' } }),
      null
    )
    results.userFallback = { success: true, value: userResult }
  } catch (error: any) {
    results.userFallback = { success: false, error: error.message }
  }
  
  // Test array fallback
  try {
    const modelsResult = await withFallback(
      () => prisma.aIModel.findMany({ where: { userId: 'non-existent' } }),
      []
    )
    results.arrayFallback = { success: true, value: modelsResult }
  } catch (error: any) {
    results.arrayFallback = { success: false, error: error.message }
  }
  
  // Test count fallback
  try {
    const countResult = await withFallback(
      () => prisma.generation.count({ where: { userId: 'non-existent' } }),
      0
    )
    results.countFallback = { success: true, value: countResult }
  } catch (error: any) {
    results.countFallback = { success: false, error: error.message }
  }
  
  return results
}