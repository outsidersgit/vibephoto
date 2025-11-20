'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { EVENT_TYPES } from '@/lib/services/realtime-service'

export interface AdminRealtimeEvent {
  type: string
  data: any
  timestamp: string
}

export interface UseAdminRealtimeUpdatesOptions {
  onUserCreated?: (data: { userId: string; email: string; name?: string | null; plan?: string | null; role: string; createdAt: string }) => void
  onUserUpdated?: (data: { userId: string; [key: string]: any }) => void
  onGenerationCreated?: (data: { generationId: string; userId: string; status: string; prompt?: string | null; createdAt: string }) => void
  onGenerationUpdated?: (data: { generationId: string; [key: string]: any }) => void
  onModelCreated?: (data: { modelId: string; userId: string; name: string; status: string; createdAt: string }) => void
  onModelUpdated?: (data: { modelId: string; [key: string]: any }) => void
  onStatsUpdated?: () => void
  enabled?: boolean
}

export function useAdminRealtimeUpdates(options: UseAdminRealtimeUpdatesOptions = {}) {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const optionsRef = useRef(options)
  const [lastEvent, setLastEvent] = useState<AdminRealtimeEvent | null>(null)

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const maxReconnectAttempts = 10
  const baseReconnectDelay = 2000
  const isDevMode = process.env.NODE_ENV === 'development'

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('🔌 [useAdminRealtimeUpdates] Closing SSE connection')
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setIsConnected(false)
  }, [])

  const connect = useCallback(() => {
    // Check if enabled
    if (optionsRef.current.enabled === false) {
      console.log('⏸️ [useAdminRealtimeUpdates] Real-time updates disabled')
      return
    }

    // Check if user is authenticated
    if (!session?.user) {
      console.log('⏸️ [useAdminRealtimeUpdates] No session, skipping connection')
      return
    }

    // Check if user is admin
    if (session.user.role !== 'ADMIN') {
      console.log('⏸️ [useAdminRealtimeUpdates] User is not admin, skipping connection')
      return
    }

    // Don't reconnect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('✅ [useAdminRealtimeUpdates] Already connected')
      return
    }

    // Close existing connection if any
    disconnect()

    console.log('🔌 [useAdminRealtimeUpdates] Connecting to SSE stream...')

    try {
      const eventSource = new EventSource('/api/events/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('✅ [useAdminRealtimeUpdates] SSE connection opened')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts.current = 0
      }

      eventSource.onerror = (error) => {
        console.error('❌ [useAdminRealtimeUpdates] SSE connection error:', error)
        setIsConnected(false)
        setConnectionError('Connection error')

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = isDevMode ? 1000 : baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
          console.log(`🔄 [useAdminRealtimeUpdates] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            disconnect()
            connect()
          }, delay)
        } else {
          console.error('🚫 [useAdminRealtimeUpdates] Max reconnection attempts reached')
          setConnectionError('Failed to maintain connection')
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const eventData: AdminRealtimeEvent = JSON.parse(event.data)
          setLastEvent(eventData)

          // Handle different event types
          switch (eventData.type) {
            case 'connected':
              console.log('🎉 [useAdminRealtimeUpdates] SSE connection confirmed')
              break

            case 'heartbeat':
              // Silent heartbeat handling
              break

            case EVENT_TYPES.ADMIN_USER_CREATED:
              console.log('👤 [useAdminRealtimeUpdates] User created:', eventData.data)
              optionsRef.current.onUserCreated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_USER_UPDATED:
              console.log('👤 [useAdminRealtimeUpdates] User updated:', eventData.data)
              optionsRef.current.onUserUpdated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_GENERATION_CREATED:
              console.log('🎨 [useAdminRealtimeUpdates] Generation created:', eventData.data)
              optionsRef.current.onGenerationCreated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_GENERATION_UPDATED:
              console.log('🎨 [useAdminRealtimeUpdates] Generation updated:', eventData.data)
              optionsRef.current.onGenerationUpdated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_MODEL_CREATED:
              console.log('🤖 [useAdminRealtimeUpdates] Model created:', eventData.data)
              optionsRef.current.onModelCreated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_MODEL_UPDATED:
              console.log('🤖 [useAdminRealtimeUpdates] Model updated:', eventData.data)
              optionsRef.current.onModelUpdated?.(eventData.data)
              break

            case EVENT_TYPES.ADMIN_STATS_UPDATED:
              console.log('📊 [useAdminRealtimeUpdates] Stats updated')
              optionsRef.current.onStatsUpdated?.()
              break

            default:
              // Ignore unknown event types
              break
          }
        } catch (error) {
          console.error('❌ [useAdminRealtimeUpdates] Error parsing SSE event:', error)
        }
      }
    } catch (error) {
      console.error('❌ [useAdminRealtimeUpdates] Failed to create EventSource:', error)
      setConnectionError('Failed to create connection')
    }
  }, [session, disconnect])

  // Connect on mount and when session changes
  useEffect(() => {
    if (session?.user && session.user.role === 'ADMIN') {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [session, connect, disconnect])

  return {
    isConnected,
    connectionError,
    lastEvent,
    reconnect: connect
  }
}

