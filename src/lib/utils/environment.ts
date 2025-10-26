/**
 * Environment detection and webhook configuration utilities
 * Centralizes environment detection logic to ensure consistent behavior
 * across polling and webhook systems
 */

/**
 * Check if the application is running in production environment
 */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if the application is running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if HTTPS is available (required for webhooks)
 */
export function hasHttpsEnabled(): boolean {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  return baseUrl.startsWith('https://')
}

/**
 * Check if webhooks should be used (production + HTTPS)
 */
export function shouldUseWebhooks(): boolean {
  return isProductionEnvironment() && hasHttpsEnabled()
}

/**
 * Check if polling should be used as primary method
 * Returns true in development or when webhooks are not available
 */
export function shouldUsePolling(): boolean {
  return !shouldUseWebhooks()
}

/**
 * Get the base URL for webhooks
 * Returns undefined if webhooks should not be used
 */
export function getWebhookBaseUrl(): string | undefined {
  if (!shouldUseWebhooks()) {
    return undefined
  }
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
}

/**
 * Get Asaas environment (production or sandbox)
 */
export function getAsaasEnvironment(): 'production' | 'sandbox' {
  const env = process.env.ASAAS_ENVIRONMENT

  // Validate that production environment has production API key
  if (env === 'production') {
    const apiKey = process.env.ASAAS_API_KEY || ''
    if (!apiKey.startsWith('$aact_prod_')) {
      console.warn('⚠️ ASAAS_ENVIRONMENT is set to production but API key is not a production key!')
      console.warn('⚠️ API key should start with $aact_prod_. Falling back to sandbox.')
      return 'sandbox'
    }
  }

  return env === 'production' ? 'production' : 'sandbox'
}

/**
 * Get Asaas API base URL based on environment
 */
export function getAsaasApiUrl(): string {
  const env = getAsaasEnvironment()
  return env === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

/**
 * Get Asaas checkout base URL based on environment
 */
export function getAsaasCheckoutUrl(): string {
  const env = getAsaasEnvironment()
  return env === 'production'
    ? 'https://www.asaas.com'
    : 'https://sandbox.asaas.com'
}

/**
 * Validate that all required environment variables are set for production
 * Logs warnings for missing or misconfigured variables
 */
export function validateProductionEnvironment(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isProductionEnvironment()) {
    return { isValid: true, errors, warnings }
  }

  // Check NEXTAUTH_URL
  if (!process.env.NEXTAUTH_URL) {
    errors.push('NEXTAUTH_URL is not set')
  } else if (!process.env.NEXTAUTH_URL.startsWith('https://')) {
    errors.push('NEXTAUTH_URL must use HTTPS in production')
  }

  // Check NEXTAUTH_SECRET
  if (!process.env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET is not set')
  } else if (process.env.NEXTAUTH_SECRET.includes('dev') || process.env.NEXTAUTH_SECRET.includes('local')) {
    warnings.push('NEXTAUTH_SECRET appears to be a development key')
  }

  // Check Asaas configuration
  if (!process.env.ASAAS_API_KEY) {
    errors.push('ASAAS_API_KEY is not set')
  } else {
    const env = getAsaasEnvironment()
    const apiKey = process.env.ASAAS_API_KEY

    if (env === 'production' && !apiKey.startsWith('$aact_prod_')) {
      errors.push('ASAAS_API_KEY is not a production key (should start with $aact_prod_)')
    } else if (env === 'sandbox' && !apiKey.startsWith('$aact_hmlg_')) {
      warnings.push('ASAAS_API_KEY is not a sandbox key (should start with $aact_hmlg_)')
    }
  }

  // Check webhook secrets
  if (!process.env.ASAAS_WEBHOOK_TOKEN) {
    warnings.push('ASAAS_WEBHOOK_TOKEN is not set - webhooks are insecure')
  }

  if (!process.env.REPLICATE_WEBHOOK_SECRET) {
    warnings.push('REPLICATE_WEBHOOK_SECRET is not set - webhooks are insecure')
  }

  if (!process.env.ASTRIA_WEBHOOK_SECRET) {
    warnings.push('ASTRIA_WEBHOOK_SECRET is not set - webhooks are insecure')
  }

  // Check database
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Log environment configuration at startup
 */
export function logEnvironmentInfo(): void {
  console.log('='.repeat(80))
  console.log('🌍 ENVIRONMENT CONFIGURATION')
  console.log('='.repeat(80))
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('HTTPS Enabled:', hasHttpsEnabled())
  console.log('Use Webhooks:', shouldUseWebhooks())
  console.log('Use Polling:', shouldUsePolling())
  console.log('Webhook Base URL:', getWebhookBaseUrl() || 'Not configured')
  console.log('Asaas Environment:', getAsaasEnvironment())
  console.log('Asaas API URL:', getAsaasApiUrl())
  console.log('Asaas Checkout URL:', getAsaasCheckoutUrl())

  const validation = validateProductionEnvironment()

  if (validation.errors.length > 0) {
    console.log('='.repeat(80))
    console.error('❌ CONFIGURATION ERRORS:')
    validation.errors.forEach(error => console.error(`  - ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.log('='.repeat(80))
    console.warn('⚠️ CONFIGURATION WARNINGS:')
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  console.log('='.repeat(80))
}
