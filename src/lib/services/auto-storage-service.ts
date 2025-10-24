import { prisma } from '@/lib/db'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { ReplicateProvider } from '@/lib/ai/providers/replicate'
import { AstriaProvider } from '@/lib/ai/providers/astria'
import { isReplicateStatusCompleted, isReplicateStatusFailed } from '@/lib/utils/status-mapping'
import { logger } from '@/lib/monitoring/logger'
import {
  ActiveJob,
  JobType,
  ProviderType,
  getJobTimeout,
  getPollingInterval,
  getMaxAttempts,
  getTimeoutMessage,
  shouldStopPolling
} from './polling-config'

/**
 * Auto Storage Service - Job-specific polling for image storage
 * Replaces global polling with targeted job monitoring
 */
export class AutoStorageService {
  private static instance: AutoStorageService
  private activeJobs = new Map<string, ActiveJob>()
  private isRunning = false

  static getInstance(): AutoStorageService {
    if (!this.instance) {
      this.instance = new AutoStorageService()
    }
    return this.instance
  }

  /**
   * Start monitoring a specific job for completion
   */
  startJobPolling(
    jobId: string,
    type: JobType,
    provider: ProviderType,
    userId: string,
    generationId?: string,
    modelId?: string
  ): { success: boolean; message: string } {
    // Prevent duplicate polling for same job
    if (this.activeJobs.has(jobId)) {
      logger.info('Job polling already active', {
        service: 'auto-storage',
        action: 'start_job_blocked',
        jobId,
        provider,
        type
      })
      return { success: true, message: 'Job already being polled' }
    }

    const maxTimeout = getJobTimeout(provider, type)
    const intervalMs = getPollingInterval(provider)
    const maxAttempts = getMaxAttempts(provider, type)

    const job: ActiveJob = {
      jobId,
      type,
      provider,
      generationId,
      modelId,
      userId,
      startTime: new Date(),
      maxTimeout,
      intervalMs,
      attempts: 0,
      maxAttempts
    }

    this.activeJobs.set(jobId, job)
    this.isRunning = true

    logger.info('Started job-specific polling', {
      service: 'auto-storage',
      action: 'start_job_polling',
      jobId,
      type,
      provider,
      maxTimeout,
      intervalMs,
      maxAttempts
    })

    // Start polling this specific job
    this.pollJob(job)

    return { success: true, message: `Started polling job ${jobId}` }
  }

  /**
   * Stop polling a specific job
   */
  stopJobPolling(jobId: string): { success: boolean; message: string } {
    const job = this.activeJobs.get(jobId)
    if (!job) {
      return { success: false, message: 'Job not found' }
    }

    if (job.timeoutId) {
      clearTimeout(job.timeoutId)
    }

    this.activeJobs.delete(jobId)

    logger.info('Stopped job polling', {
      service: 'auto-storage',
      action: 'stop_job_polling',
      jobId,
      type: job.type,
      provider: job.provider,
      attempts: job.attempts,
      duration: Date.now() - job.startTime.getTime()
    })

    // If no more active jobs, mark service as not running
    if (this.activeJobs.size === 0) {
      this.isRunning = false
      logger.info('No more active jobs - auto storage service idle', {
        service: 'auto-storage',
        action: 'service_idle'
      })
    }

    return { success: true, message: `Stopped polling job ${jobId}` }
  }

  /**
   * Legacy method for compatibility - now manages job-specific polling
   */
  startMonitoring() {
    logger.info('Legacy startMonitoring called - use startJobPolling for specific jobs', {
      service: 'auto-storage',
      action: 'legacy_start',
      activeJobs: this.activeJobs.size
    })
    return { success: true, message: 'Use startJobPolling for specific jobs' }
  }

  /**
   * Stop all active job polling
   */
  stopMonitoring() {
    const jobCount = this.activeJobs.size

    // Stop all active jobs
    for (const [jobId] of this.activeJobs) {
      this.stopJobPolling(jobId)
    }

    this.isRunning = false

    logger.info('Stopped all job polling', {
      service: 'auto-storage',
      action: 'stop_all',
      jobsStopped: jobCount
    })
  }

