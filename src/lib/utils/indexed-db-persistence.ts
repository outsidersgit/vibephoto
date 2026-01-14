/**
 * IndexedDB Persistence Utilities
 * Uses IndexedDB for storing large files (no 5MB limit like localStorage)
 * Falls back to localStorage for small data
 */

import { ImageQualityAnalysisResult } from '@/types/image-quality'

const DB_NAME = 'VibePhotoStorage'
const DB_VERSION = 1
const STORES = {
  FILES: 'files',
  QUALITY: 'quality',
  PROMPTS: 'prompts'
}

/**
 * Initialize IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES)
      }
      if (!db.objectStoreNames.contains(STORES.QUALITY)) {
        db.createObjectStore(STORES.QUALITY)
      }
      if (!db.objectStoreNames.contains(STORES.PROMPTS)) {
        db.createObjectStore(STORES.PROMPTS)
      }
    }
  })
}

/**
 * Save files to IndexedDB
 */
export async function saveFilesToIndexedDB(key: string, files: File[]): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.FILES], 'readwrite')
    const store = transaction.objectStore(STORES.FILES)

    await new Promise<void>((resolve, reject) => {
      const request = store.put(files, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
    console.log(`✅ [IndexedDB] Saved ${files.length} files to ${key}`)
  } catch (error) {
    console.error(`❌ [IndexedDB] Error saving files to ${key}:`, error)
    throw error
  }
}

/**
 * Load files from IndexedDB
 */
export async function loadFilesFromIndexedDB(key: string): Promise<File[]> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.FILES], 'readonly')
    const store = transaction.objectStore(STORES.FILES)

    const files = await new Promise<File[]>((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })

    db.close()

    if (files.length > 0) {
      console.log(`✅ [IndexedDB] Loaded ${files.length} files from ${key}`)
    }

    return files
  } catch (error) {
    console.error(`❌ [IndexedDB] Error loading files from ${key}:`, error)
    return []
  }
}

/**
 * Delete files from IndexedDB
 */
export async function deleteFilesFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.FILES], 'readwrite')
    const store = transaction.objectStore(STORES.FILES)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
    console.log(`✅ [IndexedDB] Deleted ${key}`)
  } catch (error) {
    console.error(`❌ [IndexedDB] Error deleting ${key}:`, error)
  }
}

/**
 * Save quality results to IndexedDB
 */
export async function saveQualityToIndexedDB(
  key: string,
  results: Map<number, ImageQualityAnalysisResult>
): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.QUALITY], 'readwrite')
    const store = transaction.objectStore(STORES.QUALITY)

    const resultsArray = Array.from(results.entries())

    await new Promise<void>((resolve, reject) => {
      const request = store.put(resultsArray, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
    console.log(`✅ [IndexedDB] Saved ${results.size} quality results to ${key}`)
  } catch (error) {
    console.error(`❌ [IndexedDB] Error saving quality results to ${key}:`, error)
  }
}

/**
 * Load quality results from IndexedDB
 */
export async function loadQualityFromIndexedDB(
  key: string
): Promise<Map<number, ImageQualityAnalysisResult>> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.QUALITY], 'readonly')
    const store = transaction.objectStore(STORES.QUALITY)

    const resultsArray = await new Promise<any[]>((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })

    db.close()

    const results = new Map(resultsArray)

    if (results.size > 0) {
      console.log(`✅ [IndexedDB] Loaded ${results.size} quality results from ${key}`)
    }

    return results
  } catch (error) {
    console.error(`❌ [IndexedDB] Error loading quality results from ${key}:`, error)
    return new Map()
  }
}

/**
 * Save prompt to IndexedDB
 */
export async function savePromptToIndexedDB(key: string, prompt: string): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.PROMPTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROMPTS)

    await new Promise<void>((resolve, reject) => {
      const request = store.put(prompt, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
  } catch (error) {
    console.error(`❌ [IndexedDB] Error saving prompt to ${key}:`, error)
  }
}

/**
 * Load prompt from IndexedDB
 */
export async function loadPromptFromIndexedDB(key: string): Promise<string> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.PROMPTS], 'readonly')
    const store = transaction.objectStore(STORES.PROMPTS)

    const prompt = await new Promise<string>((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || '')
      request.onerror = () => reject(request.error)
    })

    db.close()
    return prompt
  } catch (error) {
    console.error(`❌ [IndexedDB] Error loading prompt from ${key}:`, error)
    return ''
  }
}

/**
 * Draft metadata structure
 */
interface DraftMetadata {
  createdAt: number
  updatedAt: number
  draftId: string
  finalizing: boolean
}

/**
 * Save draft metadata
 */
async function saveDraftMetadata(key: string, metadata: DraftMetadata): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.PROMPTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROMPTS)

    await new Promise<void>((resolve, reject) => {
      const request = store.put(metadata, `${key}_metadata`)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
  } catch (error) {
    console.error(`❌ [IndexedDB] Error saving metadata for ${key}:`, error)
  }
}

/**
 * Load draft metadata
 */
async function loadDraftMetadata(key: string): Promise<DraftMetadata | null> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.PROMPTS], 'readonly')
    const store = transaction.objectStore(STORES.PROMPTS)

    const metadata = await new Promise<DraftMetadata | null>((resolve, reject) => {
      const request = store.get(`${key}_metadata`)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })

    db.close()
    return metadata
  } catch (error) {
    console.error(`❌ [IndexedDB] Error loading metadata for ${key}:`, error)
    return null
  }
}

