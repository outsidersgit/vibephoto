'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminRealtimeUpdates } from '@/hooks/useAdminRealtimeUpdates'
import { EVENT_TYPES } from '@/lib/services/realtime-service'

interface AdminRealtimeWrapperProps {
  children: React.ReactNode
  onUserCreated?: () => void
  onUserUpdated?: () => void
  onGenerationCreated?: () => void
  onGenerationUpdated?: () => void
  onModelCreated?: () => void
  onModelUpdated?: () => void
  onStatsUpdated?: () => void
  refreshOnEvents?: boolean // If true, refresh page data on events
}

/**
 * Wrapper component for admin pages that provides real-time updates
 * Automatically refreshes data when admin events are received
 */
export function AdminRealtimeWrapper({
  children,
  onUserCreated,
  onUserUpdated,
  onGenerationCreated,
  onGenerationUpdated,
  onModelCreated,
  onModelUpdated,
  onStatsUpdated,
  refreshOnEvents = true
}: AdminRealtimeWrapperProps) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)

  // Refresh function that triggers a router refresh
  const refresh = useCallback(() => {
    if (refreshOnEvents) {
      console.log('🔄 [AdminRealtimeWrapper] Refreshing page data...')
      setRefreshKey(prev => prev + 1)
      router.refresh()
    }
  }, [router, refreshOnEvents])

  // Connect to real-time updates
  const { isConnected, connectionError } = useAdminRealtimeUpdates({
    enabled: true,
    onUserCreated: () => {
      console.log('👤 [AdminRealtimeWrapper] User created event received')
      onUserCreated?.()
      refresh()
    },
    onUserUpdated: () => {
      console.log('👤 [AdminRealtimeWrapper] User updated event received')
      onUserUpdated?.()
      refresh()
    },
    onGenerationCreated: () => {
      console.log('🎨 [AdminRealtimeWrapper] Generation created event received')
      onGenerationCreated?.()
      refresh()
    },
    onGenerationUpdated: () => {
      console.log('🎨 [AdminRealtimeWrapper] Generation updated event received')
      onGenerationUpdated?.()
      refresh()
    },
    onModelCreated: () => {
      console.log('🤖 [AdminRealtimeWrapper] Model created event received')
      onModelCreated?.()
      refresh()
    },
    onModelUpdated: () => {
      console.log('🤖 [AdminRealtimeWrapper] Model updated event received')
      onModelUpdated?.()
      refresh()
    },
    onStatsUpdated: () => {
      console.log('📊 [AdminRealtimeWrapper] Stats updated event received')
      onStatsUpdated?.()
      refresh()
    }
  })

  // Show connection status in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (isConnected) {
        console.log('✅ [AdminRealtimeWrapper] Real-time updates connected')
      } else if (connectionError) {
        console.warn('⚠️ [AdminRealtimeWrapper] Real-time updates error:', connectionError)
      }
    }
  }, [isConnected, connectionError])

  return (
    <>
      {children}
      {/* Optional: Show connection indicator in dev mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : connectionError 
                ? 'bg-red-100 text-red-800' 
                : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? '🟢 Connected' : connectionError ? '🔴 Error' : '🟡 Connecting...'}
          </div>
        </div>
      )}
    </>
  )
}

