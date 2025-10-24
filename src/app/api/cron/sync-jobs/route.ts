import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { AutoStorageService } from '@/lib/services/auto-storage-service'


/**
 * Optimized Cron job for orphaned job recovery
 * Runs as a true fallback for jobs that lost their polling due to server restarts
 *
 * This endpoint:
 * 1. Detects truly orphaned jobs (PROCESSING in DB but not actively polled for >5min)
 * 2. Restarts job-specific polling using AutoStorageService
 * 3. Works with multiple providers (Replicate, Astria, etc.)
 * 4. Avoids redundant work by coordinating with active polling
 */
export async function GET(request: NextRequest) {
  try {
    // Security verification for cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting orphaned job recovery cron', {
      service: 'cron-sync-jobs',
      action: 'cron_start'
    })

    // Use the new AutoStorageService orphaned job recovery
    const autoStorageService = AutoStorageService.getInstance()
    const recoveryResult = await autoStorageService.checkOrphanedJobs()

    const stats = {
      orphanedJobsChecked: recoveryResult.checked,
      orphanedJobsRecovered: recoveryResult.recovered,
      activeJobsCount: autoStorageService.getActiveJobs().length,
      timestamp: new Date().toISOString()
    }

    logger.info('Orphaned job recovery completed', {
      service: 'cron-sync-jobs',
      action: 'cron_completed',
      ...stats
    })

    return NextResponse.json({
      success: true,
      message: 'Orphaned job recovery completed',
      stats
    })

  } catch (error) {
    logger.error('Orphaned job recovery failed', error as Error, {
      service: 'cron-sync-jobs',
      action: 'cron_error'
    })
    return NextResponse.json(
      { error: 'Orphaned job recovery failed' },
      { status: 500 }
    )
  }
}




