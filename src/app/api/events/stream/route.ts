import { NextRequest } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { setBroadcastFunction } from '@/lib/services/realtime-service'

// Force dynamic route (no ISR) and disable revalidation for SSE
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Store active connections with enhanced metadata
const connections = new Map<string, { 
  controller: ReadableStreamDefaultController,
  userId: string,
  connectedAt: Date,
  lastActivity: Date,
  heartbeat?: NodeJS.Timeout
}>()

export async function GET(request: NextRequest) {
  try {
    console.log('📡 SSE connection attempt from:', request.headers.get('user-agent')?.substring(0, 50))

    // Authenticate user
    const session = await requireAuthAPI()
    const userId = session.user.id

    console.log('✅ Authentication successful for user:', userId)
    
    // Create unique connection ID
    const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`📡 SSE connection opened for user ${userId} (${connectionId})`)

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const now = new Date()
        
        // Store connection with enhanced metadata
        const connection = {
          controller, 
          userId,
          connectedAt: now,
          lastActivity: now
        }
        connections.set(connectionId, connection)
        
        // Send initial connection confirmation with server info
        controller.enqueue(
          `data: ${JSON.stringify({
            type: 'connected',
            timestamp: now.toISOString(),
            connectionId,
            message: 'Real-time updates connected - webhook-driven system',
            serverInfo: {
              pollingDisabled: true,
              webhookEnabled: true,
              instantUpdates: true
            }
          })}\n\n`
        )
        
        // Optimized heartbeat - less frequent since we're event-driven
        const heartbeat = setInterval(() => {
          try {
            const connection = connections.get(connectionId)
            if (!connection) {
              clearInterval(heartbeat)
              return
            }
            
            // Update last activity
            connection.lastActivity = new Date()
            
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                uptime: Math.round((Date.now() - connection.connectedAt.getTime()) / 1000)
              })}\n\n`
            )
          } catch (error) {
            console.log(`💔 Heartbeat failed for connection ${connectionId}, cleaning up`)
            clearInterval(heartbeat)
            connections.delete(connectionId)
          }
        }, 45000) // Increased to 45 seconds since we don't need aggressive polling

        // Store heartbeat reference for cleanup
        connection.heartbeat = heartbeat
      },
      
      cancel() {
        console.log(`🔌 SSE connection closed for ${connectionId}`)
        const connection = connections.get(connectionId)
        if (connection && (connection as any).heartbeat) {
          clearInterval((connection as any).heartbeat)
        }
        connections.delete(connectionId)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no'
      }
    })

  } catch (error) {
    console.error('❌ SSE connection error:', error)

    // Determine appropriate status code
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500

    return new Response(
      JSON.stringify({
        error: status === 401 ? 'Authentication required' : 'SSE connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        }
      }
    )
  }
}

// Enhanced broadcast function with user-specific targeting and better performance
export function broadcastEvent(event: {
  type: string
  userId?: string // If specified, only send to this user
  data: any
}) {
  const timestamp = new Date().toISOString()
  const message = `data: ${JSON.stringify({
    ...event,
    timestamp,
    serverType: 'webhook-driven' // Indicate this is from webhook, not polling
  })}\n\n`

  let sentCount = 0
  let targetedCount = 0
  const deadConnections: string[] = []

  // Get connections for specific user or all connections
  const targetConnections = event.userId 
    ? Array.from(connections.entries()).filter(([_, conn]) => conn.userId === event.userId)
    : Array.from(connections.entries())

  targetedCount = targetConnections.length

  for (const [connectionId, connection] of targetConnections) {
    try {
      // Update last activity for this connection
      connection.lastActivity = new Date()
      
      connection.controller.enqueue(message)
      sentCount++
    } catch (error) {
      console.log(`💀 Dead connection detected: ${connectionId}`)
      deadConnections.push(connectionId)
    }
  }

  // Clean up dead connections
  deadConnections.forEach(connectionId => {
    const connection = connections.get(connectionId)
    if (connection?.heartbeat) {
      clearInterval(connection.heartbeat)
    }
    connections.delete(connectionId)
  })

  // Enhanced logging with user targeting info
  const logMessage = event.userId 
    ? `📤 Broadcasted ${event.type} to user ${event.userId}: ${sentCount}/${targetedCount} connections`
    : `📤 Broadcasted ${event.type} to ${sentCount} connections`

  console.log(`${logMessage} (${deadConnections.length} cleaned up)`)
  
  return { 
    sentCount, 
    targetedCount,
    cleanedUp: deadConnections.length,
    totalConnections: connections.size
  }
}

// Export connection stats for monitoring
export function getConnectionStats() {
  const now = new Date()
  const stats = {
    totalConnections: connections.size,
    connectionsByUser: new Map<string, number>(),
    avgUptime: 0,
    oldestConnection: null as Date | null,
    newestConnection: null as Date | null
  }

  let totalUptime = 0
  
  for (const [connectionId, connection] of connections.entries()) {
    // Count by user
    const userCount = stats.connectionsByUser.get(connection.userId) || 0
    stats.connectionsByUser.set(connection.userId, userCount + 1)
    
    // Calculate uptime
    const uptime = now.getTime() - connection.connectedAt.getTime()
    totalUptime += uptime
    
    // Track oldest/newest
    if (!stats.oldestConnection || connection.connectedAt < stats.oldestConnection) {
      stats.oldestConnection = connection.connectedAt
    }
    if (!stats.newestConnection || connection.connectedAt > stats.newestConnection) {
      stats.newestConnection = connection.connectedAt
    }
  }

  if (connections.size > 0) {
    stats.avgUptime = Math.round(totalUptime / connections.size / 1000) // seconds
  }

  return stats
}

// Initialize the broadcast function for the realtime service
setBroadcastFunction(broadcastEvent)

// Export for use in other modules
export { connections }