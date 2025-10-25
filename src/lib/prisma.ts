import { PrismaClient } from '@prisma/client'

// Force serverless reconnection on cold starts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure database URL for serverless environments (Vercel)
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) throw new Error('DATABASE_URL is not defined')

  // Check if running in serverless environment (Vercel, AWS Lambda, etc)
  const isServerless = !!(
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL_ENV // Additional Vercel check
  )

  // ALWAYS apply in production/serverless to prevent prepared statement errors
  if (isServerless || process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(baseUrl)

      // Only add params if not already using a pooler (like Neon, Supabase, etc)
      if (!baseUrl.includes('pooler') && !baseUrl.includes('pgbouncer')) {
        // Clear ALL existing parameters to avoid conflicts
        url.search = ''

        // Critical: pgbouncer=true prevents prepared statement conflicts in serverless
        url.searchParams.set('pgbouncer', 'true')
        url.searchParams.set('connection_limit', '1')
        url.searchParams.set('pool_timeout', '0')

        // Add sslmode if database requires it
        url.searchParams.set('sslmode', 'require')

        const finalUrl = url.toString()
        console.log('[Prisma] Using pgbouncer mode for serverless:', finalUrl.replace(/:[^:@]+@/, ':***@'))
        return finalUrl
      }
    } catch (error) {
      console.error('[Prisma] Error parsing DATABASE_URL:', error)
      return baseUrl
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

// Force disconnect on module reload to prevent stale connections
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}