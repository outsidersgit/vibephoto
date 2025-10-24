import { AIProvider } from './base'
import { ReplicateProvider } from './providers/replicate'
import { RunPodProvider } from './providers/runpod'
import { LocalProvider } from './providers/local'
import { AstriaProvider } from './providers/astria'
import { HybridAIProvider } from './hybrid-provider'
import { AI_CONFIG } from './config'

let aiInstance: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (!aiInstance) {
    switch (AI_CONFIG.provider) {
      case 'replicate':
        aiInstance = new ReplicateProvider()
        break
      case 'runpod':
        aiInstance = new RunPodProvider()
        break
      case 'astria':
        aiInstance = new AstriaProvider()
        break
      case 'hybrid':
        aiInstance = new HybridAIProvider()
        break
      case 'local':
      default:
        aiInstance = new LocalProvider()
        break
    }
  }

  return aiInstance
}

// Re-export types and utilities for convenience
export * from './base'
export * from './config'
export { ReplicateProvider } from './providers/replicate'
export { RunPodProvider } from './providers/runpod'
export { LocalProvider } from './providers/local'
export { AstriaProvider } from './providers/astria'
export { HybridAIProvider } from './hybrid-provider'

// Utility function to check if AI provider is properly configured
export function isAIProviderConfigured(): boolean {
  try {
    const provider = getAIProvider()
    return true
  } catch (error) {
    return false
  }
}

// Helper function to get provider info
export function getProviderInfo() {
  return {
    current: AI_CONFIG.provider,
    available: ['replicate', 'runpod', 'local', 'astria', 'hybrid'],
    configured: isAIProviderConfigured()
  }
}