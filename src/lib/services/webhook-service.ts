import { prisma } from '@/lib/db'

export class WebhookService {
  
  // Get webhook statistics
  async getWebhookStats(daysBack: number = 7) {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    
    const stats = await prisma.webhookEvent.aggregate({
      where: { receivedAt: { gte: since } },
      _count: {
        id: true
      }
    })

    const processedCount = await prisma.webhookEvent.count({
      where: { 
        receivedAt: { gte: since },
        processed: true
      }
    })

    const failedCount = await prisma.webhookEvent.count({
      where: { 
        receivedAt: { gte: since },
        processed: false,
        processingError: { not: null }
      }
    })

    const eventsByType = await prisma.webhookEvent.groupBy({
      by: ['event'],
      where: { receivedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    return {
      total: stats._count.id,
      processed: processedCount,
      failed: failedCount,
      successRate: stats._count.id > 0 ? (processedCount / stats._count.id) * 100 : 0,
      eventsByType: eventsByType.map(e => ({
        event: e.event,
        count: e._count.id
      }))
    }
  }

  // Get failed webhooks that need retry
  async getFailedWebhooks(limit: number = 50) {
    return prisma.webhookEvent.findMany({
      where: {
        processed: false,
        processingError: { not: null },
        retryCount: { lt: 5 } // Max 5 retries
      },
      orderBy: { receivedAt: 'asc' },
      take: limit
    })
  }

  // Retry a failed webhook
  async retryWebhook(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId }
      })

      if (!event) {
        return { success: false, error: 'Webhook event not found' }
      }

      if (event.processed) {
        return { success: false, error: 'Webhook already processed' }
      }

      if (event.retryCount >= 5) {
        return { success: false, error: 'Maximum retry count reached' }
      }

      // Simulate reprocessing by calling our webhook endpoint internally
      const webhookUrl = process.env.NEXTAUTH_URL + '/api/payments/asaas/webhook/enhanced'
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || ''
        },
        body: JSON.stringify(event.rawPayload)
      })

      const result = await response.json()
      
      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: result.error || 'Retry failed' }
      }

    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Clean up old webhook events (older than 30 days)
  async cleanupOldWebhooks(daysToKeep: number = 30): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    
    const result = await prisma.webhookEvent.deleteMany({
      where: {
        receivedAt: { lt: cutoffDate },
        processed: true // Only delete processed events
      }
    })

    return { deletedCount: result.count }
  }

  // Get webhook events for debugging
  async getWebhookEvents(filters: {
    event?: string
    processed?: boolean
    paymentId?: string
    subscriptionId?: string
    customerId?: string
    limit?: number
    offset?: number
  } = {}) {
    const where: any = {}
    
    if (filters.event) where.event = filters.event
    if (typeof filters.processed === 'boolean') where.processed = filters.processed
    if (filters.paymentId) where.asaasPaymentId = filters.paymentId
    if (filters.subscriptionId) where.asaasSubscriptionId = filters.subscriptionId
    if (filters.customerId) where.asaasCustomerId = filters.customerId

    return prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: filters.limit || 20,
      skip: filters.offset || 0,
      select: {
        id: true,
        event: true,
        asaasPaymentId: true,
        asaasSubscriptionId: true,
        asaasCustomerId: true,
        processed: true,
        processingError: true,
        retryCount: true,
        receivedAt: true,
        processedAt: true,
        rawPayload: true
      }
    })
  }

  // Mark webhook as manually processed (admin override)
  async markWebhookProcessed(eventId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          processed: true,
          processedAt: new Date(),
          processingError: `Manually marked as processed: ${reason}`
        }
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Get webhook processing metrics
  async getProcessingMetrics(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const events = await prisma.webhookEvent.findMany({
      where: { receivedAt: { gte: since } },
      select: {
        receivedAt: true,
        processedAt: true,
        processed: true,
        retryCount: true
      }
    })

    const processingTimes = events
      .filter(e => e.processed && e.processedAt)
      .map(e => e.processedAt!.getTime() - e.receivedAt.getTime())

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0

    const maxProcessingTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0
    const minProcessingTime = processingTimes.length > 0 ? Math.min(...processingTimes) : 0

    const retriedEvents = events.filter(e => e.retryCount > 0)

    return {
      totalEvents: events.length,
      processedEvents: events.filter(e => e.processed).length,
      failedEvents: events.filter(e => !e.processed).length,
      retriedEvents: retriedEvents.length,
      avgProcessingTimeMs: Math.round(avgProcessingTime),
      maxProcessingTimeMs: maxProcessingTime,
      minProcessingTimeMs: minProcessingTime,
      avgRetryCount: retriedEvents.length > 0 
        ? retriedEvents.reduce((sum, e) => sum + e.retryCount, 0) / retriedEvents.length 
        : 0
    }
  }

  // Get events requiring attention
  async getEventsRequiringAttention() {
    const failedEvents = await prisma.webhookEvent.findMany({
      where: {
        processed: false,
        retryCount: { gte: 3 } // Events that have failed multiple times
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        event: true,
        asaasPaymentId: true,
        asaasSubscriptionId: true,
        processingError: true,
        retryCount: true,
        receivedAt: true,
        lastRetryAt: true
      }
    })

    const oldUnprocessedEvents = await prisma.webhookEvent.findMany({
      where: {
        processed: false,
        receivedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Older than 2 hours
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        event: true,
        asaasPaymentId: true,
        asaasSubscriptionId: true,
        processingError: true,
        retryCount: true,
        receivedAt: true,
        lastRetryAt: true
      }
    })

    return {
      failedEvents,
      oldUnprocessedEvents,
      totalRequiringAttention: failedEvents.length + oldUnprocessedEvents.length
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService()

// Background job to auto-retry failed webhooks
export async function autoRetryFailedWebhooks() {
  console.log('Starting auto-retry of failed webhooks...')
  
  const failedEvents = await webhookService.getFailedWebhooks(20)
  let retriedCount = 0
  let successCount = 0

  for (const event of failedEvents) {
    // Only retry if last attempt was more than 5 minutes ago
    if (event.lastRetryAt && Date.now() - event.lastRetryAt.getTime() < 5 * 60 * 1000) {
      continue
    }

    const result = await webhookService.retryWebhook(event.id)
    retriedCount++
    
    if (result.success) {
      successCount++
    }

    // Wait 1 second between retries to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`Auto-retry completed: ${successCount}/${retriedCount} successful`)
  return { retriedCount, successCount }
}

// Background job to cleanup old webhooks
export async function cleanupOldWebhooks() {
  console.log('Starting webhook cleanup...')
  
  const result = await webhookService.cleanupOldWebhooks(30) // Keep 30 days
  
  console.log(`Webhook cleanup completed: ${result.deletedCount} old events deleted`)
  return result
}