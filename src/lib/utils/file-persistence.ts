/**
 * File Persistence Utilities
 * Handles saving/loading File objects and quality analysis to localStorage
 * Survives page refresh (F5)
 */

import { ImageQualityAnalysisResult } from '@/types/image-quality'

interface SerializedFile {
  name: string
  type: string
  size: number
  lastModified: number
  dataUrl: string
}

/**
 * Convert File to serializable object with base64 data
 */
export async function serializeFile(file: File): Promise<SerializedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        dataUrl: reader.result as string
      })
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Convert serialized object back to File
 */
export async function deserializeFile(serialized: SerializedFile): Promise<File> {
  const response = await fetch(serialized.dataUrl)
  const blob = await response.blob()

  return new File([blob], serialized.name, {
    type: serialized.type,
    lastModified: serialized.lastModified
  })
}

/**
 * Save files to localStorage with a key
 */
export async function saveFilesToStorage(key: string, files: File[]): Promise<void> {
  try {
    const serialized = await Promise.all(files.map(serializeFile))
    localStorage.setItem(key, JSON.stringify(serialized))
  } catch (error) {
    console.error(`Error saving files to ${key}:`, error)
  }
}

/**
 * Load files from localStorage
 */
export async function loadFilesFromStorage(key: string): Promise<File[]> {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []

    const serialized: SerializedFile[] = JSON.parse(stored)
    const files = await Promise.all(serialized.map(deserializeFile))

    return files
  } catch (error) {
    console.error(`Error loading files from ${key}:`, error)
    return []
  }
}

/**
 * Save quality analysis results
 */
export function saveQualityResults(
  key: string,
  results: Map<number, ImageQualityAnalysisResult>
): void {
  try {
    const resultsArray = Array.from(results.entries())
    localStorage.setItem(key, JSON.stringify(resultsArray))
  } catch (error) {
    console.error(`Error saving quality results to ${key}:`, error)
  }
}

/**
 * Load quality analysis results
 */
export function loadQualityResults(
  key: string
): Map<number, ImageQualityAnalysisResult> {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return new Map()

    const resultsArray = JSON.parse(stored)
    return new Map(resultsArray)
  } catch (error) {
    console.error(`Error loading quality results from ${key}:`, error)
    return new Map()
  }
}

/**
 * Clear persisted data for a key
 */
export function clearPersistedData(key: string): void {
  localStorage.removeItem(key)
}

/**
 * Clear all model creation data
 */
export function clearModelCreationData(): void {
  clearPersistedData('model_facePhotos')
  clearPersistedData('model_halfBodyPhotos')
  clearPersistedData('model_fullBodyPhotos')
  clearPersistedData('facePhotosQuality')
  clearPersistedData('halfBodyPhotosQuality')
  clearPersistedData('fullBodyPhotosQuality')
}
