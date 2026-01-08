import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Replicate from 'replicate'

/**
 * Endpoint administrativo para recuperar gerações perdidas
 *
 * Este endpoint busca registros de editHistory que estão em PROCESSING há muito tempo
 * e tenta recuperar o resultado do Replicate manualmente.
 *
 * Útil para casos onde o webhook não foi recebido ou falhou em processar.
 *
 * GET /api/admin/recover-lost-generations?minutes=30
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e permissões de admin
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const url = new URL(request.url)
    const minutesParam = url.searchParams.get('minutes') || '30'
    const minutes = parseInt(minutesParam, 10)

    console.log(`🔍 [RECOVER] Searching for lost generations older than ${minutes} minutes`)

    // Buscar editHistory em PROCESSING há muito tempo
    const lostEdits = await prisma.editHistory.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: {
          lte: new Date(Date.now() - minutes * 60 * 1000)
        }
      },
      select: {
        id: true,
        userId: true,
        prompt: true,
        operation: true,
        createdAt: true,
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    console.log(`📊 [RECOVER] Found ${lostEdits.length} potentially lost generations`)

    if (lostEdits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No lost generations found',
        found: 0,
        recovered: 0
      })
    }

    // Inicializar Replicate client
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!
    })

    const results = []
    let recovered = 0

    for (const edit of lostEdits) {
      const metadata = edit.metadata as any
      const replicateId = metadata?.replicateId

      if (!replicateId) {
        results.push({
          editId: edit.id,
          status: 'skipped',
          reason: 'No replicateId in metadata'
        })
        continue
      }

      try {
        console.log(`🔍 [RECOVER] Checking Replicate status for edit ${edit.id}`)

        // Buscar status no Replicate
        const prediction = await replicate.predictions.get(replicateId)

        console.log(`📡 [RECOVER] Replicate status: ${prediction.status}`)

        if (prediction.status === 'succeeded' && prediction.output) {
          console.log(`✅ [RECOVER] Found completed generation! Updating database...`)

          // Extrair URL da imagem
          const imageUrl = typeof prediction.output === 'string'
            ? prediction.output
            : (Array.isArray(prediction.output) ? prediction.output[0] : null)

          if (imageUrl) {
            // Atualizar editHistory
            await prisma.editHistory.update({
              where: { id: edit.id },
              data: {
                status: 'COMPLETED',
                editedImageUrl: imageUrl,
                thumbnailUrl: imageUrl,
                metadata: {
                  ...metadata,
                  status: 'COMPLETED',
                  recoveredAt: new Date().toISOString(),
                  recoveredBy: 'admin-recovery-script',
                  originalReplicateStatus: prediction.status
                }
              }
            })

            // Atualizar generation associada
            const generation = await prisma.generation.findFirst({
              where: {
                metadata: {
                  path: ['editHistoryId'],
                  equals: edit.id
                }
              }
            })

            if (generation) {
              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  status: 'COMPLETED',
                  imageUrls: [imageUrl],
                  thumbnailUrls: [imageUrl],
                  completedAt: new Date()
                }
              })
            }

            recovered++
            results.push({
              editId: edit.id,
              userId: edit.userId,
              status: 'recovered',
              replicateId,
              imageUrl: imageUrl.substring(0, 100) + '...',
              minutesSinceCreation: Math.floor((Date.now() - new Date(edit.createdAt).getTime()) / 1000 / 60)
            })

            console.log(`✅ [RECOVER] Successfully recovered edit ${edit.id}`)
          } else {
            results.push({
              editId: edit.id,
              status: 'failed',
              reason: 'No image URL in Replicate output'
            })
          }
        } else if (prediction.status === 'failed') {
          // Marcar como falha
          await prisma.editHistory.update({
            where: { id: edit.id },
            data: {
              status: 'FAILED',
              errorMessage: prediction.error || 'Generation failed on Replicate',
              metadata: {
                ...metadata,
                status: 'FAILED',
                recoveredAt: new Date().toISOString(),
                recoveredBy: 'admin-recovery-script'
              }
            }
          })

          results.push({
            editId: edit.id,
            status: 'marked_failed',
            replicateStatus: prediction.status,
            error: prediction.error
          })
        } else {
          // Ainda processando
          results.push({
            editId: edit.id,
            status: 'still_processing',
            replicateStatus: prediction.status,
            minutesSinceCreation: Math.floor((Date.now() - new Date(edit.createdAt).getTime()) / 1000 / 60)
          })
        }
      } catch (error) {
        console.error(`❌ [RECOVER] Error checking edit ${edit.id}:`, error)
        results.push({
          editId: edit.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recovery complete: ${recovered} generations recovered`,
      found: lostEdits.length,
      recovered,
      results
    })

  } catch (error) {
    console.error('❌ [RECOVER] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
