'use client'

import { useEffect } from 'react'

export function AutoStorageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Start auto storage service when the app loads (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Initializing automatic storage service for development mode...')
      
      // Call the API to start the service
      fetch('/api/auto-storage/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          console.log('✅ Auto storage service started successfully')
        } else {
          console.error('❌ Failed to start auto storage service:', data.error)
        }
      })
      .catch((error) => {
        console.error('❌ Error starting auto storage service:', error)
      })

      // Cleanup function to stop the service when unmounting
      return () => {
        fetch('/api/auto-storage/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }).catch((error) => {
          console.error('Error stopping auto storage service:', error)
        })
      }
    }
  }, [])

  return <>{children}</>
}