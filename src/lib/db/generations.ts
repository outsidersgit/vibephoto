import { prisma } from '@/lib/db'
import { Prisma, GenerationStatus } from '@prisma/client'
import { CreditManager } from '@/lib/credits/manager'
import { getImageGenerationCost } from '@/lib/credits/pricing'

export interface GenerationBatchParams {
  userId: string
  limit?: number
  page?: number
  modelId?: string
  searchQuery?: string
  sortBy?: 'newest' | 'oldest'
  includePackages?: boolean
}

export interface GenerationBatchResult {
  items: any[]
  page: number
  totalPages: number
  hasMore: boolean
  totalCount: number
}

export async function fetchGenerationBatch({
  userId,
  limit = 24,
  page: requestedPage,
  modelId,
  searchQuery,
  sortBy = 'newest',
  includePackages = false
}: GenerationBatchParams): Promise<GenerationBatchResult> {
  const page = Math.max(requestedPage ?? 1, 1)
  const skip = (page - 1) * limit

  const where: Prisma.GenerationWhereInput = {
    userId,
    status: GenerationStatus.COMPLETED,
    ...(includePackages ? { packageId: { not: null } } : { packageId: null }),
    ...(modelId && { modelId }),
    ...(searchQuery && {
      prompt: { contains: searchQuery, mode: 'insensitive' }
    })
  }

  const orderBy: Prisma.GenerationOrderByWithRelationInput[] =
    sortBy === 'oldest' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }]

  const queryArgs: Prisma.GenerationFindManyArgs = {
    where,
    orderBy,
    skip,
    take: limit,
    include: {
      model: {
        select: { id: true, name: true, class: true }
      },
      userPackage: includePackages
        ? {
            include: {
              package: true
            }
          }
        : undefined
    }
  }

  const results = await prisma.generation.findMany(queryArgs)
  const totalCount = await prisma.generation.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const hasMore = page < totalPages

  return {
    items: results,
    page,
    totalPages,
    hasMore,
    totalCount
  }
}

export async function createGeneration(data: {
  userId: string
  modelId: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  resolution?: string
  variations?: number
  strength?: number
  seed?: number
  style?: string
  aiProvider?: string
  astriaEnhancements?: any
}) {
  // Calculate credits needed (10 credits per image, variations determines how many images)
  const creditsNeeded = getImageGenerationCost(data.variations || 1)

  // Start transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Create the generation (credits will be debited after creation using same transaction)
    const generation = await tx.generation.create({
      data: {
        ...data,
        status: GenerationStatus.PENDING,
        imageUrls: [],
        thumbnailUrls: [],
        estimatedCost: creditsNeeded,
        operationType: 'generation',
        metadata: {
          source: 'generation',
          variations: data.variations || 1,
          prompt: data.prompt,
          aiProvider: data.aiProvider || 'hybrid'
        },
        // Set AI provider based on current configuration
        aiProvider: data.aiProvider || 'hybrid',
        astriaEnhancements: data.astriaEnhancements
      },
      include: {
        model: {
          select: { id: true, name: true, class: true }
        }
      }
    })

    const chargeResult = await CreditManager.deductCredits(
      data.userId,
      creditsNeeded,
      'Geração de imagem',
      {
        type: 'IMAGE_GENERATION',
        generationId: generation.id,
        prompt: data.prompt,
        variations: data.variations,
        resolution: data.resolution
      },
      tx
    )

    if (!chargeResult.success) {
      throw new Error(chargeResult.error || 'Failed to deduct credits')
    }

    await tx.usageLog.create({
      data: {
        userId: data.userId,
        action: 'generation',
        details: {
          generationId: generation.id,
          modelId: data.modelId,
          variations: data.variations,
          resolution: data.resolution
        },
        creditsUsed: creditsNeeded
      }
    })

    return generation
  })
}

export async function getGenerationsByUserId(
  userId: string,
  page = 1,
  limit = 20,
  modelId?: string,
  status?: string
) {
  const skip = (page - 1) * limit
  const where = {
    userId,
    ...(modelId && { modelId }),
    ...(status && { status })
  }
  
  const [generations, total] = await Promise.all([
    prisma.generation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        model: {
          select: { id: true, name: true, class: true }
        }
      }
    }),
    prisma.generation.count({ where })
  ])
  
  return {
    generations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
}

