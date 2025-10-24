// Realtime service for broadcasting events to connected SSE clients
interface RealtimeEvent {
  type: string
  userId?: string
  data: any
}

// Event types for type safety
export const EVENT_TYPES = {
  MODEL_STATUS_CHANGED: 'model_status_changed',
  GENERATION_STATUS_CHANGED: 'generation_status_changed',
  TRAINING_PROGRESS: 'training_progress',
  GENERATION_PROGRESS: 'generation_progress',
  CREDITS_UPDATED: 'credits_updated',
  NOTIFICATION: 'notification'
} as const

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES]

// Global broadcast function - will be set by the SSE route
let globalBroadcastFunction: ((event: RealtimeEvent) => Promise<any>) | null = null

// Set the broadcast function (called by SSE route)
export function setBroadcastFunction(fn: (event: RealtimeEvent) => Promise<any>) {
  globalBroadcastFunction = fn
}

// Get the broadcast function
async function getBroadcastFunction() {
  return globalBroadcastFunction
}

/**
 * Broadcast a model status change to connected clients
 */
export async function broadcastModelStatusChange(
  modelId: string,
  userId: string,
  status: string,
  additionalData?: any
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.MODEL_STATUS_CHANGED,
    userId,
    data: {
      modelId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  })
}

/**
 * Broadcast a generation status change to connected clients
 */
export async function broadcastGenerationStatusChange(
  generationId: string,
  userId: string,
  status: string,
  additionalData?: any
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.GENERATION_STATUS_CHANGED,
    userId,
    data: {
      generationId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  })
}

/**
 * Broadcast training progress update
 */
export async function broadcastTrainingProgress(
  modelId: string,
  userId: string,
  progress: number,
  message?: string
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.TRAINING_PROGRESS,
    userId,
    data: {
      modelId,
      progress,
      message,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Broadcast generation progress update
 */
export async function broadcastGenerationProgress(
  generationId: string,
  userId: string,
  progress: number,
  message?: string
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.GENERATION_PROGRESS,
    userId,
    data: {
      generationId,
      progress,
      message,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Broadcast credits update to user
 */
export async function broadcastCreditsUpdate(
  userId: string,
  creditsUsed: number,
  creditsLimit: number,
  action?: string
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.CREDITS_UPDATED,
    userId,
    data: {
      creditsUsed,
      creditsLimit,
      action,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Broadcast general notification to user
 */
export async function broadcastNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.NOTIFICATION,
    userId,
    data: {
      title,
      message,
      notificationType: type,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Get connection stats (for debugging)
 */
export async function getConnectionStats() {
  console.log('📊 Connection stats not available in this implementation')
  return null
}