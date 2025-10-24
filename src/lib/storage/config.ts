export const STORAGE_CONFIG = {
  // Provider selection: 's3' | 'cloudinary' | 'local'
  provider: (process.env.STORAGE_PROVIDER || 'local') as 'aws' | 'cloudinary' | 'local',
  
  // AWS S3 Configuration
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || '',
    cloudFrontUrl: process.env.AWS_CLOUDFRONT_URL || ''
  },
  
  // Cloudinary Configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'ensaio-fotos'
  },
  
  // File upload constraints
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB for videos
    maxFiles: 20,
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/avi',
      'video/mov'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.avi', '.mov']
  },
  
  // Image processing settings
  processing: {
    // Face photos (smaller, square aspect ratio preferred)
    face: {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 90,
      format: 'jpeg'
    },
    // Body photos (can be larger, various aspect ratios)
    body: {
      maxWidth: 1536,
      maxHeight: 2048,
      quality: 85,
      format: 'jpeg'
    },
    // Generated images
    generated: {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 90,
      format: 'jpeg'
    },
    // Thumbnails
    thumbnail: {
      width: 300,
      height: 300,
      quality: 80,
      format: 'jpeg'
    }
  }
}

export const UPLOAD_PATHS = {
  training: {
    face: 'training/face',
    body: 'training/body'
  },
  // New standardized structure: generated/{userId}/{category}/
  generated: {
    images: 'generated/{userId}/images',
    videos: 'generated/{userId}/videos',
    edited: 'generated/{userId}/edited',
    upscaled: 'generated/{userId}/upscaled',
    thumbnails: 'generated/{userId}/thumbnails'
  },
  // Legacy paths (to be migrated)
  legacy: {
    generated: 'generated',
    videos: 'videos',
    thumbnails: 'thumbnails'
  },
  temp: 'temp'
} as const

// Valid categories for standardized uploads
export const VALID_UPLOAD_CATEGORIES = [
  'images',
  'videos',
  'edited',
  'upscaled',
  'thumbnails'
] as const

export type UploadCategory = typeof VALID_UPLOAD_CATEGORIES[number]

/**
 * Validate if upload category is allowed
 * @param category Category to validate
 * @returns boolean indicating if category is valid
 */
export function isValidUploadCategory(category: string): category is UploadCategory {
  return VALID_UPLOAD_CATEGORIES.includes(category as UploadCategory)
}

/**
 * Get standardized upload path for category
 * @param userId User ID
 * @param category Upload category
 * @returns Standardized path
 */
export function getStandardizedUploadPath(userId: string, category: UploadCategory): string {
  return `generated/${userId}/${category}`
}