'use client'

import { useState, useEffect, useCallback } from 'react'

export interface EditSession {
  id: string
  originalImage: string
  result: any
  operation: string
  prompt: string
  timestamp: number
}

const EDIT_HISTORY_KEY = 'image_editor_history'
const MAX_HISTORY_ITEMS = 10

export function useEditHistory() {
  const [history, setHistory] = useState<EditSession[]>([])
  const [currentSession, setCurrentSession] = useState<EditSession | null>(null)

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedHistory = localStorage.getItem(EDIT_HISTORY_KEY)
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory)
          setHistory(parsed)
        }
      } catch (error) {
        console.error('Failed to load edit history:', error)
      }
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && history.length > 0) {
      try {
        localStorage.setItem(EDIT_HISTORY_KEY, JSON.stringify(history))
      } catch (error) {
        console.error('Failed to save edit history:', error)
      }
    }
  }, [history])

  const saveEditSession = useCallback((session: EditSession) => {
    setCurrentSession(session)
    setHistory(prev => {
      const newHistory = [session, ...prev.filter(item => item.id !== session.id)]
      return newHistory.slice(0, MAX_HISTORY_ITEMS)
    })
  }, [])

  const loadEditSession = useCallback((sessionId: string) => {
    const session = history.find(item => item.id === sessionId)
    if (session) {
      setCurrentSession(session)
      return session
    }
    return null
  }, [history])

  const clearHistory = () => {
    setHistory([])
    setCurrentSession(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(EDIT_HISTORY_KEY)
    }
  }

  const removeSession = (sessionId: string) => {
    setHistory(prev => prev.filter(item => item.id !== sessionId))
    if (currentSession?.id === sessionId) {
      setCurrentSession(null)
    }
  }

  return {
    history,
    currentSession,
    setCurrentSession,
    saveEditSession,
    loadEditSession,
    clearHistory,
    removeSession
  }
}