export async function getGenerationById(id: string, userId?: string) {
  const where = userId ? { id, userId } : { id }
  
  return prisma.generation.findUnique({
    where,
    include: {
      model: {
        select: { id: true, name: true, class: true }
      },
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  })
}

export async function updateGenerationStatus(
  generationId: string,
  status: GenerationStatus,
  imageUrls?: string[],
  thumbnailUrls?: string[],
  errorMessage?: string,
  processingTime?: number
) {
  return prisma.generation.update({
    where: { id: generationId },
    data: {
      status,
      imageUrls: imageUrls ?? undefined,
      thumbnailUrls: thumbnailUrls ?? undefined,
      errorMessage,
      processingTime,
      completedAt: status === GenerationStatus.COMPLETED ? new Date() : undefined
    }
  })
}

export async function deleteGeneration(generationId: string, userId: string) {
  // First verify ownership
  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId
    }
  })

  if (!generation) {
    throw new Error('Generation not found or access denied')
  }

  // Delete the generation
  return prisma.generation.delete({
    where: {
      id: generationId
    }
  })
}

export async function getRecentGenerations(userId: string, limit = 5) {
  return prisma.generation.findMany({
    where: {
      userId,
      status: GenerationStatus.COMPLETED
    },
    take: limit,
    orderBy: { completedAt: 'desc' },
    include: {
      model: {
        select: { id: true, name: true, class: true }
      }
    }
  })
}

export async function getGenerationStats(userId: string) {
  const [total, completed, failed, pending] = await Promise.all([
    prisma.generation.count({
      where: { userId }
    }),
    prisma.generation.count({
      where: { userId, status: GenerationStatus.COMPLETED }
    }),
    prisma.generation.count({
      where: { userId, status: GenerationStatus.FAILED }
    }),
    prisma.generation.count({
      where: { 
        userId, 
        status: { in: [GenerationStatus.PENDING, GenerationStatus.PROCESSING] }
      }
    })
  ])
  
  const averageProcessingTime = await prisma.generation.aggregate({
    where: {
      userId,
      processingTime: { not: null }
    },
    _avg: {
      processingTime: true
    }
  })
  
  return {
    total,
    completed,
    failed,
    pending,
    averageProcessingTime: averageProcessingTime._avg.processingTime || 0
  }
}

export async function toggleGenerationFavoriteImage(
  userId: string,
  generationId: string,
  imageUrl: string,
  favorite?: boolean
): Promise<string[]> {
  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId
    },
    select: {
      metadata: true
    }
  })

  if (!generation) {
    throw new Error('Generation not found or access denied')
  }

  const metadataObj = ((generation.metadata ?? {}) as Prisma.JsonObject) || {}
  const currentFavorites: string[] = Array.isArray((metadataObj as any).favoriteImages)
    ? ([...(metadataObj as any).favoriteImages] as string[])
    : []

  const favoritesSet = new Set(currentFavorites)
  const shouldFavorite =
    typeof favorite === 'boolean' ? favorite : !favoritesSet.has(imageUrl)

  if (shouldFavorite) {
    favoritesSet.add(imageUrl)
  } else {
    favoritesSet.delete(imageUrl)
  }

  const updatedFavorites = Array.from(favoritesSet)
  const updatedMetadata: Prisma.JsonObject = {
    ...metadataObj,
    favoriteImages: updatedFavorites
  }

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      metadata: updatedMetadata
    }
  })

  return updatedFavorites
}

export async function searchGenerations(
  userId: string,
  query: string,
  page = 1,
  limit = 20,
  status?: string
) {
  const skip = (page - 1) * limit
  const where = {
    userId,
    ...(status && { status }),
    OR: [
      { prompt: { contains: query, mode: 'insensitive' as const } },
      { model: { name: { contains: query, mode: 'insensitive' as const } } }
    ]
  }
  
  const [generations, total] = await Promise.all([
    prisma.generation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        model: {
          select: { id: true, name: true, class: true }
        }
      }
    }),
    prisma.generation.count({ where })
  ])
  
  return {
    generations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
}