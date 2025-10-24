'use client'

import { useEffect, useState } from 'react'

interface SyncStatus {
  processingCount: number
  syncInProgress: boolean
  lastSyncAt?: Date
  errors: string[]
}

export function GenerationSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    processingCount: 0,
    syncInProgress: false,
    errors: []
  })

  const checkProcessingCount = async () => {
    try {
      const response = await fetch('/api/sync/generations', {
        method: 'GET'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSyncStatus(prev => ({
          ...prev,
          processingCount: data.processingCount || 0
        }))
        
        return data.processingCount || 0
      }
    } catch (error) {
      console.error('Error checking processing count:', error)
    }
    return 0
  }

  const syncGenerations = async () => {
    if (syncStatus.syncInProgress) return

    setSyncStatus(prev => ({ ...prev, syncInProgress: true, errors: [] }))
    
    try {
      console.log('🔄 Starting generation sync...')
      
      const response = await fetch('/api/sync/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Sync completed:', data)
        
        if (data.syncedCount > 0) {
          // Show simple success message
          console.log(`✅ Sincronizadas ${data.syncedCount} gerações!`)
          
          // Refresh the page to show updated generations
          window.location.reload()
        }
        
        setSyncStatus(prev => ({
          ...prev,
          syncInProgress: false,
          lastSyncAt: new Date(),
          processingCount: Math.max(0, prev.processingCount - data.syncedCount)
        }))
      } else {
        throw new Error(`Sync failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Sync error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      setSyncStatus(prev => ({
        ...prev,
        syncInProgress: false,
        errors: [...prev.errors, errorMessage]
      }))
      
      console.error(`❌ Erro na sincronização: ${errorMessage}`)
    }
  }

  // Check for processing generations on mount and periodically
  useEffect(() => {
    let interval: NodeJS.Timeout
    let consecutiveEmptyChecks = 0

    const startPolling = async () => {
      // Initial check
      const count = await checkProcessingCount()

      if (count > 0) {
        console.log(`📋 Found ${count} processing generations, starting sync...`)
        await syncGenerations()
        consecutiveEmptyChecks = 0
      } else {
        consecutiveEmptyChecks++
      }

      // Set up adaptive polling for processing generations
      interval = setInterval(async () => {
        const currentCount = await checkProcessingCount()

        if (currentCount > 0) {
          consecutiveEmptyChecks = 0
          if (!syncStatus.syncInProgress) {
            console.log(`🔄 Auto-sync triggered for ${currentCount} processing generations`)
            await syncGenerations()
          }
        } else {
          consecutiveEmptyChecks++
        }

        // If no processing generations for a while, increase polling interval
        if (consecutiveEmptyChecks > 5) {
          clearInterval(interval)
          console.log('😴 No processing generations found for a while, reducing polling frequency')

          // Check less frequently when there's nothing to process
          interval = setInterval(async () => {
            const count = await checkProcessingCount()
            if (count > 0) {
              // Resume normal polling if we find processing generations again
              clearInterval(interval)
              startPolling()
            }
          }, 120000) // Check every 2 minutes when idle
        }
      }, 30000) // Check every 30 seconds normally
    }

    startPolling()

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [])

  // Manual sync button for debugging
  if (process.env.NODE_ENV === 'development' && syncStatus.processingCount > 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-800 font-medium">
              {syncStatus.processingCount} gerações pendentes
            </span>
            <button
              onClick={syncGenerations}
              disabled={syncStatus.syncInProgress}
              className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {syncStatus.syncInProgress ? '⏳' : '🔄 Sync'}
            </button>
          </div>
          
          {syncStatus.lastSyncAt && (
            <p className="text-xs text-yellow-600">
              Última sync: {syncStatus.lastSyncAt.toLocaleTimeString()}
            </p>
          )}
          
          {syncStatus.errors.length > 0 && (
            <div className="mt-2">
              {syncStatus.errors.map((error, i) => (
                <p key={i} className="text-xs text-red-600">❌ {error}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default GenerationSync