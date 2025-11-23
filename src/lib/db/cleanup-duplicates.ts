import { prisma } from '../prisma'
import { GenerationStatus } from '@prisma/client'

/**
 * Remove gerações duplicadas em PROCESSING que já foram completadas
 * Isso pode acontecer se houver race conditions entre polling e webhooks
 */
export async function cleanupDuplicateProcessing(userId: string, completedGenerationId: string) {
  try {
    // Buscar a geração completada para comparar prompt e modelo
    const completedGen = await prisma.generation.findUnique({
      where: { id: completedGenerationId },
      select: {
        prompt: true,
        modelId: true,
        createdAt: true
      }
    })

    if (!completedGen) return

    // Buscar gerações em PROCESSING com mesmo prompt e modelo criadas no mesmo minuto
    const duplicates = await prisma.generation.findMany({
      where: {
        userId,
        id: { not: completedGenerationId },
        status: GenerationStatus.PROCESSING,
        prompt: completedGen.prompt,
        modelId: completedGen.modelId,
        createdAt: {
          gte: new Date(completedGen.createdAt.getTime() - 60000), // 1 minuto antes
          lte: new Date(completedGen.createdAt.getTime() + 60000)  // 1 minuto depois
        }
      },
      select: { id: true, prompt: true }
    })

    if (duplicates.length > 0) {
      console.log(`🧹 [CLEANUP] Found ${duplicates.length} duplicate PROCESSING generations, deleting...`)
      
      await prisma.generation.deleteMany({
        where: {
          id: { in: duplicates.map(d => d.id) }
        }
      })

      console.log(`✅ [CLEANUP] Deleted ${duplicates.length} duplicate generations`)
    }

  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up duplicates:', error)
    // Não falhar se limpeza falhar
  }
}

