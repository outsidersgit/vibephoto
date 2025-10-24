import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
}

/**
 * Retry a database operation with exponential backoff
 * Handles common database connection issues gracefully
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, backoffMultiplier } = { 
    ...DEFAULT_RETRY_OPTIONS, 
    ...options 
  }

  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries!; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Don't retry on certain error types
      if (error instanceof PrismaClientKnownRequestError) {
        // P1001: Can't reach database server
        // P1017: Server has closed the connection
        // P2002: Unique constraint violation (shouldn't retry)
        // P2025: Record not found (shouldn't retry)
        const shouldRetry = ['P1001', 'P1017'].includes(error.code)
        
        if (!shouldRetry || attempt === maxRetries) {
          throw error
        }
      } else {
        // For unknown errors, only retry if we have attempts left
        if (attempt === maxRetries) {
          throw error
        }
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay! * Math.pow(backoffMultiplier!, attempt),
        maxDelay!
      )
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000
      
      console.warn(
        `Database operation failed (attempt ${attempt + 1}/${maxRetries! + 1}), retrying in ${Math.round(jitteredDelay)}ms:`,
        (error as Error).message
      )
      
      await new Promise(resolve => setTimeout(resolve, jitteredDelay!))
    }
  }
  
  throw lastError
}

/**
 * Execute multiple database operations with retry logic
 * Returns results with success/failure status for each operation
 */
export async function withBatchRetry<T>(
  operations: (() => Promise<T>)[],
  options: RetryOptions = {}
): Promise<Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: any }>> {
  const promises = operations.map(operation => 
    withRetry(operation, options)
      .then(value => ({ status: 'fulfilled' as const, value }))
      .catch(reason => ({ status: 'rejected' as const, reason }))
  )
  
  return Promise.all(promises)
}

/**
 * Check if error is a connection-related issue that might be temporary
 */
export function isConnectionError(error: any): boolean {
  if (error instanceof PrismaClientKnownRequestError) {
    // Connection-related error codes
    return ['P1001', 'P1017', 'P1008', 'P1010'].includes(error.code)
  }
  
  // Check for common connection error patterns
  const errorMessage = error?.message?.toLowerCase() || ''
  return (
    errorMessage.includes('can\'t reach database server') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network')
  )
}

/**
 * Gracefully handle database connection issues
 * Returns default value on connection errors, throws on other errors
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    return await withRetry(operation)
  } catch (error) {
    if (isConnectionError(error)) {
      console.warn('Database connection issue, using fallback value:', (error as Error).message)
      return fallbackValue
    }
    throw error
  }
}

/**
 * Create a circuit breaker for database operations
 * Prevents cascade failures by failing fast when database is down
 */
class DatabaseCircuitBreaker {
  private failures: number = 0
  private lastFailure: number = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 30000 // 30 seconds
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN - database operations are being blocked')
      }
      this.state = 'half-open'
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure() {
    this.failures++
    this.lastFailure = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure
    }
  }
}

export const dbCircuitBreaker = new DatabaseCircuitBreaker()