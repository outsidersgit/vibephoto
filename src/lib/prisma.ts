import { PrismaClient } from '@prisma/client'

// Force serverless reconnection on cold starts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure database URL for serverless environments (Vercel)
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) throw new Error('DATABASE_URL is not defined')

  // Check if running in serverless environment (Vercel)
  const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME

  // In serverless OR development, configure for connection pooling
  if (isServerless || process.env.NODE_ENV === 'development') {
    const url = new URL(baseUrl)

    // Only add params if not already using a pooler (like Neon, Supabase, etc)
    if (!baseUrl.includes('pooler') && !baseUrl.includes('pgbouncer')) {
      // Clear any existing parameters that might conflict
      url.search = ''

      // Critical: pgbouncer=true prevents prepared statement conflicts in serverless
      url.searchParams.set('pgbouncer', 'true')
      url.searchParams.set('connection_limit', '1')
      url.searchParams.set('pool_timeout', '0')

      // SSL mode
      if (!url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require')
      }

      return url.toString()
    }
  }

  return baseUrl
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma