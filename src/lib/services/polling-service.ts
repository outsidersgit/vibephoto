import { getAIProvider, calculateGenerationCost } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'
import { downloadAndStoreImages, downloadAndStoreVideo } from '@/lib/storage/utils'
import { broadcastGenerationStatusChange } from '@/lib/services/realtime-service'
import { recordImageGenerationCost } from '@/lib/services/credit-transaction-service'
import {
  JobType,
  ProviderType,
  getJobTimeout,
  getPollingInterval,
  getMaxAttempts,
  getTimeoutMessage,
  shouldStopPolling
} from './polling-config'
import { logger } from '@/lib/monitoring/logger'

interface PollingJob {
  predictionId: string
  generationId: string
  userId: string
  provider: ProviderType
  jobType: JobType
  maxAttempts: number
  attempts: number
  intervalMs: number
  maxTimeout: number
  startTime: Date
  timeoutId?: NodeJS.Timeout
}

// Active polling jobs
const activePollingJobs = new Map<string, PollingJob>()

/**
 * Start polling a prediction until completion (supports multiple AI providers)
 */
export async function startPolling(
  predictionId: string,
  generationId: string,
  userId: string,
  provider: ProviderType = 'replicate',
  jobType: JobType = 'generation'
) {
  // Get configurable timeout and polling settings
  const maxTimeout = getJobTimeout(provider, jobType)
  const intervalMs = getPollingInterval(provider)
  const maxAttempts = getMaxAttempts(provider, jobType)

  console.log(`🔧 [POLLING_DEBUG] startPolling called with parameters:`, {
    predictionId,
    generationId,
    userId,
    provider,
    jobType,
    providerDefault: 'replicate' // showing what the default would be
  })

  logger.info('Starting job-specific polling', {
    service: 'polling-service',
    action: 'start_polling',
    predictionId,
    generationId,
    userId,
    provider,
    jobType,
    maxTimeout,
    intervalMs,
    maxAttempts
  })

  // 🔒 GUARD ANTI-DUPLICAÇÃO: Verificar se já existe polling ativo
  if (activePollingJobs.has(predictionId)) {
    logger.info('Polling already active for prediction', {
      service: 'polling-service',
      action: 'duplicate_polling_blocked',
      predictionId
    })
    return
  }

  // Check if generation already exists and is completed
  // Check if generation already exists and is completed
  const isVideoJob = jobType === 'video'
  try {
    let existingGeneration: any

    if (isVideoJob) {
      existingGeneration = await prisma.videoGeneration.findUnique({
        where: { id: generationId }
      })
    } else {
      existingGeneration = await prisma.generation.findUnique({
        where: { id: generationId }
      })
    }

    if (!existingGeneration) {
      logger.error(`${isVideoJob ? 'VideoGeneration' : 'Generation'} not found in database`, undefined, {
        service: 'polling-service',
        action: 'generation_not_found',
        generationId,
        jobType
      })
      return
    }

    if (existingGeneration.status === 'COMPLETED') {
      logger.info(`${isVideoJob ? 'VideoGeneration' : 'Generation'} already completed, skipping polling`, {
        service: 'polling-service',
        action: 'already_completed',
        generationId,
        jobType
      })
      return
    }

    logger.info(`${isVideoJob ? 'VideoGeneration' : 'Generation'} status check`, {
      service: 'polling-service',
      action: 'status_check',
      generationId,
      currentStatus: existingGeneration.status,
      jobType
    })
  } catch (error) {
    logger.error('Failed to check generation status', error as Error, {
      service: 'polling-service',
      action: 'status_check_error',
      generationId
    })
  }

  // Stop existing polling for this prediction if any
  stopPolling(predictionId)

  const job: PollingJob = {
    predictionId,
    generationId,
    userId,
    provider,
    jobType,
    maxAttempts,
    attempts: 0,
    intervalMs,
    maxTimeout,
    startTime: new Date()
  }

  activePollingJobs.set(predictionId, job)

  // Start the polling loop
  await pollPrediction(job)
}

