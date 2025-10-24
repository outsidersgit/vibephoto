import { StorageProvider } from './base'
import { AWSS3Provider } from './providers/aws-s3'
import { CloudinaryProvider } from './providers/cloudinary'
import { LocalStorageProvider } from './providers/local'
import { STORAGE_CONFIG } from './config'

let storageInstance: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    switch (STORAGE_CONFIG.provider) {
      case 'aws':
        storageInstance = new AWSS3Provider()
        break
      case 'cloudinary':
        storageInstance = new CloudinaryProvider()
        break
      case 'local':
      default:
        storageInstance = new LocalStorageProvider()
        break
    }
  }
  
  return storageInstance
}

// Re-export types and config for convenience
export * from './base'
export * from './config'
export { AWSS3Provider } from './providers/aws-s3'
export { CloudinaryProvider } from './providers/cloudinary'
export { LocalStorageProvider } from './providers/local'