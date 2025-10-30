import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a localized string
 * @param date - Date object, string, or timestamp
 * @returns Formatted date string (e.g., "25 de out. de 2024, 14:30")
 */
export function formatDate(date: Date | string | number): string {
  try {
    const dateObj = date instanceof Date ? date : new Date(date)

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Data inválida'
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj)
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Data inválida'
  }
}

// Currency formatter commonly used across payments UI
export function formatCurrency(value: number, currency: string = 'BRL', locale: string = 'pt-BR'): string {
  try {
    const num = typeof value === 'number' ? value : Number(value)
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(isNaN(num) ? 0 : num)
  } catch {
    return `${value}`
  }
}

// Relative date like "há 2 dias" or "em 3 horas"
export function formatRelativeDate(date: Date | string | number, base: Date = new Date(), locale: string = 'pt-BR'): string {
  try {
    const d = date instanceof Date ? date : new Date(date)
    const diffMs = d.getTime() - base.getTime()
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    const seconds = Math.round(diffMs / 1000)
    const minutes = Math.round(seconds / 60)
    const hours = Math.round(minutes / 60)
    const days = Math.round(hours / 24)
    const months = Math.round(days / 30)
    const years = Math.round(days / 365)

    if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second')
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
    if (Math.abs(days) < 30) return rtf.format(days, 'day')
    if (Math.abs(months) < 12) return rtf.format(months, 'month')
    return rtf.format(years, 'year')
  } catch {
    return formatDate(date)
  }
}
