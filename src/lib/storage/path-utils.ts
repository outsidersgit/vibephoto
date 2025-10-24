/**
 * Storage path utilities for consistent file organization
 * Provides unified path generation for all media types across the application
 * New structure: generated/{userId}/{category}/filename.ext
 */

export type MediaType = 'IMAGE' | 'VIDEO'
export type StorageContext = 'generation' | 'training' | 'edit' | 'upscale'

// Controlled categories - whitelist for validation
export type ValidCategory = 'images' | 'videos' | 'edited' | 'upscaled' | 'thumbnails'

const VALID_CATEGORIES: ValidCategory[] = ['images', 'videos', 'edited', 'upscaled', 'thumbnails']

/**
 * Validate if category is allowed
 * @param category Category to validate
 * @returns boolean indicating if category is valid
 */
export function isValidCategory(category: string): category is ValidCategory {
  return VALID_CATEGORIES.includes(category as ValidCategory)
}

/**
 * Validate category and throw error if invalid
 * @param category Category to validate
 * @throws Error if category is invalid
 */
export function validateCategory(category: string): asserts category is ValidCategory {
  if (!isValidCategory(category)) {
    throw new Error(`Invalid category: ${category}. Allowed categories: ${VALID_CATEGORIES.join(', ')}`)
  }
}

/**
 * Generate unique filename with UUID and timestamp
 * @param ext File extension without dot (e.g., 'jpg', 'mp4')
 * @returns Unique filename like 'cluid123_1703123456789.jpg'
 */
export function generateUniqueFilename(ext: string): string {
  // Normalize extension (remove dot if present)
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext

  // Generate UUID-like string (simplified)
  const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now()

  return `${uuid}_${timestamp}.${cleanExt}`
}

/**
 * Build standardized S3 key following pattern: generated/{userId}/{category}/filename.ext
 * @param userId User ID who owns the media
 * @param category Storage category (controlled whitelist)
 * @param filename Unique filename
 * @returns Standardized S3 key like 'generated/userId123/images/uuid_timestamp.jpg'
 */
export function buildS3Key(
  userId: string,
  category: ValidCategory,
  filename: string
): string {
  validateCategory(category)
  return `generated/${userId}/${category}/${filename}`
}

/**
 * Build a consistent storage key/path for media files
 * @param type Media type ('IMAGE' | 'VIDEO')
 * @param userId User ID who owns the media
 * @param id Unique identifier (generation ID, model ID, etc.)
 * @param ext File extension without dot (e.g., 'jpg', 'mp4')
 * @param context Optional context for organization (default: 'generation')
 * @returns Consistent storage path like 'generated/userId/images/uuid_timestamp.jpg'
 */
export function buildKey(
  type: MediaType,
  userId: string,
  id: string,
  ext: string,
  context: StorageContext = 'generation'
): string {
  // Determine category from type and context
  let category: ValidCategory
  if (type === 'VIDEO') {
    category = 'videos'
  } else if (context === 'edit') {
    category = 'edited'
  } else if (context === 'upscale') {
    category = 'upscaled'
  } else {
    category = 'images'
  }

  // Generate unique filename incorporating ID
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext
  const timestamp = Date.now()
  const filename = `${id}_${timestamp}.${cleanExt}`

  return buildS3Key(userId, category, filename)
}

/**
 * Build thumbnail key for an existing media key
 * @param originalKey The original media key
 * @returns Thumbnail key in thumbnails category
 */
export function buildThumbnailKey(originalKey: string): string {
  try {
    const parsed = parseStorageKey(originalKey)
    if (!parsed) {
      // Fallback for legacy format
      const parts = originalKey.split('/')
      const filename = parts[parts.length - 1]
      const [name, ext] = filename.split('.')
      parts[parts.length - 1] = `thumb_${name}.${ext}`
      return parts.join('/')
    }

    // New standardized format: generated/{userId}/thumbnails/filename.ext
    const thumbnailFilename = generateUniqueFilename(parsed.ext)
    return buildS3Key(parsed.userId, 'thumbnails', thumbnailFilename)
  } catch {
    // Fallback for any parsing errors
    const parts = originalKey.split('/')
    const filename = parts[parts.length - 1]
    const [name, ext] = filename.split('.')
    parts[parts.length - 1] = `thumb_${name}.${ext}`
    return parts.join('/')
  }
}

/**
 * Extract metadata from a storage key
 * @param key Storage key to parse
 * @returns Parsed metadata or null if invalid format
 */
