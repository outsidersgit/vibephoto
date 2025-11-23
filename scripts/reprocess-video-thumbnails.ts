/**
 * Script para reprocessar thumbnails de vídeo antigas e otimizá-las
 * 
 * Este script:
 * 1. Busca todos os vídeos COMPLETED com thumbnailUrl
 * 2. Verifica o tamanho da thumbnail atual
 * 3. Se > 200KB, reprocessa usando extractFirstFrame
 * 4. Atualiza o banco de dados com a nova URL otimizada
 * 
 * Uso:
 * ```bash
 * npx ts-node scripts/reprocess-video-thumbnails.ts
 * ```
 * 
 * Opções:
 * - --dry-run: Simula o processamento sem fazer alterações
 * - --limit=N: Limita o número de vídeos processados
 * - --force: Reprocessa todas as thumbnails, independente do tamanho
 */

// Load environment variables from .env file
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from project root
config({ path: resolve(__dirname, '../.env') })

import { prisma } from '../src/lib/db'
import { extractFirstFrame } from '../src/lib/video/extract-frame'
import { VideoStatus } from '@prisma/client'

interface ReprocessStats {
  total: number
  processed: number
  skipped: number
  failed: number
  totalSizeBefore: number
  totalSizeAfter: number
}

async function getThumbnailSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : null
  } catch (error) {
    console.error(`❌ Failed to get thumbnail size for ${url}:`, error)
    return null
  }
}

async function reprocessVideoThumbnails(options: {
  dryRun?: boolean
  limit?: number
  force?: boolean
  minSizeKB?: number
} = {}) {
  const {
    dryRun = false,
    limit,
    force = false,
    minSizeKB = 200 // Reprocess thumbnails > 200KB by default
  } = options

  console.log('🎬 Starting video thumbnail reprocessing...')
  console.log('📊 Options:', {
    dryRun,
    limit: limit || 'unlimited',
    force,
    minSizeKB
  })

  const stats: ReprocessStats = {
    total: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    totalSizeBefore: 0,
    totalSizeAfter: 0
  }

  try {
    // Fetch all completed videos with thumbnails
    const videos = await prisma.videoGeneration.findMany({
      where: {
        status: VideoStatus.COMPLETED,
        thumbnailUrl: { not: null },
        videoUrl: { not: null }
      },
      select: {
        id: true,
        userId: true,
        thumbnailUrl: true,
        videoUrl: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    stats.total = videos.length
    console.log(`\n📹 Found ${videos.length} videos with thumbnails\n`)

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      const progress = `[${i + 1}/${videos.length}]`

      console.log(`\n${progress} Processing video ${video.id}...`)
      console.log(`  📅 Created: ${video.createdAt.toISOString()}`)
      console.log(`  🔗 Thumbnail: ${video.thumbnailUrl?.substring(0, 80)}...`)

      if (!video.thumbnailUrl || !video.videoUrl) {
        console.log(`  ⏭️ Skipping - missing URLs`)
        stats.skipped++
        continue
      }

      // Check current thumbnail size
      const currentSize = await getThumbnailSize(video.thumbnailUrl)
      if (currentSize === null) {
        console.log(`  ⚠️ Could not determine thumbnail size, skipping`)
        stats.skipped++
        continue
      }

      const currentSizeKB = Math.round(currentSize / 1024)
      console.log(`  📏 Current size: ${currentSizeKB} KB`)
      stats.totalSizeBefore += currentSize

      // Skip if thumbnail is already optimized (unless force mode)
      if (!force && currentSize < minSizeKB * 1024) {
        console.log(`  ✅ Already optimized (< ${minSizeKB} KB), skipping`)
        stats.skipped++
        stats.totalSizeAfter += currentSize
        continue
      }

      if (dryRun) {
        console.log(`  🔍 [DRY RUN] Would reprocess thumbnail (${currentSizeKB} KB → ~50 KB)`)
        stats.processed++
        stats.totalSizeAfter += 50 * 1024 // Estimate 50KB
        continue
      }

      // Reprocess thumbnail
      try {
        console.log(`  🎨 Extracting and optimizing frame...`)
        const result = await extractFirstFrame(
          video.videoUrl,
          video.id,
          video.userId
        )

        if (!result.success || !result.thumbnailUrl) {
          console.error(`  ❌ Failed to extract frame: ${result.error}`)
          stats.failed++
          stats.totalSizeAfter += currentSize // Keep old size in stats
          continue
        }

        // Verify new thumbnail size
        const newSize = await getThumbnailSize(result.thumbnailUrl)
        const newSizeKB = newSize ? Math.round(newSize / 1024) : 'unknown'
        const savings = newSize ? Math.round(((currentSize - newSize) / currentSize) * 100) : 0

        console.log(`  ✅ New thumbnail: ${newSizeKB} KB (${savings}% reduction)`)
        stats.totalSizeAfter += newSize || currentSize

        // Update database
        await prisma.videoGeneration.update({
          where: { id: video.id },
          data: {
            thumbnailUrl: result.thumbnailUrl,
            metadata: {
              ...(video.metadata as any || {}),
              thumbnailOptimized: true,
              thumbnailOptimizedAt: new Date().toISOString(),
              thumbnailSizeBefore: currentSize,
              thumbnailSizeAfter: newSize
            }
          }
        })

        stats.processed++
        console.log(`  💾 Database updated`)

        // Rate limiting - wait 1 second between videos to avoid overwhelming FFmpeg
        if (i < videos.length - 1) {
          console.log(`  ⏸️ Waiting 1 second before next video...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`  ❌ Error reprocessing thumbnail:`, error)
        stats.failed++
        stats.totalSizeAfter += currentSize // Keep old size in stats
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 REPROCESSING SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total videos:     ${stats.total}`)
    console.log(`Processed:        ${stats.processed} ✅`)
    console.log(`Skipped:          ${stats.skipped} ⏭️`)
    console.log(`Failed:           ${stats.failed} ❌`)
    console.log('\n💾 Storage savings:')
    console.log(`Before:           ${Math.round(stats.totalSizeBefore / 1024 / 1024)} MB`)
    console.log(`After:            ${Math.round(stats.totalSizeAfter / 1024 / 1024)} MB`)
    console.log(`Saved:            ${Math.round((stats.totalSizeBefore - stats.totalSizeAfter) / 1024 / 1024)} MB (${Math.round(((stats.totalSizeBefore - stats.totalSizeAfter) / stats.totalSizeBefore) * 100)}%)`)
    console.log('='.repeat(60))

    if (dryRun) {
      console.log('\n⚠️ This was a DRY RUN - no changes were made')
      console.log('Run without --dry-run to apply changes')
    }

  } catch (error) {
    console.error('\n❌ Fatal error during reprocessing:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  limit: args.find(arg => arg.startsWith('--limit='))?.split('=')[1] 
    ? parseInt(args.find(arg => arg.startsWith('--limit='))!.split('=')[1], 10)
    : undefined,
  minSizeKB: args.find(arg => arg.startsWith('--min-size='))?.split('=')[1]
    ? parseInt(args.find(arg => arg.startsWith('--min-size='))!.split('=')[1], 10)
    : 200
}

// Run the script
reprocessVideoThumbnails(options)
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

