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
  VIDEO_STATUS_CHANGED: 'video_status_changed', // 🎬 Real-time video generation updates
  TRAINING_PROGRESS: 'training_progress',
  GENERATION_PROGRESS: 'generation_progress',
  PACKAGE_GENERATION_UPDATED: 'package_generation_updated', // Real-time package progress
  CREDITS_UPDATED: 'credits_updated',
  USER_UPDATED: 'user_updated', // Admin updates: plan, subscription, etc.
  NOTIFICATION: 'notification',
  // Admin events (broadcasted to all admins, no userId required)
  ADMIN_USER_CREATED: 'admin_user_created',
  ADMIN_USER_UPDATED: 'admin_user_updated',
  ADMIN_GENERATION_CREATED: 'admin_generation_created',
  ADMIN_GENERATION_UPDATED: 'admin_generation_updated',
  ADMIN_MODEL_CREATED: 'admin_model_created',
  ADMIN_MODEL_UPDATED: 'admin_model_updated',
  ADMIN_STATS_UPDATED: 'admin_stats_updated'
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
  console.log('📡 [realtime-service] Broadcasting generation status change:', {
    generationId,
    userId,
    status,
    hasImageUrls: !!(additionalData?.imageUrls && additionalData.imageUrls.length > 0),
    hasTemporaryUrls: !!(additionalData?.temporaryUrls && additionalData.temporaryUrls.length > 0),
    imageUrlsCount: additionalData?.imageUrls?.length || 0,
    temporaryUrlsCount: additionalData?.temporaryUrls?.length || 0,
    allAdditionalDataKeys: Object.keys(additionalData || {})
  })
  
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('❌ [realtime-service] No broadcast function available, skipping event')
    return
  }

  const eventData = {
    type: EVENT_TYPES.GENERATION_STATUS_CHANGED,
    userId,
    data: {
      generationId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  }
  
  console.log('📤 [realtime-service] Sending broadcast event:', {
    type: eventData.type,
    userId: eventData.userId,
    generationId: eventData.data.generationId,
    status: eventData.data.status,
    dataKeys: Object.keys(eventData.data)
  })

  const result = broadcast(eventData)
  
  console.log('✅ [realtime-service] Broadcast result:', result)
  
  return result
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
 * Broadcast package generation update in real-time
 * Used to update progress in both modal and gallery
 */
export async function broadcastPackageGenerationUpdate(
  userPackageId: string,
  userId: string,
  status: string,
  generatedImages: number,
  totalImages: number,
  packageName?: string,
  additionalData?: any
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping package event')
    return
  }

  // CRITICAL: Always show 100% progress when status is COMPLETED
  const progress = status === 'COMPLETED'
    ? 100
    : Math.min(100, Math.round((generatedImages / totalImages) * 100))

  console.log('📦 [realtime-service] Broadcasting package generation update:', {
    userPackageId,
    userId,
    status,
    progress: `${generatedImages}/${totalImages} (${progress}%)`,
    packageName
  })

  return broadcast({
    type: EVENT_TYPES.PACKAGE_GENERATION_UPDATED,
    userId,
    data: {
      userPackageId,
      status,
      generatedImages,
      totalImages,
      packageName,
      progress,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  })
}

/**
 * Broadcast video status change to connected clients
 * Used for real-time video generation updates (started, processing, completed, failed)
 */
export async function broadcastVideoStatusChange(
  videoId: string,
  userId: string,
  status: string,
  additionalData?: any
) {
  console.log('🎬 [realtime-service] Broadcasting video status change:', {
    videoId,
    userId,
    status,
    hasVideoUrl: !!additionalData?.videoUrl,
    hasThumbnailUrl: !!additionalData?.thumbnailUrl
  })

  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('❌ [realtime-service] No broadcast function available, skipping video event')
    return
  }

  const eventData = {
    type: EVENT_TYPES.VIDEO_STATUS_CHANGED,
    userId,
    data: {
      videoId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  }

  console.log('📤 [realtime-service] Sending video broadcast event:', {
    type: eventData.type,
    userId: eventData.userId,
    videoId: eventData.data.videoId,
    status: eventData.data.status
  })

  return broadcast(eventData)
}

/**
 * Broadcast credits update to user
 * CRITICAL: Incluir creditsBalance para atualização em tempo real do badge
 */
export async function broadcastCreditsUpdate(
  userId: string,
  creditsUsed: number,
  creditsLimit: number,
  action?: string,
  creditsBalance?: number
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
      creditsBalance, // CRITICAL: Incluir creditsBalance no evento SSE
      action,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Broadcast user update (plan, subscription status, etc.) to user
 * Used when admin makes changes that affect user's account
 */
export async function broadcastUserUpdate(
  userId: string,
  updatedFields: {
    plan?: string
    subscriptionStatus?: string
    creditsLimit?: number
    creditsUsed?: number
    creditsBalance?: number
    [key: string]: any
  },
  action?: string
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping event')
    return
  }

  return broadcast({
    type: EVENT_TYPES.USER_UPDATED,
    userId,
    data: {
      ...updatedFields,
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
 * Broadcast admin event - sent to all admin users (no userId filter)
 */
export async function broadcastAdminEvent(
  eventType: string,
  data: any
) {
  const broadcast = await getBroadcastFunction()
  if (!broadcast) {
    console.log('📡 No broadcast function available, skipping admin event')
    return
  }

  return broadcast({
    type: eventType,
    // No userId - broadcast to all admins
    data: {
      ...data,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Broadcast user created event to admins
 */
export async function broadcastAdminUserCreated(userData: {
  id: string
  email: string
  name?: string | null
  plan?: string | null
  role: string
  createdAt: Date
}) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_USER_CREATED, {
    userId: userData.id,
    email: userData.email,
    name: userData.name,
    plan: userData.plan,
    role: userData.role,
    createdAt: userData.createdAt.toISOString()
  })
}

/**
 * Broadcast user updated event to admins
 */
export async function broadcastAdminUserUpdated(userId: string, updatedFields: any) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_USER_UPDATED, {
    userId,
    ...updatedFields
  })
}

/**
 * Broadcast generation created event to admins
 */
export async function broadcastAdminGenerationCreated(generationData: {
  id: string
  userId: string
  status: string
  prompt?: string | null
  createdAt: Date
}) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_GENERATION_CREATED, {
    generationId: generationData.id,
    userId: generationData.userId,
    status: generationData.status,
    prompt: generationData.prompt,
    createdAt: generationData.createdAt.toISOString()
  })
}

/**
 * Broadcast generation updated event to admins
 */
export async function broadcastAdminGenerationUpdated(generationId: string, updatedFields: any) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_GENERATION_UPDATED, {
    generationId,
    ...updatedFields
  })
}

/**
 * Broadcast model created event to admins
 */
export async function broadcastAdminModelCreated(modelData: {
  id: string
  userId: string
  name: string
  status: string
  createdAt: Date
}) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_MODEL_CREATED, {
    modelId: modelData.id,
    userId: modelData.userId,
    name: modelData.name,
    status: modelData.status,
    createdAt: modelData.createdAt.toISOString()
  })
}

/**
 * Broadcast model updated event to admins
 */
export async function broadcastAdminModelUpdated(modelId: string, updatedFields: any) {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_MODEL_UPDATED, {
    modelId,
    ...updatedFields
  })
}

/**
 * Broadcast stats updated event to admins (for KPIs refresh)
 */
export async function broadcastAdminStatsUpdated() {
  return broadcastAdminEvent(EVENT_TYPES.ADMIN_STATS_UPDATED, {
    // Stats will be fetched by admin clients
  })
}

/**
 * Get connection stats (for debugging)
 */
export async function getConnectionStats() {
  console.log('📊 Connection stats not available in this implementation')
  return null
}