/**
 * Stop polling for a specific prediction
 */
export function stopPolling(predictionId: string) {
  const job = activePollingJobs.get(predictionId)
  if (job?.timeoutId) {
    clearTimeout(job.timeoutId)
    activePollingJobs.delete(predictionId)
    logger.info('Stopped polling for prediction', {
      service: 'polling-service',
      action: 'stop_polling',
      predictionId
    })
  }
}

/**
 * Poll a single prediction and handle the response
 */
async function pollPrediction(job: PollingJob) {
  const { predictionId, generationId, userId } = job

  try {
    job.attempts++

    // Determine if this is a video job early for timeout handling
    const isVideoJob = job.jobType === 'video'

    logger.debug('Polling attempt', {
      service: 'polling-service',
      action: 'poll_attempt',
      predictionId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      provider: job.provider,
      jobType: job.jobType
    })

    // Check if job has timed out
    const elapsed = Date.now() - job.startTime.getTime()
    if (elapsed > job.maxTimeout) {
      logger.warn('Job polling timeout reached', {
        service: 'polling-service',
        action: 'job_timeout',
        predictionId,
        elapsed,
        maxTimeout: job.maxTimeout
      })

      await handleJobTimeout(job, isVideoJob)
      return
    }

    // Check if max attempts reached
    if (job.attempts >= job.maxAttempts) {
      logger.warn('Job polling max attempts reached', {
        service: 'polling-service',
        action: 'max_attempts',
        predictionId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      })

      await handleJobTimeout(job, isVideoJob)
      return
    }

    const aiProvider = getAIProvider()
    if (!aiProvider) {
      throw new Error('AI provider not available')
    }

    logger.debug('Using AI provider', {
      service: 'polling-service',
      action: 'provider_check',
      provider: job.provider
    })

    // Get prediction status from provider
    let prediction: any
    if (job.provider === 'astria') {
      // Get generation to extract tune_id from metadata
      const generationWithMetadata = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { astriaEnhancements: true }
      })

      const tuneId = generationWithMetadata?.astriaEnhancements?.tune_id
      logger.debug('Extracted tune_id for Astria polling', {
        service: 'polling-service',
        action: 'astria_tune_id',
        tuneId: tuneId || 'none'
      })

      prediction = await aiProvider.getGenerationStatus(predictionId, tuneId)
    } else {
      prediction = await aiProvider.getPredictionStatus(predictionId)
    }

    const urlCount = prediction.urls ? prediction.urls.length : 0
    logger.debug('Polling response received', {
      service: 'polling-service',
      action: 'poll_response',
      predictionId,
      provider: job.provider,
      status: prediction.status,
      hasUrls: !!prediction.urls,
      urlCount,
      hasOutput: !!prediction.output
    })

    // Find the record in database (Generation or VideoGeneration based on jobType)
    let generation: any

    if (isVideoJob) {
      // For video jobs, look in VideoGeneration table
      generation = await prisma.videoGeneration.findUnique({
        where: { id: generationId },
        include: {
          user: {
            select: { id: true, email: true }
          }
        }
      })
    } else {
      // For other jobs, look in Generation table
      generation = await prisma.generation.findUnique({
        where: { id: generationId },
        include: {
          user: {
            select: { id: true, email: true }
          },
          model: {
            select: { name: true }
          }
        }
      })
    }

    if (!generation) {
      logger.error(`${isVideoJob ? 'VideoGeneration' : 'Generation'} not found during polling`, undefined, {
        service: 'polling-service',
        action: 'record_not_found',
        generationId,
        jobType: job.jobType
      })
      stopPolling(predictionId)
      return
    }

    // 🎯 PROVIDER AUTO-DETECTION: Ensure we use the correct provider criteria
    let effectiveProvider = job.provider

    // Auto-detect provider from job ID pattern if hybrid or replicate is set but job ID suggests Astria
    if ((job.provider === 'hybrid' || job.provider === 'replicate') &&
        /^\d+$/.test(String(job.predictionId)) &&
        String(job.predictionId).length > 6) {
      effectiveProvider = 'astria'
      console.log(`🔧 [PROVIDER_FIX] Auto-detected Astria provider from numeric job ID: ${job.predictionId}`)
    }

    // Check if job should stop based on provider-specific criteria
    console.log(`🔍 [POLLING_DEBUG] Checking stop criteria:`, {
      predictionId: job.predictionId,
      jobProvider: job.provider,
      effectiveProvider,
      hasImages: prediction.images ? prediction.images.length : 0,
      hasUrls: prediction.urls ? prediction.urls.length : 0,
      responseStatus: prediction.status
    })

    const stopCheck = shouldStopPolling(effectiveProvider, prediction)

    console.log(`📊 [POLLING_DEBUG] Stop check result:`, {
      predictionId: job.predictionId,
      shouldStop: stopCheck.shouldStop,
      reason: stopCheck.reason,
      status: stopCheck.status,
      urlCount: stopCheck.urls.length
    })

    if (stopCheck.shouldStop) {
      logger.info('Job polling stopped - criteria met', {
        service: 'polling-service',
        action: 'stop_criteria_met',
        predictionId,
        reason: stopCheck.reason,
        status: stopCheck.status,
        urlCount: stopCheck.urls.length
      })

      // Update job provider if we detected a different effective provider
      if (effectiveProvider !== job.provider) {
        const oldProvider = job.provider
        job.provider = effectiveProvider
        console.log(`🔧 [PROVIDER_FIX] Updated job provider from '${oldProvider}' to '${effectiveProvider}'`)
      }

      await handleJobCompletion(job, stopCheck.status, stopCheck.urls, prediction, isVideoJob)
      return
    }

    // Continue polling if criteria not met
    logger.debug('Job still processing - continuing poll', {
      service: 'polling-service',
      action: 'continue_polling',
      predictionId,
      reason: stopCheck.reason,
      nextAttemptIn: job.intervalMs
    })

    scheduleNextPoll(job)
    return

    // This section is now handled by the centralized stop criteria above
    // Legacy status handling is removed in favor of shouldStopPolling logic

    // This section is now handled by the centralized completion logic above

  } catch (error) {
    logger.error('Polling error for prediction', error as Error, {
      service: 'polling-service',
      action: 'poll_error',
      predictionId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    })

    // Check if we should retry or give up
    if (job.attempts >= job.maxAttempts) {
      await handleJobTimeout(job, isVideoJob)
    } else {
      // Retry with exponential backoff
      const backoffMs = Math.min(job.intervalMs * Math.pow(1.5, job.attempts), 30000) // Max 30s
      logger.info('Retrying polling with backoff', {
        service: 'polling-service',
        action: 'retry_with_backoff',
        predictionId,
        backoffMs,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      })

      job.timeoutId = setTimeout(() => {
        pollPrediction(job)
      }, backoffMs)
    }
  }
}

