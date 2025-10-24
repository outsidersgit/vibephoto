import { getAIProvider } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

interface TrainingPollingJob {
  trainingId: string
  modelId: string
  userId: string
  maxAttempts: number
  attempts: number
  intervalMs: number
  timeoutId?: NodeJS.Timeout
}

// Active training polling jobs
const activeTrainingJobs = new Map<string, TrainingPollingJob>()

/**
 * Start polling a training job until completion (supports multiple AI providers)
 */
export async function startTrainingPolling(
  trainingId: string,
  modelId: string,
  userId: string,
  maxAttempts: number = 240, // 20 minutes at 5s intervals (training takes longer)
  intervalMs: number = 5000   // 5 seconds
) {
  const currentProvider = process.env.AI_PROVIDER || 'replicate'
  console.log(`🔄 Starting training polling for ${currentProvider} training ${trainingId}`)

  // Stop existing polling for this training if any
  stopTrainingPolling(trainingId)

  const job: TrainingPollingJob = {
    trainingId,
    modelId,
    userId,
    maxAttempts,
    attempts: 0,
    intervalMs
  }

  activeTrainingJobs.set(trainingId, job)

  // Start the polling loop
  await pollTraining(job)
}

/**
 * Stop polling for a specific training
 */
export function stopTrainingPolling(trainingId: string) {
  const job = activeTrainingJobs.get(trainingId)
  if (job?.timeoutId) {
    clearTimeout(job.timeoutId)
  }
  activeTrainingJobs.delete(trainingId)
}

/**
 * Poll a single training and handle the response
 */
async function pollTraining(job: TrainingPollingJob) {
  const { trainingId, modelId, userId } = job

  try {
    job.attempts++
    console.log(`📡 Training polling attempt ${job.attempts}/${job.maxAttempts} for training ${trainingId}`)

    const aiProvider = getAIProvider()
    if (!aiProvider) {
      throw new Error('AI provider not available')
    }

    // Get training status from current AI provider
    const currentProvider = process.env.AI_PROVIDER || 'replicate'
    const training = currentProvider === 'astria'
      ? await aiProvider.getTrainingStatus(trainingId)
      : await aiProvider.getTrainingStatus(trainingId)

    console.log(`📊 ${currentProvider} training status: ${training.status}`)

    // Find the model in database
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    })

    if (!model) {
      console.error(`❌ Model ${modelId} not found`)
      stopTrainingPolling(trainingId)
      return
    }

    // Handle different statuses (supports both Replicate and Astria)
    const updateData: any = {}

    switch (training.status) {
      case 'starting':
      case 'processing':
      case 'queued':    // Astria status
      case 'training':  // Astria status
        updateData.status = 'TRAINING'
        updateData.progress = Math.min(job.attempts * 2, 95) // Simulate progress

        // Continue polling
        scheduleNextTrainingPoll(job)
        break

      case 'succeeded':
      case 'trained':   // Astria status
        updateData.status = 'READY'
        updateData.progress = 100
        updateData.trainedAt = new Date()

        // For Astria, the training ID becomes the model URL
        if (currentProvider === 'astria') {
          updateData.modelUrl = trainingId

          // CRÍTICO: Buscar dados completos do tune no Astria para pegar token e class_word
          try {
            const ASTRIA_API_KEY = process.env.ASTRIA_API_KEY
            if (ASTRIA_API_KEY) {
              console.log(`🔍 Fetching Astria tune details for ${trainingId}...`)

              const tuneResponse = await fetch(`https://api.astria.ai/tunes/${trainingId}`, {
                headers: {
                  'Authorization': `Bearer ${ASTRIA_API_KEY}`,
                  'Accept': 'application/json'
                }
              })

              if (tuneResponse.ok) {
                const tuneData = await tuneResponse.json()

                // Capturar token (usado na geração: [token] [class_name], [prompt])
                if (tuneData.token) {
                  updateData.triggerWord = tuneData.token
                  console.log(`📝 Astria token captured: "${tuneData.token}"`)
                }

                // Capturar class_word (name do tune, usado na geração)
                if (tuneData.name) {
                  updateData.classWord = tuneData.name
                  console.log(`📝 Astria class name captured: "${tuneData.name}"`)
                }

                console.log(`✅ Astria tune data:`, {
                  tuneId: trainingId,
                  token: tuneData.token,
                  className: tuneData.name,
                  title: tuneData.title,
                  modelType: tuneData.model_type,
                  status: tuneData.status
                })
              } else {
                console.warn(`⚠️ Failed to fetch Astria tune ${trainingId}: HTTP ${tuneResponse.status}`)
              }
            }
          } catch (fetchError) {
            console.error(`❌ Error fetching Astria tune data:`, fetchError)
          }

          // Log final
          console.log(`✅ Astria training completed:`, {
            modelId,
            tuneId: trainingId,
            triggerWord: updateData.triggerWord || '(not captured)',
            classWord: updateData.classWord || '(not captured)'
          })
        } else if (training.model?.url) {
          updateData.modelUrl = training.model.url
        }

        console.log(`✅ Training completed for model ${modelId}`)

        // Stop polling
        stopTrainingPolling(trainingId)
        break

      case 'failed':
      case 'cancelled': // Astria status
        updateData.status = 'FAILED'
        updateData.progress = 0

        // Handle error message from different providers
        if (training.error) {
          updateData.errorMessage = training.error
        }

        console.log(`❌ Training failed for model ${modelId}: ${training.error || 'Unknown error'}`)

        // Stop polling
        stopTrainingPolling(trainingId)
        break

      default:
        console.log(`🤔 Unknown training status: ${training.status}`)
        // Continue polling for unknown statuses
        scheduleNextTrainingPoll(job)
        break
    }

    // Update model in database
    if (Object.keys(updateData).length > 0) {
      await prisma.aIModel.update({
        where: { id: modelId },
        data: updateData
      })

      console.log(`📝 Updated model ${modelId} with status: ${updateData.status}`)
    }

  } catch (error) {
    console.error(`❌ Training polling error for ${trainingId}:`, error)

    // Continue polling on errors unless max attempts reached
    if (job.attempts < job.maxAttempts) {
      scheduleNextTrainingPoll(job)
    } else {
      console.error(`💀 Max training polling attempts reached for ${trainingId}`)

      // Mark as failed due to polling timeout
      try {
        await prisma.aIModel.update({
          where: { id: modelId },
          data: {
            status: 'FAILED',
            errorMessage: 'Training polling timeout - status could not be determined'
          }
        })
      } catch (dbError) {
        console.error(`❌ Failed to update model after polling timeout:`, dbError)
      }

      stopTrainingPolling(trainingId)
    }
  }
}

/**
 * Schedule the next training poll
 */
function scheduleNextTrainingPoll(job: TrainingPollingJob) {
  if (job.attempts >= job.maxAttempts) {
    console.log(`⏹️ Training polling stopped: max attempts reached for ${job.trainingId}`)
    stopTrainingPolling(job.trainingId)
    return
  }

  job.timeoutId = setTimeout(() => {
    pollTraining(job)
  }, job.intervalMs)
}

/**
 * Get status of all active training polling jobs
 */
export function getActiveTrainingJobs() {
  return Array.from(activeTrainingJobs.values()).map(job => ({
    trainingId: job.trainingId,
    modelId: job.modelId,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    userId: job.userId
  }))
}