/**
 * Image Compression Utilities
 * Compress large images before upload/analysis to reduce payload size
 */

/**
 * Compress image file to meet size requirements
 * @param file - Original image file
 * @param maxSize - Maximum file size in bytes (default: 5MB)
 * @param maxDimension - Maximum width/height in pixels (default: 4096)
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  maxSize: number = 5 * 1024 * 1024, // 5MB default
  maxDimension: number = 4096
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string

      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Reduce dimensions if necessary (maintain aspect ratio)
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Try different qualities until below limit
        let quality = 0.9
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }

              // If still too large and quality can be reduced
              if (blob.size > maxSize && quality > 0.1) {
                quality -= 0.1
                tryCompress()
                return
              }

              // If within limit or already tried enough
              if (blob.size <= maxSize || quality <= 0.1) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              } else {
                reject(new Error('Could not compress image enough'))
              }
            },
            'image/jpeg',
            quality
          )
        }

        tryCompress()
      }

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file for compression'))
    }
  })
}

/**
 * Check if image needs compression
 * @param file - Image file
 * @param maxSize - Maximum file size in bytes
 * @returns true if compression is needed
 */
export function needsCompression(file: File, maxSize: number = 5 * 1024 * 1024): boolean {
  return file.size > maxSize
}

/**
 * Compress image if needed, otherwise return original
 * @param file - Image file
 * @param maxSize - Maximum file size in bytes
 * @param maxDimension - Maximum width/height in pixels
 * @returns Compressed or original file
 */
export async function compressImageIfNeeded(
  file: File,
  maxSize: number = 5 * 1024 * 1024,
  maxDimension: number = 4096
): Promise<File> {
  if (needsCompression(file, maxSize)) {
    console.log(`🔄 Compressing image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
    const compressed = await compressImage(file, maxSize, maxDimension)
    console.log(`✅ Compressed to: ${(compressed.size / 1024 / 1024).toFixed(2)}MB`)
    return compressed
  }
  return file
}
