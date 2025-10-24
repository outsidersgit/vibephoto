'use client'

import { useState, useEffect } from 'react'
import {
  isMobile,
  isTablet,
  isDesktop,
  isBrowser,
  isIOS,
  isAndroid,
  isSafari,
  isChrome,
  isFirefox
} from 'react-device-detect'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isBrowser: boolean
  isIOS: boolean
  isAndroid: boolean
  isSafari: boolean
  isChrome: boolean
  isFirefox: boolean
  userAgent: string
  screenWidth: number
  screenHeight: number
  hasShareAPI: boolean
  hasTouchScreen: boolean
}

/**
 * Hook para detectar informações do dispositivo
 * Combina react-device-detect com user agent e APIs nativas
 */
export function useDeviceDetector(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isBrowser: true,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    userAgent: '',
    screenWidth: 0,
    screenHeight: 0,
    hasShareAPI: false,
    hasTouchScreen: false
  })

  useEffect(() => {
    // Função para detectar Web Share API
    const hasShareAPI = typeof navigator !== 'undefined' && 'share' in navigator

    // Função para detectar touch screen
    const hasTouchScreen = typeof window !== 'undefined' && (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    )

    // Obter dimensões da tela
    const screenWidth = typeof window !== 'undefined' ? window.screen.width : 0
    const screenHeight = typeof window !== 'undefined' ? window.screen.height : 0

    // Obter user agent
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

    setDeviceInfo({
      isMobile,
      isTablet,
      isDesktop,
      isBrowser,
      isIOS,
      isAndroid,
      isSafari,
      isChrome,
      isFirefox,
      userAgent,
      screenWidth,
      screenHeight,
      hasShareAPI,
      hasTouchScreen
    })
  }, [])

  return deviceInfo
}

/**
 * Função utilitária para detectar se é um dispositivo móvel
 * Pode ser usada fora de componentes React
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Verificação por largura da tela
  const screenWidth = window.screen.width
  if (screenWidth <= 768) return true

  // Verificação por user agent
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = [
    'android', 'webos', 'iphone', 'ipad', 'ipod',
    'blackberry', 'iemobile', 'opera mini', 'mobile'
  ]

  return mobileKeywords.some(keyword => userAgent.includes(keyword))
}

/**
 * Função para detectar se o dispositivo suporta Web Share API
 */
export function hasNativeShareSupport(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator
}

/**
 * Função para detectar se o dispositivo suporta File System Access API
 */
export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

/**
 * Função para detectar se o dispositivo pode fazer download de arquivos
 */
export function canDownloadFiles(): boolean {
  // Desktop browsers geralmente suportam downloads
  if (isDesktop) return true

  // Mobile browsers modernos também suportam
  return typeof document !== 'undefined' && 'createElement' in document
}

/**
 * Função para detectar o sistema operacional
 */
export function getOperatingSystem(): 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown'

  const userAgent = navigator.userAgent.toLowerCase()

  if (isIOS || userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'ios'
  }

  if (isAndroid || userAgent.includes('android')) {
    return 'android'
  }

  if (userAgent.includes('windows')) {
    return 'windows'
  }

  if (userAgent.includes('mac')) {
    return 'macos'
  }

  if (userAgent.includes('linux')) {
    return 'linux'
  }

  return 'unknown'
}

/**
 * Função para detectar se o usuário está em um PWA
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

/**
 * Função para obter informações completas do dispositivo
 * Versão síncrona para uso em funções regulares
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isBrowser: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      userAgent: '',
      screenWidth: 0,
      screenHeight: 0,
      hasShareAPI: false,
      hasTouchScreen: false
    }
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    isBrowser,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    hasShareAPI: hasNativeShareSupport(),
    hasTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }
}