/**
 * Delete draft metadata
 */
async function deleteDraftMetadata(key: string): Promise<void> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORES.PROMPTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROMPTS)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(`${key}_metadata`)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
  } catch (error) {
    console.error(`❌ [IndexedDB] Error deleting metadata for ${key}:`, error)
  }
}

/**
 * Finalize draft (idempotent cleanup)
 * @param draftType - Type of draft to finalize
 * @param debug - Enable debug logging
 */
export async function finalizeDraft(
  draftType: 'editor' | 'video' | 'generation' | 'model',
  debug: boolean = typeof window !== 'undefined' && localStorage.getItem('DEBUG_DRAFTS') === 'true'
): Promise<void> {
  const timestamp = new Date().toISOString()

  if (debug) console.log(`🧹 [DRAFT] Finalizing ${draftType} draft at ${timestamp}`)

  try {
    switch (draftType) {
      case 'editor':
        await Promise.all([
          deleteFilesFromIndexedDB('editor_uploadedImages'),
          deleteFilesFromIndexedDB('editor_prompt'),
          deleteDraftMetadata('editor')
        ])
        if (debug) console.log(`✅ [DRAFT] Editor draft finalized`)
        break

      case 'video':
        // Clean IndexedDB
        await Promise.all([
          deleteFilesFromIndexedDB('video_prompt'),
          deleteDraftMetadata('video')
        ])
        // Clean localStorage (legacy)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('video_referenceImage')
          localStorage.removeItem('video_lastFrame')
        }
        if (debug) console.log(`✅ [DRAFT] Video draft finalized`)
        break

      case 'generation':
        await Promise.all([
          deleteFilesFromIndexedDB('generation_prompt'),
          deleteDraftMetadata('generation')
        ])
        if (debug) console.log(`✅ [DRAFT] Generation draft finalized`)
        break

      case 'model':
        await Promise.all([
          deleteFilesFromIndexedDB('model_facePhotos'),
          deleteFilesFromIndexedDB('model_halfBodyPhotos'),
          deleteFilesFromIndexedDB('model_fullBodyPhotos'),
          deleteFilesFromIndexedDB('facePhotosQuality'),
          deleteFilesFromIndexedDB('halfBodyPhotosQuality'),
          deleteFilesFromIndexedDB('fullBodyPhotosQuality'),
          deleteDraftMetadata('model')
        ])
        // Clean localStorage step marker
        if (typeof window !== 'undefined') {
          localStorage.removeItem('model_currentStep')
        }
        if (debug) console.log(`✅ [DRAFT] Model draft finalized`)
        break
    }
  } catch (error) {
    console.error(`❌ [DRAFT] Error finalizing ${draftType} draft:`, error)
    // Don't throw - idempotent, best effort
  }
}

/**
 * Garbage collect expired drafts
 * @param ttlHours - Time to live in hours (default 24h)
 * @param debug - Enable debug logging
 */
export async function gcDrafts(
  ttlHours: number = 24,
  debug: boolean = typeof window !== 'undefined' && localStorage.getItem('DEBUG_DRAFTS') === 'true'
): Promise<void> {
  const now = Date.now()
  const ttlMs = ttlHours * 60 * 60 * 1000

  if (debug) console.log(`🗑️ [GC] Starting draft garbage collection (TTL: ${ttlHours}h)`)

  try {
    const draftTypes: Array<'editor' | 'video' | 'generation' | 'model'> = ['editor', 'video', 'generation', 'model']
    let cleaned = 0

    for (const draftType of draftTypes) {
      const metadata = await loadDraftMetadata(draftType)

      if (metadata) {
        const age = now - metadata.updatedAt
        const ageHours = age / (60 * 60 * 1000)

        if (age > ttlMs) {
          if (debug) console.log(`🗑️ [GC] Found expired ${draftType} draft (age: ${ageHours.toFixed(1)}h)`)
          await finalizeDraft(draftType, debug)
          cleaned++
        } else {
          if (debug) console.log(`✓ [GC] ${draftType} draft is fresh (age: ${ageHours.toFixed(1)}h)`)
        }
      }
    }

    if (debug) console.log(`✅ [GC] Garbage collection complete. Cleaned ${cleaned} expired drafts`)
  } catch (error) {
    console.error(`❌ [GC] Error during garbage collection:`, error)
  }
}

/**
 * Update draft timestamp (call when user modifies draft)
 */
export async function touchDraft(draftType: 'editor' | 'video' | 'generation' | 'model'): Promise<void> {
  const metadata = await loadDraftMetadata(draftType)
  const now = Date.now()

  if (metadata) {
    // Update existing
    metadata.updatedAt = now
    await saveDraftMetadata(draftType, metadata)
  } else {
    // Create new
    await saveDraftMetadata(draftType, {
      createdAt: now,
      updatedAt: now,
      draftId: `${draftType}_${now}`,
      finalizing: false
    })
  }
}

/**
 * Clear all model creation data from IndexedDB
 * @deprecated Use finalizeDraft('model') instead
 */
export async function clearModelCreationFromIndexedDB(): Promise<void> {
  await finalizeDraft('model')
}