  /**
   * Poll a specific job until completion or timeout
   */
  private async pollJob(job: ActiveJob) {
    job.attempts++

    try {
      logger.debug('Polling job attempt', {
        service: 'auto-storage',
        action: 'poll_attempt',
        jobId: job.jobId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        type: job.type,
        provider: job.provider
      })

      // Check if job has timed out
      const elapsed = Date.now() - job.startTime.getTime()
      if (elapsed > job.maxTimeout) {
        logger.warn('Job polling timeout reached', {
          service: 'auto-storage',
          action: 'job_timeout',
          jobId: job.jobId,
          elapsed,
          maxTimeout: job.maxTimeout,
          type: job.type,
          provider: job.provider
        })

        await this.handleJobTimeout(job)
        return
      }

      // Check if max attempts reached
      if (job.attempts >= job.maxAttempts) {
        logger.warn('Job polling max attempts reached', {
          service: 'auto-storage',
          action: 'max_attempts',
          jobId: job.jobId,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts
        })

        await this.handleJobTimeout(job)
        return
      }

      // Get provider instance
      let provider: ReplicateProvider | AstriaProvider
      if (job.provider === 'astria') {
        provider = new AstriaProvider()
      } else {
        provider = new ReplicateProvider()
      }

      // Check job status
      let statusResponse
      try {
        statusResponse = await provider.getGenerationStatus(job.jobId)
      } catch (error: any) {
        // Handle 404 errors for expired/non-existent jobs
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          logger.warn('Job not found - may have expired', {
            service: 'auto-storage',
            action: 'job_not_found',
            jobId: job.jobId,
            error: error.message
          })

          await this.handleJobNotFound(job)
          return
        }

        throw error
      }

      // Check if job should stop based on provider-specific criteria
      const stopCheck = shouldStopPolling(job.provider, statusResponse)

      if (stopCheck.shouldStop) {
        logger.info('Job polling stopped - criteria met', {
          service: 'auto-storage',
          action: 'stop_criteria_met',
          jobId: job.jobId,
          reason: stopCheck.reason,
          status: stopCheck.status,
          urlCount: stopCheck.urls.length
        })

        await this.handleJobCompletion(job, stopCheck.status, stopCheck.urls, statusResponse)
        return
      }

      // Continue polling - schedule next attempt
      logger.debug('Job still processing - continuing poll', {
        service: 'auto-storage',
        action: 'continue_polling',
        jobId: job.jobId,
        reason: stopCheck.reason,
        nextAttemptIn: job.intervalMs
      })

      job.timeoutId = setTimeout(() => {
        this.pollJob(job)
      }, job.intervalMs)

    } catch (error) {
      logger.error('Error polling job', error as Error, {
        service: 'auto-storage',
        action: 'poll_error',
        jobId: job.jobId,
        attempts: job.attempts,
        type: job.type,
        provider: job.provider
      })

      // Retry with exponential backoff up to max attempts
      if (job.attempts < job.maxAttempts) {
        const backoffMs = Math.min(job.intervalMs * Math.pow(1.5, job.attempts), 30000)
        logger.info('Retrying job poll with backoff', {
          service: 'auto-storage',
          action: 'retry_with_backoff',
          jobId: job.jobId,
          backoffMs,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts
        })

        job.timeoutId = setTimeout(() => {
          this.pollJob(job)
        }, backoffMs)
      } else {
        logger.error('Job polling failed - max attempts reached', undefined, {
          service: 'auto-storage',
          action: 'polling_failed',
          jobId: job.jobId,
          attempts: job.attempts
        })

        await this.handleJobTimeout(job)
      }
    }
  }

  /**
   * Handle job completion (success or failure)
   */
  private async handleJobCompletion(job: ActiveJob, status: string, urls: string[], response: any) {
    try {
      if (status === 'succeeded' && urls.length > 0) {
        // Download and store images
        const storageResult = await downloadAndStoreImages(
          urls,
          job.generationId || job.jobId,
          job.userId,
          job.type === 'upscale' ? 'upscaled' : 'generated'
        )

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          // Update generation/model in database
          await this.updateDatabaseRecord(job, 'COMPLETED', storageResult, response)

          logger.info('Job completed successfully with storage', {
            service: 'auto-storage',
            action: 'job_success',
            jobId: job.jobId,
            type: job.type,
            imageCount: storageResult.permanentUrls.length,
            attempts: job.attempts,
            duration: Date.now() - job.startTime.getTime()
          })
        } else {
          // Storage failed, but we have URLs
          await this.updateDatabaseRecord(job, 'COMPLETED', { permanentUrls: urls, error: storageResult.error }, response)

          logger.warn('Job completed but storage failed', {
            service: 'auto-storage',
            action: 'job_storage_failed',
            jobId: job.jobId,
            error: storageResult.error,
            temporaryUrls: urls.length
          })
        }
      } else {
        // Job failed or no URLs
        await this.updateDatabaseRecord(job, 'FAILED', null, response)

        logger.warn('Job completed with failure', {
          service: 'auto-storage',
          action: 'job_failed',
          jobId: job.jobId,
          status,
          errorMessage: response.error || 'No URLs returned'
        })
      }
    } catch (error) {
      logger.error('Error handling job completion', error as Error, {
        service: 'auto-storage',
        action: 'completion_error',
        jobId: job.jobId
      })
    } finally {
      // Always stop polling this job
      this.stopJobPolling(job.jobId)
    }
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(job: ActiveJob) {
    try {
      const timeoutMessage = getTimeoutMessage(job.provider, job.type)

      await this.updateDatabaseRecord(job, 'FAILED', null, { error: timeoutMessage })

      logger.warn('Job timed out', {
        service: 'auto-storage',
        action: 'job_timeout',
        jobId: job.jobId,
        type: job.type,
        provider: job.provider,
        attempts: job.attempts,
        duration: Date.now() - job.startTime.getTime()
      })
    } catch (error) {
      logger.error('Error handling job timeout', error as Error, {
        service: 'auto-storage',
        action: 'timeout_error',
        jobId: job.jobId
      })
    } finally {
      this.stopJobPolling(job.jobId)
    }
  }

  /**
   * Handle job not found (404)
   */
  private async handleJobNotFound(job: ActiveJob) {
    try {
      // Check if generation/model already has permanent URLs
      const hasExistingData = await this.checkExistingData(job)

      if (hasExistingData) {
        logger.info('Job not found but has existing data - keeping current status', {
          service: 'auto-storage',
          action: 'job_not_found_but_preserved',
          jobId: job.jobId
        })
      } else {
        await this.updateDatabaseRecord(job, 'FAILED', null, { error: 'Job expired or not found' })

        logger.warn('Job not found and no existing data', {
          service: 'auto-storage',
          action: 'job_not_found_failed',
          jobId: job.jobId
        })
      }
    } catch (error) {
      logger.error('Error handling job not found', error as Error, {
        service: 'auto-storage',
        action: 'not_found_error',
        jobId: job.jobId
      })
    } finally {
      this.stopJobPolling(job.jobId)
    }
  }

  /**
   * Update database record (generation or model)
   */
  private async updateDatabaseRecord(job: ActiveJob, status: string, storageResult: any, response: any) {
    const updateData: any = {
      status,
      completedAt: new Date(),
      updatedAt: new Date()
    }

    if (storageResult?.permanentUrls) {
      updateData.imageUrls = storageResult.permanentUrls
      updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
    }

    if (response?.error) {
      updateData.errorMessage = response.error
    }

    if (response?.processingTime) {
      updateData.processingTime = response.processingTime
    }

    // Update generation or model based on job type
    if (job.type === 'training' && job.modelId) {
      await prisma.aIModel.update({
        where: { id: job.modelId },
        data: {
          status: status === 'COMPLETED' ? 'READY' : status === 'FAILED' ? 'ERROR' : status,
          trainedAt: status === 'COMPLETED' ? new Date() : undefined,
          errorMessage: updateData.errorMessage,
          modelUrl: response?.output || response?.result,
          updatedAt: new Date()
        }
      })
    } else if (job.generationId) {
      await prisma.generation.update({
        where: { id: job.generationId },
        data: updateData
      })
    }
  }

  /**
   * Check if generation/model already has existing data
   */
  private async checkExistingData(job: ActiveJob): Promise<boolean> {
    try {
      if (job.type === 'training' && job.modelId) {
        const model = await prisma.aIModel.findUnique({
          where: { id: job.modelId },
          select: { status: true, modelUrl: true }
        })
        return model?.status === 'READY' && !!model.modelUrl
      } else if (job.generationId) {
        const generation = await prisma.generation.findUnique({
          where: { id: job.generationId },
          select: { status: true, imageUrls: true }
        })

        if (generation?.status === 'COMPLETED' && generation.imageUrls && generation.imageUrls.length > 0) {
          // Check if URLs are permanent (not temporary)
          const hasPermanentUrls = !generation.imageUrls.some((url: string) =>
            url.includes('replicate.delivery') ||
            url.includes('pbxt.replicate.delivery') ||
            url.includes('mp.astria.ai') ||
            url.includes('cdn.astria.ai') ||
            url.includes('tmp.astria.ai')
          )
          return hasPermanentUrls
        }
      }
      return false
    } catch (error) {
      logger.error('Error checking existing data', error as Error, {
        service: 'auto-storage',
        action: 'check_existing_error',
        jobId: job.jobId
      })
      return false
    }
  }

  /**
   * Get status of all active jobs
   */
  getActiveJobs(): { jobId: string; type: JobType; provider: ProviderType; attempts: number; startTime: Date }[] {
    return Array.from(this.activeJobs.values()).map(job => ({
      jobId: job.jobId,
      type: job.type,
      provider: job.provider,
      attempts: job.attempts,
      startTime: job.startTime
    }))
  }

  /**
   * Recovery mechanism - checks for orphaned jobs (PROCESSING in DB but not actively polled)
   * Only used as fallback when webhooks fail or polling gets interrupted
   */
  async checkOrphanedJobs(): Promise<{ checked: number; recovered: number }> {
    const startTime = Date.now()

    try {
      logger.info('Starting orphaned jobs recovery check', {
        service: 'auto-storage',
        action: 'orphan_check_start',
        activeJobs: this.activeJobs.size
      })

      // Only check jobs that are PROCESSING for >5 minutes and not currently being polled
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const maxAge = new Date(Date.now() - 24 * 60 * 60 * 1000) // Don't check jobs older than 24h

      // Get currently polled jobIds to exclude them
      const activeJobIds = Array.from(this.activeJobs.keys())

      const orphanedGenerations = await prisma.generation.findMany({
        where: {
          status: 'PROCESSING',
          jobId: { not: null, notIn: activeJobIds },
          updatedAt: { lt: fiveMinutesAgo, gte: maxAge }
        },
        select: {
          id: true,
          jobId: true,
          userId: true,
          aiProvider: true,
          updatedAt: true
        },
        take: 5 // Limit to prevent overload
      })

      const orphanedModels = await prisma.aIModel.findMany({
        where: {
          status: 'TRAINING',
          jobId: { not: null, notIn: activeJobIds },
          updatedAt: { lt: fiveMinutesAgo, gte: maxAge }
        },
        select: {
          id: true,
          jobId: true,
          userId: true,
          updatedAt: true
        },
        take: 3 // Limit more for training as they're heavier
      })

      let recovered = 0

      // Recover orphaned generations
      for (const generation of orphanedGenerations) {
        if (!generation.jobId) continue

        const provider = (generation.aiProvider || 'replicate') as ProviderType

        logger.info('Recovering orphaned generation', {
          service: 'auto-storage',
          action: 'recover_generation',
          generationId: generation.id,
          jobId: generation.jobId,
          provider
        })

        this.startJobPolling(
          generation.jobId,
          'generation',
          provider,
          generation.userId,
          generation.id
        )

        recovered++
      }

      // Recover orphaned models
      for (const model of orphanedModels) {
        if (!model.jobId) continue

        logger.info('Recovering orphaned model', {
          service: 'auto-storage',
          action: 'recover_model',
          modelId: model.id,
          jobId: model.jobId
        })

        this.startJobPolling(
          model.jobId,
          'training',
          'replicate', // Most training is on Replicate
          model.userId,
          undefined,
          model.id
        )

        recovered++
      }

      const duration = Date.now() - startTime
      const checked = orphanedGenerations.length + orphanedModels.length

      logger.info('Orphaned jobs recovery completed', {
        service: 'auto-storage',
        action: 'orphan_check_completed',
        checked,
        recovered,
        duration
      })

      return { checked, recovered }

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Error in orphaned jobs recovery', error as Error, {
        service: 'auto-storage',
        action: 'orphan_recovery_error',
        duration
      })
      return { checked: 0, recovered: 0 }
    }
  }

  /**
   * Legacy method - redirects to orphaned jobs check
   */
  async checkAndSaveImages() {
    logger.info('Legacy checkAndSaveImages called - redirecting to orphaned jobs recovery', {
      service: 'auto-storage',
      action: 'legacy_redirect'
    })

    return await this.checkOrphanedJobs()
  }

  /**
   * Check and save edited images that need permanent storage (legacy method)
   */
  async checkAndSaveEditedImages(): Promise<{ checked: number; processed: number }> {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

      logger.debug('Starting edited images check', {
        service: 'auto-storage',
        action: 'edited_images_check_start',
        timeWindow: 'last_2_hours'
      })

      // Find recent edit history entries with temporary URLs
      const editedImages = await prisma.editHistory.findMany({
        where: {
          AND: [
            { createdAt: { gte: twoHoursAgo } },
            {
              OR: [
                { editedImageUrl: { contains: 'replicate.delivery' } },
                { editedImageUrl: { contains: 'pbxt.replicate.delivery' } },
                { editedImageUrl: { contains: 'mp.astria.ai' } },
                { editedImageUrl: { contains: 'cdn.astria.ai' } },
                { editedImageUrl: { contains: 'tmp.astria.ai' } }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Process up to 10 edited images per cycle
      })

      if (editedImages.length === 0) {
        logger.debug('No edited images requiring storage processing', {
          service: 'auto-storage',
          action: 'edited_images_check',
          result: 'no-work'
        })
        return { checked: 0, processed: 0 }
      }

      let processed = 0

      for (const editedImage of editedImages) {
        try {
          // Download and store the edited image permanently
          const storageResult = await downloadAndStoreImages(
            [editedImage.editedImageUrl],
            editedImage.id,
            editedImage.userId,
            'edited' // Use 'edited' as subfolder
          )

          if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
            // Update edit history with permanent URL
            await prisma.editHistory.update({
              where: { id: editedImage.id },
              data: {
                editedImageUrl: storageResult.permanentUrls[0],
                thumbnailUrl: storageResult.thumbnailUrls?.[0] || storageResult.permanentUrls[0],
                updatedAt: new Date()
              }
            })

            processed++

            logger.info('✅ Edited image successfully saved to permanent storage', {
              editId: editedImage.id,
              action: 'edited_image_storage_success'
            })
          } else {
            logger.error('❌ Failed to store edited image permanently', undefined, {
              editId: editedImage.id,
              error: storageResult.error,
              action: 'edited_image_storage_failed'
            })
          }
        } catch (error) {
          logger.error('❌ Error processing edited image storage', error as Error, {
            editId: editedImage.id,
            action: 'edited_image_error'
          })
        }
      }

      return { checked: editedImages.length, processed }

    } catch (error) {
      logger.error('❌ Error checking edited images', error as Error, {
        service: 'auto-storage',
        action: 'edited_images_check_error'
      })
      return { checked: 0, processed: 0 }
    }
  }

  /**
   * Force check and save a specific generation
   */
  async forceCheckGeneration(generationId: string): Promise<boolean> {
    try {
      const generation = await prisma.generation.findUnique({
        where: { id: generationId }
      })

      if (!generation || !generation.jobId) {
        return false
      }

      // Detect which AI provider to use based on generation's aiProvider field
      const providerName = (generation as any).aiProvider || 'replicate' // Default to replicate for backward compatibility
      let provider: ReplicateProvider | AstriaProvider

      if (providerName === 'astria') {
        provider = new AstriaProvider()
      } else {
        provider = new ReplicateProvider()
      }

      const status = await provider.getGenerationStatus(generation.jobId)

      // Get image URLs from provider response (Replicate uses 'result', Astria uses 'urls')
      const imageUrls = status.result || status.urls

      if (isReplicateStatusCompleted(status.status) && imageUrls && Array.isArray(imageUrls)) {
        const storageResult = await downloadAndStoreImages(
          imageUrls,
          generation.id,
          generation.userId
        )

        if (storageResult.success && storageResult.permanentUrls) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              imageUrls: storageResult.permanentUrls,
              thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
              completedAt: new Date()
            }
          })
          return true
        }
      }

      return false
    } catch (error) {
      console.error(`Error force checking generation ${generationId}:`, error)
      return false
    }
  }

}