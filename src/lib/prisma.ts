import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure database URL with definitive solution for development
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) throw new Error('DATABASE_URL is not defined')

  // In development, use session mode to avoid prepared statement conflicts entirely
  if (process.env.NODE_ENV === 'development') {
    const url = new URL(baseUrl)

    // Clear any existing parameters that might conflict
    url.search = ''

    // Use transaction mode instead of session mode for better compatibility
    url.searchParams.set('pgbouncer', 'true')
    url.searchParams.set('connection_limit', '1')
    url.searchParams.set('pool_timeout', '0') // Disable connection pooling
    url.searchParams.set('sslmode', 'require')

    return url.toString()
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