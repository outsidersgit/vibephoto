'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ConsentPreferences {
  essential: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
}

interface ConsentData {
  preferences: ConsentPreferences
  timestamp: string
  version: string
}

const CONSENT_VERSION = '1.0'
const CONSENT_KEY = 'ensaio_fotos_consent'

const defaultPreferences: ConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false
}

export function useConsent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null)
  const [preferences, setPreferences] = useState<ConsentPreferences>(defaultPreferences)
  const [showModal, setShowModal] = useState(false)

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    
    if (stored) {
      try {
        const consentData: ConsentData = JSON.parse(stored)
        
        // Check if consent is from current version
        if (consentData.version === CONSENT_VERSION) {
          setPreferences(consentData.preferences)
          setHasConsent(true)
        } else {
          // Version mismatch, ask for consent again
          setHasConsent(false)
          setShowModal(true)
        }
      } catch (error) {
        console.error('Error parsing consent data:', error)
        setHasConsent(false)
        setShowModal(true)
      }
    } else {
      // No previous consent found
      setHasConsent(false)
      setShowModal(true)
    }
  }, [])

  const saveConsent = useCallback((newPreferences: ConsentPreferences) => {
    const consentData: ConsentData = {
      preferences: newPreferences,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION
    }

    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData))
    setPreferences(newPreferences)
    setHasConsent(true)
    setShowModal(false)

    // Apply consent settings
    applyConsentSettings(newPreferences)

    // Send consent to backend (optional)
    sendConsentToBackend(newPreferences)
  }, [])

  const applyConsentSettings = useCallback((prefs: ConsentPreferences) => {
    // Apply functional cookies
    if (!prefs.functional) {
      // Remove functional cookies
      removeFunctionalCookies()
    }

    // Apply analytics cookies
    if (!prefs.analytics) {
      // Remove analytics cookies and disable tracking
      removeAnalyticsCookies()
      disableAnalytics()
    } else {
      enableAnalytics()
    }

    // Marketing cookies are always disabled in our case
    removeMarketingCookies()
  }, [])

  const removeFunctionalCookies = () => {
    const functionalCookies = [
      'theme_preference',
      'language_pref', 
      'gallery_view',
      'notification_settings'
    ]
    
    functionalCookies.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  }

  const removeAnalyticsCookies = () => {
    const analyticsCookies = [
      '_analytics_id',
      'page_views',
      'feature_usage',
      'performance_metrics'
    ]
    
    analyticsCookies.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  }

  const removeMarketingCookies = () => {
    // We don't use marketing cookies, but this is for completeness
    const marketingCookies: string[] = []
    
    marketingCookies.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  }

  const disableAnalytics = () => {
    // Disable analytics tracking
    if (typeof window !== 'undefined') {
      (window as any).analyticsDisabled = true
    }
  }

  const enableAnalytics = () => {
    // Enable analytics tracking
    if (typeof window !== 'undefined') {
      (window as any).analyticsDisabled = false
    }
  }

  const sendConsentToBackend = async (prefs: ConsentPreferences) => {
    try {
      // Optional: Send consent preferences to backend for logging
      await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferences: prefs,
          timestamp: new Date().toISOString(),
          version: CONSENT_VERSION
        })
      })
    } catch (error) {
      console.error('Error sending consent to backend:', error)
      // Don't block user if backend fails
    }
  }

  const revokeConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_KEY)
    setPreferences(defaultPreferences)
    setHasConsent(false)
    setShowModal(true)
    
    // Remove all non-essential cookies
    removeFunctionalCookies()
    removeAnalyticsCookies()
    removeMarketingCookies()
    disableAnalytics()
  }, [])

  const updatePreferences = useCallback((newPreferences: ConsentPreferences) => {
    saveConsent(newPreferences)
  }, [saveConsent])

  // Utility functions for components
  const canUseAnalytics = preferences.analytics
  const canUseFunctional = preferences.functional

  return {
    hasConsent,
    preferences,
    showModal,
    saveConsent,
    revokeConsent,
    updatePreferences,
    canUseAnalytics,
    canUseFunctional,
    setShowModal
  }
}