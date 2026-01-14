'use client'

import { useEffect } from 'react'
import { gcDrafts } from '@/lib/utils/indexed-db-persistence'

/**
 * Draft Garbage Collector Provider
 * Runs on app start to clean expired drafts (24h TTL)
 */
export function DraftGCProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Run GC on mount (app start)
    gcDrafts(24) // 24h TTL

    // Optional: Run GC periodically (every 6 hours)
    const interval = setInterval(() => {
      gcDrafts(24)
    }, 6 * 60 * 60 * 1000) // 6 hours

    return () => clearInterval(interval)
  }, [])

  return <>{children}</>
}
