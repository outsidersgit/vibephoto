/**
 * Utility para Web Share API nativa
 * Funciona em dispositivos mobile modernos
 */

import { fetchImageAsBlob } from './image-downloader'

export interface ShareData {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export interface ShareOptions {
  imageUrl: string
  title?: string
  text?: string
  fallbackUrl?: string
}

/**
 * Verifica se Web Share API está disponível
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator
}

/**
 * Verifica se Web Share API suporta arquivos
 */
export function canShareFiles(): boolean {
  return canUseNativeShare() && navigator.canShare && navigator.canShare({ files: [] })
}

/**
 * Compartilha imagem usando Web Share API nativa
 * Funciona principalmente em mobile (iOS Safari, Android Chrome)
 */
export async function shareImageNative(options: ShareOptions): Promise<boolean> {
  const { imageUrl, title = 'Imagem VibePhoto', text = '', fallbackUrl } = options

  try {
    // Verifica suporte
    if (!canUseNativeShare()) {
      console.log('🚫 Web Share API not supported, falling back to clipboard')
      return await fallbackToClipboard(options)
    }

    // Tenta compartilhar com arquivo de imagem
    if (canShareFiles()) {
      const shareResult = await shareWithImageFile(imageUrl, title, text)
      if (shareResult) return true
    }

    // Fallback para compartilhar apenas texto e URL
    return await shareTextOnly({
      title,
      text: `${text} ${imageUrl}`,
      url: fallbackUrl || imageUrl
    })

  } catch (error) {
    console.error('❌ Native share failed:', error)
    return await fallbackToClipboard(options)
  }
}

/**
 * Compartilha imagem como arquivo usando Web Share API
 */
async function shareWithImageFile(
  imageUrl: string,
  title: string,
  text: string
): Promise<boolean> {
  try {
    console.log('🔄 Attempting to share with image file...')

    // Fetch da imagem como blob
    const blob = await fetchImageAsBlob(imageUrl)
    if (!blob) {
      console.error('❌ Failed to fetch image blob')
      return false
    }

    // Converte blob para File
    const filename = extractFilename(imageUrl)
    const file = new File([blob], filename, { type: blob.type })

    // Verifica se pode compartilhar este arquivo
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      console.log('🚫 Cannot share this file type')
      return false
    }

    // Executa compartilhamento
    await navigator.share({
      title,
      text,
      files: [file]
    })

    console.log('✅ Image shared successfully with file')
    return true

  } catch (error) {
    console.error('❌ File sharing failed:', error)
    return false
  }
}

/**
 * Compartilha apenas texto e URL (fallback)
 */
async function shareTextOnly(data: ShareData): Promise<boolean> {
  try {
    console.log('🔄 Sharing text only...')

    await navigator.share({
      title: data.title,
      text: data.text,
      url: data.url
    })

    console.log('✅ Text shared successfully')
    return true

  } catch (error) {
    // Usuário cancelou o compartilhamento
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('ℹ️ User cancelled sharing')
      return false
    }

    console.error('❌ Text sharing failed:', error)
    return false
  }
}

/**
 * Fallback: copia para clipboard quando Share API não funciona
 */
async function fallbackToClipboard(options: ShareOptions): Promise<boolean> {
  const { imageUrl, text = '', title = '' } = options

  try {
    const shareText = `${title}\n${text}\n${imageUrl}`.trim()

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText)
      console.log('✅ Copied to clipboard as fallback')
      return true
    }

    // Fallback mais antigo
    return fallbackCopyToClipboard(shareText)

  } catch (error) {
    console.error('❌ Clipboard fallback failed:', error)
    return false
  }
}

/**
 * Fallback para browsers muito antigos
 */
function fallbackCopyToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (successful) {
      console.log('✅ Copied using execCommand fallback')
      return true
    }

    return false

  } catch (error) {
    console.error('❌ execCommand fallback failed:', error)
    return false
  }
}

/**
 * Extrai nome do arquivo da URL
 */
function extractFilename(url: string): string {
  try {
    const parts = url.split('/')
    const filename = parts[parts.length - 1].split('?')[0]

    if (filename && /\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      return filename
    }

    return `vibePhoto_${Date.now()}.jpg`

  } catch {
    return `vibePhoto_${Date.now()}.jpg`
  }
}

/**
 * Compartilha múltiplas imagens (se suportado)
 */
export async function shareMultipleImages(
  imageUrls: string[],
  title: string = 'Imagens VibePhoto',
  text: string = ''
): Promise<boolean> {
  try {
    if (!canShareFiles()) {
      console.log('🚫 File sharing not supported for multiple images')
      return false
    }

    console.log(`🔄 Sharing ${imageUrls.length} images...`)

    // Fetch todas as imagens
    const files: File[] = []
    for (const [index, url] of imageUrls.entries()) {
      const blob = await fetchImageAsBlob(url)
      if (blob) {
        const filename = `vibePhoto_${index + 1}_${Date.now()}.jpg`
        files.push(new File([blob], filename, { type: blob.type }))
      }
    }

    if (files.length === 0) {
      console.error('❌ No images could be fetched')
      return false
    }

    // Verifica se pode compartilhar todos os arquivos
    if (navigator.canShare && !navigator.canShare({ files })) {
      console.log('🚫 Cannot share these files')
      return false
    }

    // Compartilha
    await navigator.share({
      title,
      text,
      files
    })

    console.log(`✅ ${files.length} images shared successfully`)
    return true

  } catch (error) {
    console.error('❌ Multiple image sharing failed:', error)
    return false
  }
}

/**
 * Detecta as capacidades de compartilhamento do dispositivo
 */
export function getShareCapabilities() {
  return {
    hasWebShareAPI: canUseNativeShare(),
    canShareFiles: canShareFiles(),
    hasClipboardAPI: typeof navigator !== 'undefined' && 'clipboard' in navigator,
    supportedMimeTypes: getSupportedMimeTypes()
  }
}

/**
 * Obtém tipos MIME suportados para compartilhamento
 */
function getSupportedMimeTypes(): string[] {
  const commonTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]

  if (!canShareFiles()) return []

  return commonTypes.filter(type => {
    try {
      const testFile = new File([''], 'test', { type })
      return navigator.canShare && navigator.canShare({ files: [testFile] })
    } catch {
      return false
    }
  })
}

/**
 * Cria intent URLs para compartilhamento específico de apps
 */
export function createAppShareUrls(imageUrl: string, text: string) {
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(imageUrl)

  return {
    whatsapp: `whatsapp://send?text=${encodedText} ${encodedUrl}`,
    telegram: `tg://share?url=${encodedUrl}&text=${encodedText}`,
    twitter: `twitter://post?message=${encodedText} ${encodedUrl}`,
    facebook: `fb://share?u=${encodedUrl}`,
    instagram: `instagram://camera`, // Instagram não aceita URLs diretas
    tiktok: `tiktok://upload`, // TikTok requer upload manual

    // Fallbacks web
    whatsappWeb: `https://wa.me/?text=${encodedText} ${encodedUrl}`,
    telegramWeb: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    twitterWeb: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebookWeb: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    instagramWeb: `https://www.instagram.com/`,
    tiktokWeb: `https://www.tiktok.com/upload`
  }
}