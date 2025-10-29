import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AstriaProvider } from '@/lib/ai/providers/astria'
import { updateModelStatus } from '@/lib/db/models'
import { startTrainingPolling } from '@/lib/services/training-polling-service'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'

/**
 * Endpoint de reconciliação para modelos desincronizados com Astria
 * Busca modelos em ERROR ou TRAINING sem trainingJobId e tenta recuperar via idempotência
 * 
 * Pode ser chamado via cron ou manualmente
 */
export async function POST(request: NextRequest) {
  try {
    // Verificação básica de segurança (opcional: adicionar secret)
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting Astria tunes reconciliation...')

    // Buscar modelos que precisam reconciliação
    // - Status ERROR ou TRAINING
    // - Sem trainingJobId (não sincronizado)
    // - Criados nas últimas 48 horas
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - 48)

    const modelsToReconcile = await prisma.aIModel.findMany({
      where: {
        OR: [
          { status: 'ERROR' },
          { status: 'TRAINING', trainingJobId: null }
        ],
        createdAt: {
          gte: cutoffDate
        }
      },
      take: 50 // Limitar para não sobrecarregar
    })

    console.log(`📊 Found ${modelsToReconcile.length} models to reconcile`)

    if (modelsToReconcile.length === 0) {
      return NextResponse.json({
        success: true,
        reconciled: 0,
        message: 'No models need reconciliation'
      })
    }

    const astriaProvider = new AstriaProvider()
    let reconciledCount = 0
    const results: Array<{ modelId: string; success: boolean; error?: string }> = []

    for (const model of modelsToReconcile) {
      try {
        console.log(`🔍 Reconciling model ${model.id}...`)
        
        // Buscar tune no Astria pelo título (modelId)
        const foundTune = await astriaProvider.findTuneByTitle(model.id)
        
        if (!foundTune) {
          console.log(`⚠️ Model ${model.id}: Tune not found in Astria`)
          results.push({ modelId: model.id, success: false, error: 'Tune not found' })
          continue
        }

        console.log(`✅ Model ${model.id}: Found tune ${foundTune.id}, status: ${foundTune.status}`)

        // Mapear status
        let internalStatus: 'TRAINING' | 'READY' | 'ERROR'
        let progress = 20

        if (foundTune.status === 'trained') {
          internalStatus = 'READY'
          progress = 100
        } else if (foundTune.status === 'failed' || foundTune.status === 'cancelled') {
          internalStatus = 'ERROR'
          progress = 0
        } else {
          internalStatus = 'TRAINING'
          progress = 20
        }

        // Atualizar modelo
        await prisma.aIModel.update({
          where: { id: model.id },
          data: {
            status: internalStatus,
            progress,
            trainingJobId: foundTune.id,
            modelUrl: internalStatus === 'READY' ? foundTune.id : undefined,
            trainedAt: internalStatus === 'READY' ? new Date() : undefined,
            trainingConfig: {
              trainingId: foundTune.id,
              fluxModel: true,
              startedAt: new Date().toISOString(),
              provider: 'astria',
              recovered: true,
              recoveredAt: new Date().toISOString()
            }
          }
        })

        // Emitir SSE para atualizar UI do dono
        await broadcastModelStatusChange(model.id, model.userId, internalStatus, {
          progress,
          modelUrl: foundTune.id,
          recovered: true
        })

        // Se TRAINING, iniciar polling
        if (internalStatus === 'TRAINING') {
          setTimeout(() => {
            startTrainingPolling(foundTune.id, model.id, model.userId).catch(err => {
              console.error(`Failed to start polling for recovered model ${model.id}:`, err)
            })
          }, 2000)
        }

        reconciledCount++
        results.push({ modelId: model.id, success: true })
        console.log(`✅ Model ${model.id} reconciled successfully! Status: ${internalStatus}`)

      } catch (error) {
        console.error(`❌ Failed to reconcile model ${model.id}:`, error)
        results.push({
          modelId: model.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      reconciled: reconciledCount,
      total: modelsToReconcile.length,
      results
    })

  } catch (error) {
    console.error('❌ Reconciliation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

