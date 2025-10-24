import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Replicate from 'replicate'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { broadcastGenerationStatusChange, broadcastModelStatusChange } from '@/lib/services/realtime-service'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || ''
})

/**
 * Endpoint para sincronização manual
 * Usado quando usuário força uma sincronização ou como fallback
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    console.log(`🔄 Manual sync triggered for user ${userId}`)

    // Buscar jobs pendentes do usuário
    const [pendingGenerations, pendingUpscales, pendingModels] = await Promise.all([
      // Gerações normais pendentes
      prisma.generation.findMany({
        where: {
          userId,
          status: 'PROCESSING',
          jobId: { not: null },
          prompt: { not: { startsWith: '[UPSCALED]' } }
        },
        select: { id: true, jobId: true, createdAt: true },
        take: 10
      }),
      
      // Upscales pendentes
      prisma.generation.findMany({
        where: {
          userId,
          status: 'PROCESSING',
          jobId: { not: null },
          prompt: { startsWith: '[UPSCALED]' }
        },
        select: { id: true, jobId: true, createdAt: true },
        take: 10
      }),
      
      // Modelos em treinamento
      prisma.aIModel.findMany({
        where: {
          userId,
          status: 'TRAINING',
          jobId: { not: null }
        },
        select: { id: true, jobId: true, name: true, createdAt: true },
        take: 5
      })
    ])

    const results = {
      generations: { checked: 0, updated: 0, errors: 0 },
      upscales: { checked: 0, updated: 0, errors: 0 },
      models: { checked: 0, updated: 0, errors: 0 }
    }

    // Sincronizar gerações
    for (const generation of pendingGenerations) {
      results.generations.checked++
      try {
        if (!generation.jobId) continue

        const prediction = await replicate.predictions.get(generation.jobId)
        
        if (prediction.status === 'processing' || prediction.status === 'starting') {
          continue // Ainda processando
        }

        const updateData: any = {}
        let needsUpdate = false

        switch (prediction.status) {
          case 'succeeded':
            if (prediction.output) {
              let temporaryUrls: string[] = []
              if (Array.isArray(prediction.output)) {
                temporaryUrls = prediction.output
              } else if (typeof prediction.output === 'string') {
                temporaryUrls = [prediction.output]
              } else if (prediction.output.images) {
                temporaryUrls = prediction.output.images
              }

              if (temporaryUrls.length > 0) {
                const storageResult = await downloadAndStoreImages(
                  temporaryUrls,
                  generation.id,
                  userId
                )

                if (storageResult.success && storageResult.permanentUrls?.length) {
                  updateData.status = 'COMPLETED'
                  updateData.completedAt = new Date()
                  updateData.imageUrls = storageResult.permanentUrls
                  updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
                  updateData.errorMessage = null
                  needsUpdate = true
                } else {
                  updateData.status = 'FAILED'
                  updateData.completedAt = new Date()
                  updateData.errorMessage = `Manual sync storage failed: ${storageResult.error}`
                  needsUpdate = true
                }
              }
            }
            break

          case 'failed':
            updateData.status = 'FAILED'
            updateData.completedAt = new Date()
            updateData.errorMessage = prediction.error || 'Generation failed'
            needsUpdate = true
            break

          case 'canceled':
            updateData.status = 'CANCELLED'
            updateData.completedAt = new Date()
            updateData.errorMessage = 'Generation was cancelled'
            needsUpdate = true
            break
        }

        if (needsUpdate) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: updateData
          })

          await broadcastGenerationStatusChange(
            generation.id,
            userId,
            prediction.status,
            {
              imageUrls: updateData.imageUrls,
              thumbnailUrls: updateData.thumbnailUrls,
              errorMessage: updateData.errorMessage,
              manualSync: true
            }
          )

          results.generations.updated++
        }

      } catch (error) {
        results.generations.errors++
        console.error(`Manual sync error for generation ${generation.id}:`, error)
      }

      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Sincronizar upscales (lógica similar)
    for (const upscale of pendingUpscales) {
      results.upscales.checked++
      try {
        if (!upscale.jobId) continue

        const prediction = await replicate.predictions.get(upscale.jobId)
        
        if (prediction.status === 'processing' || prediction.status === 'starting') {
          continue
        }

        const updateData: any = {}
        let needsUpdate = false

        switch (prediction.status) {
          case 'succeeded':
            if (prediction.output) {
              let temporaryUrls: string[] = []
              if (Array.isArray(prediction.output)) {
                temporaryUrls = prediction.output
              } else if (typeof prediction.output === 'string') {
                temporaryUrls = [prediction.output]
              }

              if (temporaryUrls.length > 0) {
                const storageResult = await downloadAndStoreImages(
                  temporaryUrls,
                  upscale.id,
                  userId,
                  'upscaled'
                )

                if (storageResult.success && storageResult.permanentUrls?.length) {
                  updateData.status = 'COMPLETED'
                  updateData.completedAt = new Date()
                  updateData.imageUrls = storageResult.permanentUrls
                  updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
                  updateData.errorMessage = null
                  needsUpdate = true
                } else {
                  updateData.status = 'FAILED'
                  updateData.completedAt = new Date()
                  updateData.errorMessage = `Manual sync upscale storage failed: ${storageResult.error}`
                  needsUpdate = true
                }
              }
            }
            break

          case 'failed':
            updateData.status = 'FAILED'
            updateData.completedAt = new Date()
            updateData.errorMessage = prediction.error || 'Upscale failed'
            needsUpdate = true
            break

          case 'canceled':
            updateData.status = 'CANCELLED'
            updateData.completedAt = new Date()
            updateData.errorMessage = 'Upscale was cancelled'
            needsUpdate = true
            break
        }

        if (needsUpdate) {
          await prisma.generation.update({
            where: { id: upscale.id },
            data: updateData
          })

          await broadcastGenerationStatusChange(
            upscale.id,
            userId,
            prediction.status,
            {
              imageUrls: updateData.imageUrls,
              thumbnailUrls: updateData.thumbnailUrls,
              errorMessage: updateData.errorMessage,
              isUpscale: true,
              manualSync: true
            }
          )

          results.upscales.updated++
        }

      } catch (error) {
        results.upscales.errors++
        console.error(`Manual sync error for upscale ${upscale.id}:`, error)
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Sincronizar modelos
    for (const model of pendingModels) {
      results.models.checked++
      try {
        if (!model.jobId) continue

        const prediction = await replicate.predictions.get(model.jobId)
        
        if (prediction.status === 'processing' || prediction.status === 'starting') {
          continue
        }

        const updateData: any = {}
        let needsUpdate = false

        switch (prediction.status) {
          case 'succeeded':
            updateData.status = 'READY'
            updateData.trainedAt = new Date()
            updateData.progress = 100
            
            if (prediction.output) {
              updateData.modelUrl = prediction.output
            }
            
            updateData.qualityScore = 85 // Score padrão para manual sync
            updateData.trainingConfig = {
              trainingCompleted: true,
              completedAt: new Date().toISOString(),
              version: prediction.version
            }
            
            needsUpdate = true
            break

          case 'failed':
            updateData.status = 'ERROR'
            updateData.trainedAt = new Date()
            updateData.progress = 0
            updateData.errorMessage = prediction.error || 'Training failed'
            needsUpdate = true
            break

          case 'canceled':
            updateData.status = 'DRAFT'
            updateData.errorMessage = 'Training was cancelled'
            needsUpdate = true
            break
        }

        if (needsUpdate) {
          await prisma.aIModel.update({
            where: { id: model.id },
            data: updateData
          })

          await broadcastModelStatusChange(
            model.id,
            userId,
            updateData.status || prediction.status,
            {
              progress: updateData.progress,
              qualityScore: updateData.qualityScore,
              errorMessage: updateData.errorMessage,
              modelUrl: updateData.modelUrl,
              manualSync: true
            }
          )

          results.models.updated++
        }

      } catch (error) {
        results.models.errors++
        console.error(`Manual sync error for model ${model.id}:`, error)
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    const totalChecked = results.generations.checked + results.upscales.checked + results.models.checked
    const totalUpdated = results.generations.updated + results.upscales.updated + results.models.updated
    const totalErrors = results.generations.errors + results.upscales.errors + results.models.errors

    console.log(`✅ Manual sync completed for user ${userId}:`, {
      totalChecked,
      totalUpdated,
      totalErrors,
      results
    })

    return NextResponse.json({
      success: true,
      message: 'Manual sync completed',
      summary: {
        totalChecked,
        totalUpdated,
        totalErrors
      },
      details: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json(
      { error: 'Manual sync failed' },
      { status: 500 }
    )
  }
}