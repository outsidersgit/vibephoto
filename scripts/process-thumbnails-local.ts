/**
 * Script para processar thumbnails localmente e fazer upload para AWS
 * 
 * Este script:
 * 1. Conecta ao banco de produção via .env
 * 2. Busca vídeos com thumbnails > 200KB
 * 3. Baixa os vídeos temporariamente
 * 4. Extrai e otimiza thumbnails localmente (usando FFmpeg local)
 * 5. Faz upload para S3/CloudFront
 * 6. Atualiza banco de dados
 * 
 * Uso:
 * ```bash
 * npm run process:thumbnails
 * ```
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'
import { extractFirstFrame } from '../src/lib/video/extract-frame'

const prisma = new PrismaClient()

interface VideoToProcess {
  id: string
  videoUrl: string
  thumbnailUrl: string
  userId: string
  currentSizeKB: number
}

async function getThumbnailSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : null
  } catch (error) {
    console.error(`❌ Failed to get size for ${url}:`, error)
    return null
  }
}

async function processThumnailsLocal() {
  console.log('🎬 Starting local thumbnail processing...\n')

  try {
    // 1. Buscar vídeos COMPLETED com thumbnails
    console.log('📹 Fetching videos from database...')
    const videos = await prisma.videoGeneration.findMany({
      where: {
        status: 'COMPLETED',
        thumbnailUrl: { not: null },
        videoUrl: { not: null }
      },
      select: {
        id: true,
        userId: true,
        thumbnailUrl: true,
        videoUrl: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`✅ Found ${videos.length} videos\n`)

    // 2. Filtrar vídeos com thumbnails > 200KB
    const videosToProcess: VideoToProcess[] = []

    console.log('📏 Checking thumbnail sizes...')
    for (const video of videos) {
      if (!video.thumbnailUrl || !video.videoUrl) continue

      const size = await getThumbnailSize(video.thumbnailUrl)
      if (!size) continue

      const sizeKB = Math.round(size / 1024)
      
      if (sizeKB > 200) {
        videosToProcess.push({
          id: video.id,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          userId: video.userId,
          currentSizeKB: sizeKB
        })
        console.log(`  📦 ${video.id}: ${sizeKB} KB (needs optimization)`)
      } else {
        console.log(`  ✅ ${video.id}: ${sizeKB} KB (already optimized)`)
      }
    }

    console.log(`\n🎯 Found ${videosToProcess.length} videos to process\n`)

    if (videosToProcess.length === 0) {
      console.log('✨ All thumbnails are already optimized!')
      return
    }

    // 3. Processar cada vídeo
    let processed = 0
    let failed = 0
    let totalSizeBefore = 0
    let totalSizeAfter = 0

    for (let i = 0; i < videosToProcess.length; i++) {
      const video = videosToProcess[i]
      console.log(`\n[${ i + 1}/${videosToProcess.length}] Processing ${video.id}`)
      console.log(`  📏 Current size: ${video.currentSizeKB} KB`)
      console.log(`  🔗 Video URL: ${video.videoUrl.substring(0, 80)}...`)

      totalSizeBefore += video.currentSizeKB * 1024

      try {
        // Extrair frame e fazer upload
        console.log(`  🎨 Extracting and optimizing frame...`)
        const result = await extractFirstFrame(
          video.videoUrl,
          video.id,
          video.userId
        )

        if (!result.success || !result.thumbnailUrl) {
          console.error(`  ❌ Failed: ${result.error}`)
          failed++
          totalSizeAfter += video.currentSizeKB * 1024
          continue
        }

        // Verificar novo tamanho
        const newSize = await getThumbnailSize(result.thumbnailUrl)
        const newSizeKB = newSize ? Math.round(newSize / 1024) : null
        const savings = newSize ? Math.round(((video.currentSizeKB * 1024 - newSize) / (video.currentSizeKB * 1024)) * 100) : 0

        console.log(`  ✅ New thumbnail: ${newSizeKB} KB (${savings}% reduction)`)
        console.log(`  📤 Uploaded to: ${result.thumbnailUrl.substring(0, 80)}...`)

        totalSizeAfter += newSize || (video.currentSizeKB * 1024)

        // Atualizar banco de dados
        const videoRecord = await prisma.videoGeneration.findUnique({
          where: { id: video.id },
          select: { metadata: true }
        })

        await prisma.videoGeneration.update({
          where: { id: video.id },
          data: {
            thumbnailUrl: result.thumbnailUrl,
            metadata: {
              ...(videoRecord?.metadata as any || {}),
              thumbnailOptimized: true,
              thumbnailOptimizedAt: new Date().toISOString(),
              thumbnailSizeBefore: video.currentSizeKB * 1024,
              thumbnailSizeAfter: newSize,
              optimizedLocally: true
            }
          }
        })

        console.log(`  💾 Database updated`)
        processed++

        // Rate limiting
        if (i < videosToProcess.length - 1) {
          console.log(`  ⏸️  Waiting 2 seconds...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`  ❌ Error:`, error)
        failed++
        totalSizeAfter += video.currentSizeKB * 1024
      }
    }

    // 4. Resumo final
    const totalSavedBytes = totalSizeBefore - totalSizeAfter
    const totalSavedMB = Math.round(totalSavedBytes / 1024 / 1024)
    const savingsPercent = totalSizeBefore > 0 
      ? Math.round((totalSavedBytes / totalSizeBefore) * 100)
      : 0

    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMO FINAL')
    console.log('='.repeat(60))
    console.log(`Total de vídeos:     ${videosToProcess.length}`)
    console.log(`Processados:         ${processed} ✅`)
    console.log(`Falharam:            ${failed} ❌`)
    console.log('')
    console.log(`💾 Economia de espaço:`)
    console.log(`Antes:               ${Math.round(totalSizeBefore / 1024 / 1024)} MB`)
    console.log(`Depois:              ${Math.round(totalSizeAfter / 1024 / 1024)} MB`)
    console.log(`Economizado:         ${totalSavedMB} MB (${savingsPercent}%)`)
    console.log('='.repeat(60))
    console.log('\n✨ Processamento concluído!')

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Execute
processThumnailsLocal()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

