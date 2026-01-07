'use client'

import { useState, useCallback, useEffect } from 'react'
import { configureErrorNotifications } from '@/lib/errors/notify'

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
let isNotificationConfigured = false

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
      // Duração padrão: 10s para erros, 5s para outros tipos
      duration: toast.duration || (toast.type === 'error' ? 10000 : 5000)
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

  // CRITICAL: Configure error notification system once
  useEffect(() => {
    if (!isNotificationConfigured) {
      configureErrorNotifications(addToast)
      isNotificationConfigured = true
    }
  }, [addToast])

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
    duration: 10000 // 10 segundos para dar tempo de ler mensagens de erro
  }

  globalToasts = [...globalToasts, newToast]
  globalListeners.forEach(listener => listener())

  setTimeout(() => {
    globalToasts = globalToasts.filter(toast => toast.id !== id)
    globalListeners.forEach(listener => listener())
  }, newToast.duration!)

  return id
}