import { PrismaClient } from '@prisma/client'

// Force serverless reconnection on cold starts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Log database connection info (masking password)
const logDatabaseConnection = () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[Prisma] DATABASE_URL is not defined')
    return
  }

  try {
    const maskedUrl = url.replace(/:[^:@]+@/, ':***@')
    console.log('[Prisma] Connecting to database:', maskedUrl)
    console.log('[Prisma] Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  } catch (error) {
    console.error('[Prisma] Error logging connection info:', error)
  }
}

// Log connection on startup
if (process.env.NODE_ENV === 'production') {
  logDatabaseConnection()
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'minimal',
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Force disconnect on module reload to prevent stale connections
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    console.log('[Prisma] Disconnecting from database')
    await prisma.$disconnect()
  })
}