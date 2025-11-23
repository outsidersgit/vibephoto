import { prisma } from '../prisma'
import { GenerationStatus } from '@prisma/client'

/**
 * Remove gerações duplicadas em PROCESSING que já foram completadas
 * Isso pode acontecer se houver race conditions entre polling e webhooks
 */
export async function cleanupDuplicateProcessing(userId: string, completedGenerationId: string) {
  try {
    // Buscar a geração completada para comparar prompt, modelo e metadata
    const completedGen = await prisma.generation.findUnique({
      where: { id: completedGenerationId },
      select: {
        prompt: true,
        modelId: true,
        createdAt: true,
        metadata: true
      }
    })

    if (!completedGen) return

    // Extrair editHistoryId da metadata (se existir)
    const editHistoryId = completedGen.metadata && typeof completedGen.metadata === 'object'
      ? (completedGen.metadata as any).editHistoryId
      : null

    // Buscar gerações em PROCESSING com mesmo prompt/editHistoryId e modelo criadas no mesmo minuto
    const whereConditions: any = {
      userId,
      id: { not: completedGenerationId },
      status: GenerationStatus.PROCESSING,
      createdAt: {
        gte: new Date(completedGen.createdAt.getTime() - 120000), // 2 minutos antes (aumentado para editor)
        lte: new Date(completedGen.createdAt.getTime() + 120000)  // 2 minutos depois
      }
    }

    // Se for editor, buscar por editHistoryId OU prompt
    if (editHistoryId) {
      whereConditions.OR = [
        { prompt: completedGen.prompt },
        {
          metadata: {
            path: ['editHistoryId'],
            equals: editHistoryId
          }
        }
      ]
    } else {
      // Geração comum: buscar por prompt e modelId
      whereConditions.prompt = completedGen.prompt
      if (completedGen.modelId) {
        whereConditions.modelId = completedGen.modelId
      }
    }

    const duplicates = await prisma.generation.findMany({
      where: whereConditions,
      select: { id: true, prompt: true, metadata: true }
    })

    if (duplicates.length > 0) {
      console.log(`🧹 [CLEANUP] Found ${duplicates.length} duplicate PROCESSING generations, deleting...`)
      console.log(`🧹 [CLEANUP] Duplicates IDs:`, duplicates.map(d => d.id))
      
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

