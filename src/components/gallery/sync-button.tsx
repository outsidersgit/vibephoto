'use client'

import { useState } from 'react'

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const handleSync = async () => {
    if (isSyncing) return

    setIsSyncing(true)
    
    try {
      console.log('🔄 Manual sync triggered...')
      
      const response = await fetch('/api/sync/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Manual sync completed:', data)
        
        setLastSync(new Date())
        
        if (data.syncedCount > 0) {
          // Refresh the page to show updated generations
          window.location.reload()
        } else {
          console.log('ℹ️ No updates needed')
        }
      } else {
        console.error('❌ Manual sync failed:', response.statusText)
      }
    } catch (error) {
      console.error('❌ Manual sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`
          inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md
          ${isSyncing 
            ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
            : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }
        `}
        title="Sincronizar gerações pendentes com Replicate"
      >
        <span className={`mr-1 ${isSyncing ? 'animate-spin' : ''}`}>
          {isSyncing ? '⏳' : '🔄'}
        </span>
        {isSyncing ? 'Sincronizando...' : 'Sync'}
      </button>
      
      {lastSync && (
        <span className="text-xs text-gray-500">
          Última sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}