export function parseStorageKey(key: string): {
  type: MediaType
  userId: string
  id: string
  ext: string
  isThumbnail: boolean
  category?: ValidCategory
} | null {
  try {
    const parts = key.split('/')

    // New standardized format: generated/{userId}/{category}/filename.ext
    if (parts.length === 4 && parts[0] === 'generated') {
      const [, userId, category, filename] = parts

      if (!isValidCategory(category)) return null

      const lastDotIndex = filename.lastIndexOf('.')
      if (lastDotIndex === -1) return null

      const ext = filename.substring(lastDotIndex + 1)
      const nameWithoutExt = filename.substring(0, lastDotIndex)

      // Extract ID from filename (format: id_timestamp or uuid_timestamp)
      const underscoreIndex = nameWithoutExt.indexOf('_')
      const id = underscoreIndex > 0 ? nameWithoutExt.substring(0, underscoreIndex) : nameWithoutExt

      let type: MediaType
      if (category === 'videos') {
        type = 'VIDEO'
      } else {
        type = 'IMAGE'
      }

      const isThumbnail = category === 'thumbnails'

      return {
        type,
        userId,
        id,
        ext,
        isThumbnail,
        category
      }
    }

    // Legacy format: typeFolder/userId/filename.ext
    if (parts.length === 3) {
      const [typeFolder, userId, filename] = parts
      const lastDotIndex = filename.lastIndexOf('.')
      if (lastDotIndex === -1) return null

      const ext = filename.substring(lastDotIndex + 1)
      const nameWithoutExt = filename.substring(0, lastDotIndex)

      // Determine type from folder
      let type: MediaType
      if (typeFolder === 'images') type = 'IMAGE'
      else if (typeFolder === 'videos') type = 'VIDEO'
      else return null

      // Check if it's a thumbnail
      const isThumbnail = nameWithoutExt.startsWith('thumb_')
      const id = isThumbnail ? nameWithoutExt.replace('thumb_', '') : nameWithoutExt

      return {
        type,
        userId,
        id,
        ext,
        isThumbnail
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if a key follows the new consistent format
 * @param key Storage key to validate
 * @returns true if key follows new format
 */
export function isConsistentKey(key: string): boolean {
  const parsed = parseStorageKey(key)
  return parsed !== null && parsed.category !== undefined
}

/**
 * Convert legacy paths to new consistent format
 * @param legacyKey Old storage key (e.g., 'images/userId/generationId.jpg' or 'generated/userId/generationId/image_0.png')
 * @param type Media type for the conversion
 * @param userId User ID
 * @param id Generation/model ID
 * @returns New consistent key or null if conversion not possible
 */
export function convertLegacyKey(
  legacyKey: string,
  type: MediaType,
  userId: string,
  id: string
): string | null {
  try {
    // Extract extension from legacy key
    const lastDotIndex = legacyKey.lastIndexOf('.')
    if (lastDotIndex === -1) return null

    const ext = legacyKey.substring(lastDotIndex + 1)
    return buildKey(type, userId, id, ext)
  } catch {
    return null
  }
}

/**
 * Get the category for a media type
 * @param type Media type
 * @param context Storage context
 * @returns Category name
 */
export function getCategoryForMediaType(type: MediaType, context: StorageContext = 'generation'): ValidCategory {
  if (type === 'VIDEO') {
    return 'videos'
  } else if (context === 'edit') {
    return 'edited'
  } else if (context === 'upscale') {
    return 'upscaled'
  } else {
    return 'images'
  }
}

/**
 * Build poster key for video (thumbnail)
 * @param videoKey Original video key
 * @param userId User ID who owns the video
 * @returns Poster/thumbnail key in thumbnails category
 */
export function buildPosterKey(videoKey: string, userId?: string): string {
  try {
    const parsed = parseStorageKey(videoKey)
    if (parsed && parsed.userId) {
      // Use thumbnails category for video posters
      const posterFilename = generateUniqueFilename('jpg')
      return buildS3Key(parsed.userId, 'thumbnails', posterFilename)
    }

    // Fallback for legacy format or when userId is provided
    if (userId) {
      const posterFilename = generateUniqueFilename('jpg')
      return buildS3Key(userId, 'thumbnails', posterFilename)
    }

    // Last resort: use legacy format
    const parts = videoKey.split('/')
    const filename = parts[parts.length - 1]
    const [name] = filename.split('.')

    // Use images folder for video thumbnails/posters (legacy)
    return `images/${parts[1]}/${name}.jpg`
  } catch {
    // Fallback for any errors
    if (userId) {
      const posterFilename = generateUniqueFilename('jpg')
      return buildS3Key(userId, 'thumbnails', posterFilename)
    }

    const parts = videoKey.split('/')
    const filename = parts[parts.length - 1]
    const [name] = filename.split('.')
    return `images/${parts[1]}/${name}.jpg`
  }
}