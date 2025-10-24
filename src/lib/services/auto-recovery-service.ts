import { prisma } from '@/lib/db'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { broadcastGenerationStatusChange, broadcastNotification } from '@/lib/services/realtime-service'
import { logger } from '@/lib/monitoring/logger'

/**
 * Serviço de recuperação automática de imagens expiradas
 * 
 * Funcionalidades:
 * 1. Detecta URLs temporárias do Replicate que podem estar expiradas
 * 2. Tenta recuperar imagens automaticamente em background
 * 3. Atualiza o banco de dados com URLs permanentes
 * 4. Notifica usuários via WebSocket quando recuperação é bem-sucedida
 */

interface RecoveryResult {
  success: boolean
  recoveredCount: number
  failedCount: number
  totalProcessed: number
  errors: string[]
}

/**
 * Executa recuperação automática para gerações com URLs expiradas
 */
export async function executeAutoRecovery(userId?: string): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    success: true,
    recoveredCount: 0,
    failedCount: 0,
    totalProcessed: 0,
    errors: []
  }

  try {
    await logger.info('🚨 Starting automatic recovery process', { userId })

    // Busca gerações que podem ter URLs expiradas
    const candidatesForRecovery = await findCandidatesForRecovery(userId)
    
    result.totalProcessed = candidatesForRecovery.length
    
    if (candidatesForRecovery.length === 0) {
      await logger.info('✅ No candidates found for automatic recovery')
      return result
    }

    await logger.info(`🔍 Found ${candidatesForRecovery.length} candidates for automatic recovery`)

    // Processa cada geração candidata
    for (const generation of candidatesForRecovery) {
      try {
        const recoveryResult = await recoverGenerationImages(generation)
        
        if (recoveryResult.success) {
          result.recoveredCount++
          
          // Notifica o usuário via WebSocket
          await broadcastNotification(
            generation.userId,
            'Imagens Recuperadas',
            `${recoveryResult.imageCount} imagens foram recuperadas automaticamente!`,
            'success'
          )
          
          // Atualiza status via WebSocket
          await broadcastGenerationStatusChange(
            generation.id,
            generation.userId,
            'recovered',
            {
              imageUrls: recoveryResult.permanentUrls,
              thumbnailUrls: recoveryResult.thumbnailUrls,
              autoRecovered: true,
              recoveredAt: new Date().toISOString()
            }
          )
          
        } else {
          result.failedCount++
          result.errors.push(`Generation ${generation.id}: ${recoveryResult.error}`)
        }
        
      } catch (error) {
        result.failedCount++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Generation ${generation.id}: ${errorMessage}`)
        
        await logger.error('Auto-recovery failed for generation', error as Error, {
          generationId: generation.id,
          userId: generation.userId
        })
      }

      // Delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Log do resultado final
    await logger.info('🎯 Automatic recovery completed', {
      totalProcessed: result.totalProcessed,
      recoveredCount: result.recoveredCount,
      failedCount: result.failedCount,
      errorCount: result.errors.length
    })

    // Notificação geral se houver recuperações
    if (result.recoveredCount > 0 && userId) {
      await broadcastNotification(
        userId,
        'Recovery Automático Concluído',
        `${result.recoveredCount} gerações foram recuperadas automaticamente!`,
        'success'
      )
    }

    result.success = result.recoveredCount > 0 || result.failedCount === 0

  } catch (error) {
    result.success = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`System error: ${errorMessage}`)
    
    await logger.error('Critical error in automatic recovery', error as Error)
  }

  return result
}

/**
 * Encontra gerações candidatas para recuperação automática
 */
async function findCandidatesForRecovery(userId?: string) {
  const whereCondition: any = {
    status: 'COMPLETED',
    imageUrls: {
      not: { equals: [] }
    }
  }
  
  if (userId) {
    whereCondition.userId = userId
  }

  const generations = await prisma.generation.findMany({
    where: whereCondition,
    select: {
      id: true,
      userId: true,
      imageUrls: true,
      thumbnailUrls: true,
      completedAt: true,
      prompt: true
    },
    orderBy: {
      completedAt: 'desc'
    },
    take: 50 // Limita para evitar sobrecarga
  })

  // Filtra gerações que provavelmente têm URLs expiradas
  return generations.filter(generation => {
    if (!generation.imageUrls || generation.imageUrls.length === 0) {
      return false
    }

    // Verifica se tem URLs do Replicate (temporárias)
    const hasReplicateUrls = generation.imageUrls.some((url: string) => 
      url.includes('replicate.delivery') || 
      url.includes('pbxt.replicate.delivery') ||
      url.includes('replicate.com/api/models/')
    )

    // Verifica se é uma geração recente demais (menos de 30 minutos)
    const isRecentGeneration = generation.completedAt && 
      (Date.now() - new Date(generation.completedAt).getTime()) < (30 * 60 * 1000)

    // Candidata se tem URLs do Replicate e não é muito recente
    return hasReplicateUrls && !isRecentGeneration
  })
}

/**
 * Recupera imagens de uma geração específica
 */
async function recoverGenerationImages(generation: any) {
  try {
    const temporaryUrls = generation.imageUrls || []
    
    if (temporaryUrls.length === 0) {
      return {
        success: false,
        error: 'No images to recover'
      }
    }

    // Verifica se as URLs ainda estão acessíveis
    const urlsToRecover = []
    for (const url of temporaryUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          urlsToRecover.push(url)
        }
      } catch (error) {
        // URL não acessível, mas não falha o processo
        console.log(`URL not accessible: ${url}`)
      }
    }

    if (urlsToRecover.length === 0) {
      return {
        success: false,
        error: 'All URLs are no longer accessible'
      }
    }

    // Baixa e armazena permanentemente
    const storageResult = await downloadAndStoreImages(
      urlsToRecover,
      generation.id,
      generation.userId,
      'recovered' // Pasta especial para imagens recuperadas
    )

    if (!storageResult.success || !storageResult.permanentUrls?.length) {
      return {
        success: false,
        error: `Storage failed: ${storageResult.error}`
      }
    }

    // Atualiza no banco de dados
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        imageUrls: storageResult.permanentUrls,
        thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
        metadata: {
          ...(typeof generation.metadata === 'object' ? generation.metadata : {}),
          autoRecovered: true,
          recoveredAt: new Date().toISOString(),
          originalUrls: temporaryUrls,
          recoveredUrls: storageResult.permanentUrls
        }
      }
    })

    return {
      success: true,
      imageCount: storageResult.permanentUrls.length,
      permanentUrls: storageResult.permanentUrls,
      thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown recovery error'
    }
  }
}

/**
 * Verifica se uma URL está expirada ou inacessível
 */
export async function checkUrlAccessibility(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Identifica automaticamente URLs que precisam de recuperação
 */
export async function identifyExpiredUrls(imageUrls: string[]): Promise<string[]> {
  const expiredUrls = []
  
  for (const url of imageUrls) {
    // Verifica se é URL temporária do Replicate
    const isTemporary = url.includes('replicate.delivery') || 
                       url.includes('pbxt.replicate.delivery') ||
                       url.includes('replicate.com/api/models/')
    
    if (isTemporary) {
      const isAccessible = await checkUrlAccessibility(url)
      if (!isAccessible) {
        expiredUrls.push(url)
      }
    }
  }
  
  return expiredUrls
}

/**
 * Executa verificação automática de URLs expiradas para um usuário
 */
export async function checkAndRecoverUserImages(userId: string): Promise<RecoveryResult> {
  return executeAutoRecovery(userId)
}

/**
 * Scheduler para recuperação automática em background
 * Será chamado pelo cron job
 */
export async function scheduleAutoRecovery(): Promise<RecoveryResult> {
  return executeAutoRecovery() // Sem userId = verifica todos os usuários
}