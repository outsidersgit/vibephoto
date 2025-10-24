'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRealtimeUpdates } from './useRealtimeUpdates'

interface AutoSyncStats {
  pendingJobs: number
  lastSyncTime: Date | null
  isAutoSyncing: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  errorCount: number
}

interface AutoSyncOptions {
  enableAutoRecovery?: boolean
  onJobUpdate?: (jobId: string, status: string, data: any) => void
  onError?: (error: string) => void
}

/**
 * Hook personalizado para gerenciar sincronização automática
 * 100% event-driven via WebSocket - sem polling
 */
export function useAutoSync(options: AutoSyncOptions = {}) {
  const { data: session } = useSession()
  const [stats, setStats] = useState<AutoSyncStats>({
    pendingJobs: 0,
    lastSyncTime: null,
    isAutoSyncing: false,
    connectionStatus: 'disconnected',
    errorCount: 0
  })
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])

  // Handlers para eventos WebSocket
  const handleGenerationStatusChange = useCallback((
    generationId: string,
    status: string,
    data: any
  ) => {
    console.log(`🔄 Auto-sync: Generation ${generationId} -> ${status}`)
    
    // Adiciona à lista de atualizações recentes
    setRecentUpdates(prev => {
      const newUpdate = {
        id: generationId,
        type: 'generation',
        status,
        data,
        timestamp: new Date(),
        isUpscale: data.isUpscale || false,
        autoSync: data.autoSync || false
      }
      
      return [newUpdate, ...prev.slice(0, 9)] // Mantém apenas as 10 mais recentes
    })

    // Atualiza stats
    setStats(prev => ({
      ...prev,
      lastSyncTime: new Date(),
      pendingJobs: status === 'processing' ? prev.pendingJobs + 1 : Math.max(0, prev.pendingJobs - 1)
    }))

    // Chama callback customizado
    options.onJobUpdate?.(generationId, status, data)
  }, [options])

  const handleModelStatusChange = useCallback((
    modelId: string,
    status: string,
    data: any
  ) => {
    console.log(`🔄 Auto-sync: Model ${modelId} -> ${status}`)
    
    setRecentUpdates(prev => {
      const newUpdate = {
        id: modelId,
        type: 'model',
        status,
        data,
        timestamp: new Date(),
        autoSync: data.autoSync || false
      }
      
      return [newUpdate, ...prev.slice(0, 9)]
    })

    setStats(prev => ({
      ...prev,
      lastSyncTime: new Date(),
      pendingJobs: status === 'processing' || status === 'training' 
        ? prev.pendingJobs + 1 
        : Math.max(0, prev.pendingJobs - 1)
    }))

    options.onJobUpdate?.(modelId, status, data)
  }, [options])

  // Configurar WebSocket
  const { isConnected, connectionError, reconnect } = useRealtimeUpdates({
    onGenerationStatusChange: handleGenerationStatusChange,
    onModelStatusChange: handleModelStatusChange,
    onConnect: () => {
      console.log('✅ Auto-sync WebSocket connected')
      setStats(prev => ({ ...prev, connectionStatus: 'connected', errorCount: 0 }))
    },
    onDisconnect: () => {
      console.log('🔌 Auto-sync WebSocket disconnected')
      setStats(prev => ({ ...prev, connectionStatus: 'disconnected' }))
    },
    onError: (error) => {
      console.error('❌ Auto-sync WebSocket error:', error)
      setStats(prev => ({ 
        ...prev, 
        connectionStatus: 'disconnected',
        errorCount: prev.errorCount + 1
      }))
      options.onError?.('WebSocket connection error')
    }
  })

  // Event-driven status monitoring (no polling)
  useEffect(() => {
    if (!session?.user) return

    // Only update connection status, no polling
    setStats(prev => ({
      ...prev,
      connectionStatus: isConnected ? 'connected' : 'disconnected',
      errorCount: isConnected ? 0 : prev.errorCount
    }))

    if (isConnected) {
      console.log('✅ Event-driven system active - no polling needed')
    } else {
      console.log('🔌 WebSocket disconnected - reconnecting automatically')
    }
  }, [session?.user, isConnected])

  // Removed periodic auto-recovery - now handled by webhook events only
  // Auto-recovery will be triggered by webhook failures or manual requests

  // Funções utilitárias
  const triggerManualSync = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, isAutoSyncing: true }))
      
      const response = await fetch('/api/sync/manual', {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        
        setStats(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          isAutoSyncing: false,
          errorCount: 0
        }))
        
        console.log('✅ Manual sync completed:', result)
        return result
      } else {
        throw new Error('Manual sync failed')
      }
    } catch (error) {
      setStats(prev => ({ 
        ...prev, 
        isAutoSyncing: false,
        errorCount: prev.errorCount + 1
      }))
      console.error('❌ Manual sync error:', error)
      options.onError?.('Manual sync failed')
      throw error
    }
  }, [options])

  const triggerAutoRecovery = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-recovery/trigger', {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('🚨 Manual auto-recovery triggered:', result)
        return result
      } else {
        throw new Error('Auto-recovery failed')
      }
    } catch (error) {
      console.error('❌ Manual auto-recovery error:', error)
      options.onError?.('Auto-recovery failed')
      throw error
    }
  }, [options])

  const clearRecentUpdates = useCallback(() => {
    setRecentUpdates([])
  }, [])

  const forceReconnect = useCallback(() => {
    setStats(prev => ({ ...prev, connectionStatus: 'reconnecting' }))
    reconnect()
  }, [reconnect])

  return {
    // Estado
    stats,
    recentUpdates,
    isConnected,
    connectionError,
    
    // Ações
    triggerManualSync,
    triggerAutoRecovery,
    clearRecentUpdates,
    forceReconnect,
    
    // Status helpers
    isHealthy: isConnected && stats.errorCount < 3,
    needsAttention: !isConnected || stats.errorCount >= 3,
    hasRecentActivity: recentUpdates.length > 0,
    lastActivityTime: recentUpdates[0]?.timestamp || null
  }
}