'use client'

import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

// Global toast state
let globalToasts: Toast[] = []
const globalListeners: Set<() => void> = new Set()

export function useToast(): ToastContextValue {
  const [, forceUpdate] = useState({})

  const rerender = useCallback(() => {
    forceUpdate({})
  }, [])

  // Subscribe to global state changes
  if (!globalListeners.has(rerender)) {
    globalListeners.add(rerender)
  }

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration || 5000
    }

    globalToasts = [...globalToasts, newToast]
    
    // Notify all listeners
    globalListeners.forEach(listener => listener())

    // Auto remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    globalToasts = globalToasts.filter(toast => toast.id !== id)
    globalListeners.forEach(listener => listener())
  }, [])

  const clearToasts = useCallback(() => {
    globalToasts = []
    globalListeners.forEach(listener => listener())
  }, [])

  return {
    toasts: globalToasts,
    addToast,
    removeToast,
    clearToasts
  }
}

// Convenience functions (non-hook versions)
export function showSuccessToast(title: string, description?: string) {
  const id = Math.random().toString(36).substr(2, 9)
  const newToast: Toast = {
    id,
    type: 'success',
    title,
    description,
    duration: 5000
  }

  globalToasts = [...globalToasts, newToast]
  globalListeners.forEach(listener => listener())

  setTimeout(() => {
    globalToasts = globalToasts.filter(toast => toast.id !== id)
    globalListeners.forEach(listener => listener())
  }, newToast.duration!)

  return id
}

export function showErrorToast(title: string, description?: string) {
  const id = Math.random().toString(36).substr(2, 9)
  const newToast: Toast = {
    id,
    type: 'error',
    title,
    description,
    duration: 6000
  }

  globalToasts = [...globalToasts, newToast]
  globalListeners.forEach(listener => listener())

  setTimeout(() => {
    globalToasts = globalToasts.filter(toast => toast.id !== id)
    globalListeners.forEach(listener => listener())
  }, newToast.duration!)

  return id
}