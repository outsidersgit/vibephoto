/**
 * Utility para download de imagens
 * Funciona tanto em desktop quanto mobile
 */

export interface DownloadOptions {
  filename?: string
  quality?: number
  format?: 'original' | 'jpeg' | 'png' | 'webp'
}

/**
 * Baixa uma imagem a partir de uma URL
 * Cria um elemento <a> dinâmico para trigger do download
 */
export async function downloadImage(
  imageUrl: string,
  options: DownloadOptions = {}
): Promise<boolean> {
  try {
    const {
      filename = generateFilename(imageUrl),
      quality = 0.9,
      format = 'original'
    } = options

    // Converte URL para blob
    const blob = await fetchImageAsBlob(imageUrl, format, quality)

    if (!blob) {
      console.error('❌ Failed to fetch image as blob')
      return false
    }

    // Executa o download
    return triggerDownload(blob, filename)

  } catch (error) {
    console.error('❌ Download failed:', error)
    return false
  }
}

/**
 * Busca imagem como blob
 * Suporta CORS e diferentes formatos
 */
export async function fetchImageAsBlob(
  imageUrl: string,
  format: string = 'original',
  quality: number = 0.9
): Promise<Blob | null> {
  try {
    // Fetch da imagem
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Se formato é original, retorna direto
    if (format === 'original') {
      return await response.blob()
    }

    // Para conversão de formato, usa canvas
    const originalBlob = await response.blob()
    return await convertImageFormat(originalBlob, format, quality)

  } catch (error) {
    console.error('❌ Failed to fetch image:', error)
    return null
  }
}

/**
 * Converte formato da imagem usando canvas
 */
export async function convertImageFormat(
  blob: Blob,
  format: string,
  quality: number = 0.9
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(null)
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        // Desenha imagem no canvas
        ctx.drawImage(img, 0, 0)

        // Converte para o formato desejado
        const mimeType = getMimeType(format)
        canvas.toBlob((convertedBlob) => {
          resolve(convertedBlob)
        }, mimeType, quality)

      } catch (error) {
        console.error('❌ Image conversion failed:', error)
        resolve(null)
      }
    }

    img.onerror = () => {
      console.error('❌ Failed to load image for conversion')
      resolve(null)
    }

    img.src = URL.createObjectURL(blob)
  })
}

/**
 * Executa o download do blob
 * Cria elemento <a> temporário
 */
export function triggerDownload(blob: Blob, filename: string): boolean {
  try {
    // Verifica se browser suporta download
    if (typeof document === 'undefined') {
      console.error('❌ Document not available for download')
      return false
    }

    // Cria URL do blob
    const url = URL.createObjectURL(blob)

    // Cria elemento <a> temporário
    const link = document.createElement('a')
    link.href = url
    link.download = filename

    // Adiciona ao DOM temporariamente
    document.body.appendChild(link)

    // Simula clique para download
    link.click()

    // Remove do DOM
    document.body.removeChild(link)

    // Libera URL do blob
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 100)

    return true

  } catch (error) {
    console.error('❌ Download trigger failed:', error)
    return false
  }
}

/**
 * Gera nome de arquivo baseado na URL ou timestamp
 */
export function generateFilename(imageUrl: string, prefix: string = 'vibePhoto'): string {
  try {
    // Tenta extrair nome da URL
    const urlParts = imageUrl.split('/')
    const lastPart = urlParts[urlParts.length - 1]

    // Remove query parameters
    const fileName = lastPart.split('?')[0]

    // Se tem extensão válida, usa
    if (fileName && /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)) {
      return fileName
    }

    // Senão, gera nome com timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    return `${prefix}_${timestamp}.jpg`

  } catch (error) {
    // Fallback para timestamp
    const timestamp = Date.now()
    return `${prefix}_${timestamp}.jpg`
  }
}

/**
 * Obter MIME type baseado no formato
 */
function getMimeType(format: string): string {
  const mimeTypes: { [key: string]: string } = {
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif'
  }

  return mimeTypes[format.toLowerCase()] || 'image/jpeg'
}

/**
 * Verifica se browser suporta download de arquivos
 */
export function canDownloadFiles(): boolean {
  return typeof document !== 'undefined' &&
         typeof URL !== 'undefined' &&
         'createObjectURL' in URL
}

/**
 * Estima tamanho do arquivo baseado nas dimensões
 */
export function estimateFileSize(width: number, height: number, format: string = 'jpeg'): number {
  const pixels = width * height

  // Estimativas em bytes por pixel baseadas no formato
  const bytesPerPixel: { [key: string]: number } = {
    'jpeg': 0.5,   // JPEG comprimido
    'png': 3,      // PNG sem compressão
    'webp': 0.3    // WebP comprimido
  }

  const multiplier = bytesPerPixel[format.toLowerCase()] || 0.5
  return Math.round(pixels * multiplier)
}

/**
 * Formatar tamanho do arquivo em formato legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Download múltiplas imagens como ZIP (funcionalidade futura)
 */
export async function downloadMultipleImages(
  imageUrls: string[],
  zipFilename: string = 'vibePhotos.zip'
): Promise<boolean> {
  // Placeholder para implementação futura com JSZip
  console.log('🚧 Multiple image download not yet implemented')
  return false
}

/**
 * Verifica se URL da imagem é válida
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const validExtensions = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i
    return validExtensions.test(url) || url.startsWith('data:image/')
  } catch {
    return false
  }
}

/**
 * Cria preview da imagem antes do download
 */
export async function createImagePreview(imageUrl: string): Promise<string | null> {
  try {
    const blob = await fetchImageAsBlob(imageUrl)
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}