/**
 * Schedule the next polling attempt
 */
function scheduleNextPoll(job: PollingJob) {
  if (job.attempts >= job.maxAttempts) {
    logger.error('Max polling attempts reached', undefined, {
      service: 'polling-service',
      action: 'max_attempts_reached',
      predictionId: job.predictionId
    })
    stopPolling(job.predictionId)
    return
  }

  job.timeoutId = setTimeout(() => {
    pollPrediction(job)
  }, job.intervalMs)
}

/**
 * Get status of all active polling jobs
 */
export function getPollingStatus() {
  const jobs = Array.from(activePollingJobs.values()).map(job => ({
    predictionId: job.predictionId,
    generationId: job.generationId,
    userId: job.userId,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    intervalMs: job.intervalMs
  }))

  return {
    activeJobs: jobs.length,
    jobs
  }
}

/**
 * Stop all polling jobs (useful for cleanup)
 */
export function stopAllPolling() {
  logger.info('Stopping all polling jobs', {
    service: 'polling-service',
    action: 'stop_all_polling',
    jobCount: activePollingJobs.size
  })

  for (const [predictionId] of activePollingJobs) {
    stopPolling(predictionId)
  }
}

/**
 * Handle job completion (success or failure)
 */
async function handleJobCompletion(job: PollingJob, status: string, urls: string[], response: any, isVideoJob = false) {
  const { predictionId, generationId, userId } = job

  try {
    if (status === 'succeeded' && urls.length > 0) {
      let storageResult: any

      if (isVideoJob) {
        // CRITICAL: Check if video was already processed by webhook to avoid duplication
        const existingVideo = await prisma.videoGeneration.findUnique({
          where: { id: generationId },
          select: { status: true, videoUrl: true, metadata: true }
        })
        
        // Check if already completed with permanent URL
        if (existingVideo?.status === 'COMPLETED' && existingVideo.videoUrl) {
          const metadata = existingVideo.metadata as any
          const isPermanentUrl = existingVideo.videoUrl.includes('amazonaws.com') || 
                                existingVideo.videoUrl.includes('cloudfront.net') ||
                                existingVideo.videoUrl.includes('s3') ||
                                metadata?.stored === true
          
          if (isPermanentUrl) {
            console.log(`⏭️ [POLLING_VIDEO] Video ${generationId} already completed and stored by webhook, skipping polling storage`)
            logger.info('Video already completed by webhook with permanent URL, skipping polling', {
              service: 'polling-service',
              action: 'video_already_completed',
              generationId,
              videoUrl: existingVideo.videoUrl.substring(0, 50) + '...'
            })
            return // Skip processing - webhook already handled it
          }
        }
        
        // Use video-specific storage function
        console.log(`🎬 [POLLING_VIDEO] Processing video job with URL: ${urls[0]}`)
        storageResult = await downloadAndStoreVideo(urls[0], generationId, userId)

        // Convert to expected format
        if (storageResult.success) {
          storageResult.permanentUrls = [storageResult.videoUrl]
          storageResult.thumbnailUrls = storageResult.thumbnailUrl ? [storageResult.thumbnailUrl] : [storageResult.videoUrl]
        }
      } else {
        // Use image storage function
        storageResult = await downloadAndStoreImages(
          urls,
          generationId,
          userId,
          'generated'
        )
      }

      let updateData: any

      if (isVideoJob) {
        // VideoGeneration table update
        updateData = {
          status: 'COMPLETED'
        }

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          updateData.videoUrl = storageResult.permanentUrls[0] // Video is usually a single file
          updateData.thumbnailUrl = storageResult.thumbnailUrls?.[0] || storageResult.permanentUrls[0]
          updateData.storageProvider = 'aws'
          updateData.publicUrl = storageResult.permanentUrls[0]
          updateData.storageKey = `videos/${generationId}.mp4`

          logger.info('Video job completed successfully with storage', {
            service: 'polling-service',
            action: 'video_success',
            predictionId,
            videoUrl: storageResult.permanentUrls[0],
            attempts: job.attempts
          })
        } else {
          // Storage failed, use temporary URLs
          updateData.videoUrl = urls[0]
          updateData.publicUrl = urls[0]
          updateData.storageProvider = 'temporary'
          updateData.errorMessage = 'Warning: Storage failed, video may expire'

          logger.warn('Video job completed but storage failed', {
            service: 'polling-service',
            action: 'video_storage_failed',
            predictionId,
            error: storageResult.error
          })
        }
      } else {
        // Generation table update (existing logic)
        updateData = {
          status: 'COMPLETED',
          completedAt: new Date(),
          aiProvider: job.provider
        }

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          updateData.imageUrls = storageResult.permanentUrls
          updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
          updateData.storageProvider = 'aws'
          updateData.metadata = {
            originalUrls: urls,
            processedAt: new Date().toISOString(),
            storageProvider: 'aws',
            processedVia: 'polling'
          }

          logger.info('Job completed successfully with storage', {
            service: 'polling-service',
            action: 'job_success',
            predictionId,
            imageCount: storageResult.permanentUrls.length,
            attempts: job.attempts
          })
        } else {
          // Storage failed, use temporary URLs
          updateData.imageUrls = urls
          updateData.thumbnailUrls = urls
          updateData.storageProvider = 'temporary'
          updateData.errorMessage = 'Warning: Storage failed, images may expire'

          logger.warn('Job completed but storage failed', {
            service: 'polling-service',
            action: 'job_storage_failed',
            predictionId,
            error: storageResult.error
          })
        }
      }

      // Update database with the correct table
      if (isVideoJob) {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: updateData
        })
      } else {
        // Calculate processing time for Generation table
        const generation = await prisma.generation.findUnique({
          where: { id: generationId },
          select: {
            createdAt: true,
            resolution: true,
            variations: true,
            prompt: true,
            metadata: true
          }
        })
        if (generation) {
          updateData.processingTime = new Date().getTime() - new Date(generation.createdAt).getTime()

          // NOTE: Credits are already debited and transaction created on generation creation
          // (src/lib/db/generations.ts) - no need to do anything here
          logger.info('Generation completed - credits already debited', {
            service: 'polling-service',
            action: 'generation_completed',
            generationId
          })
        }

        await prisma.generation.update({
          where: { id: generationId },
          data: updateData
        })
      }

      // Broadcast completion
      await broadcastGenerationStatusChange(
        generationId,
        userId,
        'succeeded',
        {
          imageUrls: updateData.imageUrls || [],
          thumbnailUrls: updateData.thumbnailUrls || [],
          processingTime: updateData.processingTime
        }
      )
    } else {
      // Job failed or no URLs
      const updateData: any = {
        status: 'FAILED',
        errorMessage: response.error || 'No URLs returned'
      }

      if (!isVideoJob) {
        updateData.completedAt = new Date()
        updateData.aiProvider = job.provider
      }

      // Update the correct table
      if (isVideoJob) {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: updateData
        })
      } else {
        await prisma.generation.update({
          where: { id: generationId },
          data: updateData
        })
      }

      // Broadcast failure
      await broadcastGenerationStatusChange(
        generationId,
        userId,
        'failed',
        { errorMessage: updateData.errorMessage }
      )

      logger.warn('Job completed with failure', {
        service: 'polling-service',
        action: 'job_failed',
        predictionId,
        status,
        errorMessage: updateData.errorMessage
      })
    }
  } catch (error) {
    logger.error('Error handling job completion', error as Error, {
      service: 'polling-service',
      action: 'completion_error',
      predictionId
    })
  } finally {
    // Always stop polling this job
    stopPolling(predictionId)
  }
}

/**
 * Handle job timeout
 */
async function handleJobTimeout(job: PollingJob, isVideoJob: boolean) {
  const { predictionId, generationId, userId } = job

  try {
    const timeoutMessage = getTimeoutMessage(job.provider, job.jobType)

    const updateData: any = {
      status: 'FAILED',
      errorMessage: timeoutMessage
    }

    if (!isVideoJob) {
      updateData.completedAt = new Date()
    }

    // Update the correct table based on job type
    if (isVideoJob) {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: updateData
      })
    } else {
      await prisma.generation.update({
        where: { id: generationId },
        data: updateData
      })
    }

    // Broadcast timeout failure
    await broadcastGenerationStatusChange(
      generationId,
      userId,
      'failed',
      { errorMessage: timeoutMessage }
    )

    logger.warn('Job timed out', {
      service: 'polling-service',
      action: 'job_timeout',
      predictionId,
      jobType: job.jobType,
      provider: job.provider,
      attempts: job.attempts,
      duration: Date.now() - job.startTime.getTime()
    })
  } catch (error) {
    logger.error('Error handling job timeout', error as Error, {
      service: 'polling-service',
      action: 'timeout_error',
      predictionId
    })
  } finally {
    stopPolling(predictionId)
  }
}