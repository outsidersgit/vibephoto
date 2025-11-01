'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface RealtimeEvent {
  type: string
  timestamp: string
  data: any
  connectionId?: string
  message?: string
}

export interface UseRealtimeUpdatesOptions {
  onModelStatusChange?: (modelId: string, status: string, data: any) => void
  onGenerationStatusChange?: (generationId: string, status: string, data: any) => void
  onTrainingProgress?: (modelId: string, progress: number, message?: string) => void
  onGenerationProgress?: (generationId: string, progress: number, message?: string) => void
  onCreditsUpdate?: (creditsUsed: number, creditsLimit: number, action?: string) => void
  onUserUpdate?: (updatedFields: { plan?: string; subscriptionStatus?: string; creditsLimit?: number; creditsUsed?: number; creditsBalance?: number; [key: string]: any }) => void
  onNotification?: (title: string, message: string, type: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000 // 1 second
  const optionsRef = useRef(options)
  const isDevMode = process.env.NODE_ENV === 'development'
  const connectionStableTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Update options ref without causing re-renders
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const connect = useCallback(() => {
    // SSE enabled for real-time updates
    
    if (!session?.user) {
      console.log('👤 No user session, skipping SSE connection')
      return
    }

    const userId = (session.user as any)?.id
    if (!userId) {
      console.log('👤 No user ID available, skipping SSE connection')
      return
    }

    if (eventSourceRef.current) {
      console.log('🔄 SSE already connected')
      return
    }

    console.log('📡 Connecting to SSE stream...')
    setConnectionError(null)

    let eventSource: EventSource
    try {
      eventSource = new EventSource('/api/events/stream', {
        withCredentials: true
      })
    } catch (err) {
      console.error('❌ Failed to create EventSource:', err)
      setConnectionError('Failed to create SSE connection')
      return
    }

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('✅ SSE connection opened - event-driven system active')
      
      // In development, wait a bit before marking as stable to avoid HMR issues
      if (isDevMode) {
        if (connectionStableTimeoutRef.current) {
          clearTimeout(connectionStableTimeoutRef.current)
        }
        connectionStableTimeoutRef.current = setTimeout(() => {
          setIsConnected(true)
          setConnectionError(null)
          reconnectAttempts.current = 0
          optionsRef.current.onConnect?.()
        }, 500) // Wait 500ms before considering connection stable
      } else {
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts.current = 0
        optionsRef.current.onConnect?.()
      }
    }

    eventSource.onerror = (error) => {
      const errorDetails = {
        readyState: eventSource.readyState,
        url: eventSource.url,
        type: error.type || 'unknown',
        message: error.message || 'SSE connection error',
        target: error.target ? {
          readyState: (error.target as EventSource).readyState,
          url: (error.target as EventSource).url
        } : null
      }
      console.error('❌ SSE connection error:', errorDetails)
      setIsConnected(false)
      setConnectionError('Connection lost')
      optionsRef.current.onError?.(error)

      // In development mode, be more lenient with reconnections due to HMR
      const shouldReconnect = isDevMode ? reconnectAttempts.current < 10 : reconnectAttempts.current < maxReconnectAttempts
      
      if (shouldReconnect && eventSourceRef.current) {
        const delay = isDevMode ? 1000 : baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
        console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${isDevMode ? 10 : maxReconnectAttempts})`)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++
          disconnect()
          connect()
        }, delay)
      } else {
        console.error('🚫 Max reconnection attempts reached or connection closed')
        setConnectionError('Failed to maintain connection')
      }
    }

    eventSource.onmessage = (event) => {
      try {
        const eventData: RealtimeEvent = JSON.parse(event.data)
        setLastEvent(eventData)

        console.log('📥 SSE event received:', eventData.type, eventData.data)

        // Handle different event types
        switch (eventData.type) {
          case 'connected':
            console.log('🎉 SSE connection confirmed:', eventData.message)
            // Log server info if available
            if (eventData.data?.serverInfo) {
              console.log('📡 Server info:', eventData.data.serverInfo)
            }
            break

          case 'heartbeat':
            // Silent heartbeat handling
            break

          case 'model_status_changed':
            optionsRef.current.onModelStatusChange?.(
              eventData.data.modelId,
              eventData.data.status,
              eventData.data
            )
            break

          case 'generation_status_changed':
            optionsRef.current.onGenerationStatusChange?.(
              eventData.data.generationId,
              eventData.data.status,
              eventData.data
            )
            break

          case 'training_progress':
            optionsRef.current.onTrainingProgress?.(
              eventData.data.modelId,
              eventData.data.progress,
              eventData.data.message
            )
            break

          case 'generation_progress':
            optionsRef.current.onGenerationProgress?.(
              eventData.data.generationId,
              eventData.data.progress,
              eventData.data.message
            )
            break

          case 'credits_updated':
            optionsRef.current.onCreditsUpdate?.(
              eventData.data.creditsUsed,
              eventData.data.creditsLimit,
              eventData.data.action
            )
            break

          case 'user_updated':
            // CRITICAL: Admin updated user - invalidate user queries and update session
            if (optionsRef.current.onUserUpdate) {
              optionsRef.current.onUserUpdate(eventData.data)
            } else {
              // Fallback: invalidate queries if handler not provided
              console.log('🔄 [useRealtimeUpdates] User updated via admin - consider implementing onUserUpdate handler')
            }
            break

          case 'notification':
            optionsRef.current.onNotification?.(
              eventData.data.title,
              eventData.data.message,
              eventData.data.notificationType
            )
            break

          default:
            console.log('🔄 Unknown SSE event type:', eventData.type)
        }
      } catch (error) {
        console.error('❌ Error parsing SSE event:', error, event.data)
      }
    }
  }, [session?.user])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (connectionStableTimeoutRef.current) {
      clearTimeout(connectionStableTimeoutRef.current)
      connectionStableTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      console.log('🔌 Disconnecting SSE')
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
      optionsRef.current.onDisconnect?.()
    }
  }, [])

  // Connect when session is available
  useEffect(() => {
    if (session?.user && (session.user as any)?.id) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [session?.user, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    lastEvent,
    connectionError,
    connect,
    disconnect,
    reconnect: () => {
      disconnect()
      setTimeout(connect, 100) // Small delay to ensure cleanup
    }
  }
}