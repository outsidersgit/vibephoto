import { prisma } from '@/lib/db'

export interface CreateEditHistoryData {
  userId: string
  originalImageUrl: string
  editedImageUrl: string
  thumbnailUrl?: string
  operation: string
  prompt: string
  metadata?: any
}

export interface EditHistoryFilters {
  operation?: string
  search?: string
}

/**
 * Create a new edit history entry
 */
export async function createEditHistory(data: CreateEditHistoryData) {
  return prisma.editHistory.create({
    data: {
      userId: data.userId,
      originalImageUrl: data.originalImageUrl,
      editedImageUrl: data.editedImageUrl,
      thumbnailUrl: data.thumbnailUrl,
      operation: data.operation,
      prompt: data.prompt,
      metadata: data.metadata || {}
    }
  })
}

/**
 * Get edit history entries for a user with pagination
 */
export async function getEditHistoryByUserId(
  userId: string,
  page = 1,
  limit = 20,
  filters?: EditHistoryFilters
) {
  const skip = (page - 1) * limit

  // Build where clause
  const where: any = { userId }

  if (filters?.operation) {
    where.operation = filters.operation
  }

  if (filters?.search) {
    where.prompt = {
      contains: filters.search,
      mode: 'insensitive'
    }
  }

  const [editHistory, total] = await Promise.all([
    prisma.editHistory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    }),
    prisma.editHistory.count({ where })
  ])

  return {
    editHistory,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    totalCount: total
  }
}

/**
 * Search edit history entries by prompt
 */
export async function searchEditHistory(
  userId: string,
  searchQuery: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit

  const where = {
    userId,
    prompt: {
      contains: searchQuery,
      mode: 'insensitive' as const
    }
  }

  const [editHistory, total] = await Promise.all([
    prisma.editHistory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    }),
    prisma.editHistory.count({ where })
  ])

  return {
    editHistory,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    totalCount: total
  }
}

/**
 * Get edit history by ID
 */
export async function getEditHistoryById(id: string) {
  return prisma.editHistory.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  })
}

/**
 * Delete edit history entry
 */
export async function deleteEditHistory(id: string, userId: string) {
  return prisma.editHistory.delete({
    where: {
      id,
      userId // Ensure user can only delete their own entries
    }
  })
}

/**
 * Get edit history stats for a user
 */
export async function getEditHistoryStats(userId: string) {
  const [
    totalEdits,
    recentEdits,
    operationStats
  ] = await Promise.all([
    // Total edit count
    prisma.editHistory.count({
      where: { userId }
    }),
    // Recent edits (last 7 days)
    prisma.editHistory.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    // Count by operation type
    prisma.editHistory.groupBy({
      by: ['operation'],
      where: { userId },
      _count: {
        operation: true
      }
    })
  ])

  const operationCounts = operationStats.reduce((acc, stat) => {
    acc[stat.operation] = stat._count.operation
    return acc
  }, {} as Record<string, number>)

  return {
    totalEdits,
    recentEdits,
    operationCounts
  }
}

/**
 * Get recent edit history entries (for dashboard/widgets)
 */
export async function getRecentEditHistory(userId: string, limit = 5) {
  return prisma.editHistory.findMany({
    where: { userId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      editedImageUrl: true,
      thumbnailUrl: true,
      operation: true,
      prompt: true,
      createdAt: true
    }
  })
}