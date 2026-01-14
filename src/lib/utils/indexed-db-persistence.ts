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
 * Clear all model creation data from IndexedDB
 */
export async function clearModelCreationFromIndexedDB(): Promise<void> {
  await Promise.all([
    deleteFilesFromIndexedDB('model_facePhotos'),
    deleteFilesFromIndexedDB('model_halfBodyPhotos'),
    deleteFilesFromIndexedDB('model_fullBodyPhotos'),
    deleteFilesFromIndexedDB('facePhotosQuality'),
    deleteFilesFromIndexedDB('halfBodyPhotosQuality'),
    deleteFilesFromIndexedDB('fullBodyPhotosQuality')
  ])
}
