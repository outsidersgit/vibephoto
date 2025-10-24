import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Retry failed webhooks automatically
 * GET /api/cron/retry-webhooks
 *
 * This should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/retry-webhooks",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Simple auth check - use CRON_SECRET env var
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting webhook retry job...')

    // Find failed webhooks that should be retried
    // Retry logic:
    // - Not processed
    // - Retry count < 5
    // - Created more than 5 minutes ago (to avoid retrying too quickly)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const maxRetries = 5

    const failedWebhooks = await prisma.webhookEvent.findMany({
      where: {
        processed: false,
        retryCount: { lt: maxRetries },
        createdAt: { lt: fiveMinutesAgo }
      },
      take: 50, // Process max 50 per run
      orderBy: { createdAt: 'asc' }
    })

    console.log(`📊 Found ${failedWebhooks.length} webhooks to retry`)

    const results = {
      total: failedWebhooks.length,
      success: 0,
      failed: 0,
      maxRetriesReached: 0
    }

    // Process each failed webhook
    for (const webhook of failedWebhooks) {
      try {
        // Import handler dynamically to avoid circular dependencies
        const { handleWebhookEvent } = await import('@/lib/services/webhook-retry-handler')

        // Attempt to reprocess the webhook
        await handleWebhookEvent(webhook)

        // Mark as processed if successful
        await prisma.webhookEvent.update({
          where: { id: webhook.id },
          data: {
            processed: true,
            processingError: null
          }
        })

        results.success++
        console.log(`✅ Webhook ${webhook.id} reprocessed successfully`)

      } catch (error: any) {
        // Increment retry count and update error
        const newRetryCount = webhook.retryCount + 1

        await prisma.webhookEvent.update({
          where: { id: webhook.id },
          data: {
            retryCount: newRetryCount,
            processingError: error.message
          }
        })

        if (newRetryCount >= maxRetries) {
          results.maxRetriesReached++
          console.error(`❌ Webhook ${webhook.id} reached max retries (${maxRetries})`)
        } else {
          results.failed++
          console.error(`⚠️  Webhook ${webhook.id} retry failed (attempt ${newRetryCount}/${maxRetries}):`, error.message)
        }
      }
    }

    // Log summary
    await prisma.systemLog.create({
      data: {
        level: 'INFO',
        category: 'WEBHOOK_RETRY',
        message: 'Webhook retry job completed',
        metadata: results
      }
    })

    console.log('✅ Webhook retry job completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Webhook retry job completed',
      results
    })

  } catch (error: any) {
    console.error('❌ Webhook retry job failed:', error)

    // Log error
    await prisma.systemLog.create({
      data: {
        level: 'ERROR',
        category: 'WEBHOOK_RETRY',
        message: 'Webhook retry job failed',
        metadata: {
          error: error.message,
          stack: error.stack
        }
      }
    })

    return NextResponse.json({
      error: 'Webhook retry job failed',
      message: error.message
    }, { status: 500 })
  }
}