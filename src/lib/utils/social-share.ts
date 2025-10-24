/**
 * Sistema centralizado de compartilhamento social
 * Funciona tanto em mobile quanto desktop com estratégias diferentes
 */

import { getDeviceInfo, isMobileDevice } from './device-detector'
import { shareImageNative, createAppShareUrls, canUseNativeShare } from './native-share'
import { downloadImage, generateFilename } from './image-downloader'

export type SharePlatform = 'instagram' | 'tiktok' | 'whatsapp' | 'telegram' | 'gmail' | 'copy'

export interface ShareOptions {
  imageUrl: string
  generation: {
    id: string
    prompt: string
    [key: string]: any
  }
  platform: SharePlatform
  customText?: string
  customTitle?: string
}

export interface ShareResult {
  success: boolean
  method: 'native' | 'web' | 'download' | 'copy'
  message: string
  action?: string
}

/**
 * Função principal de compartilhamento
 * Detecta dispositivo e escolhe a melhor estratégia
 */
export async function sharePhoto(options: ShareOptions): Promise<ShareResult> {
  const { imageUrl, generation, platform, customText, customTitle } = options

  try {
    console.log(`🚀 [SHARE] Starting share for platform: ${platform}`)
    console.log(`📱 [SHARE] Device: ${isMobileDevice() ? 'Mobile' : 'Desktop'}`)

    // Detecta dispositivo
    const deviceInfo = getDeviceInfo()
    const isMobile = deviceInfo.isMobile || isMobileDevice()

    // Gera conteúdo do compartilhamento
    const content = generateShareContent(generation, platform, customText, customTitle)

    if (isMobile) {
      return await shareMobile(imageUrl, content, platform, deviceInfo)
    } else {
      return await shareDesktop(imageUrl, content, platform, deviceInfo)
    }

  } catch (error) {
    console.error('❌ [SHARE] Failed:', error)
    return {
      success: false,
      method: 'copy',
      message: 'Erro no compartilhamento. Tente novamente.',
      action: 'Link copiado como fallback'
    }
  }
}

/**
 * Estratégia de compartilhamento para mobile
 * Prioriza Web Share API e app schemes
 */
async function shareMobile(
  imageUrl: string,
  content: ShareContent,
  platform: SharePlatform,
  deviceInfo: any
): Promise<ShareResult> {
  console.log('📱 [MOBILE] Using mobile sharing strategy')

  // Estratégia 1: Web Share API nativa (melhor experiência)
  if (canUseNativeShare() && platform !== 'copy') {
    console.log('🔄 [MOBILE] Trying Web Share API...')

    const nativeResult = await shareImageNative({
      imageUrl,
      title: content.title,
      text: content.text
    })

    if (nativeResult) {
      return {
        success: true,
        method: 'native',
        message: 'Compartilhado com sucesso!',
        action: 'Imagem compartilhada via app nativo'
      }
    }
  }

  // Estratégia 2: App schemes específicos
  return await shareViaAppSchemes(imageUrl, content, platform, deviceInfo)
}

/**
 * Estratégia de compartilhamento para desktop
 * Combina download + abertura da plataforma web
 */
async function shareDesktop(
  imageUrl: string,
  content: ShareContent,
  platform: SharePlatform,
  deviceInfo: any
): Promise<ShareResult> {
  console.log('💻 [DESKTOP] Using desktop sharing strategy')

  // Caso especial: apenas copiar link
  if (platform === 'copy') {
    return await copyToClipboard(imageUrl, content)
  }

  // Gmail: abre diretamente sem download
  if (platform === 'gmail') {
    return await shareViaGmail(imageUrl, content)
  }

  // Outras plataformas: download + web
  return await shareWithDownload(imageUrl, content, platform)
}

/**
 * Compartilhamento via app schemes (mobile)
 */
async function shareViaAppSchemes(
  imageUrl: string,
  content: ShareContent,
  platform: SharePlatform,
  deviceInfo: any
): Promise<ShareResult> {
  const appUrls = createAppShareUrls(imageUrl, content.text)

  switch (platform) {
    case 'whatsapp':
      return await tryAppScheme(
        appUrls.whatsapp,
        appUrls.whatsappWeb,
        'WhatsApp',
        imageUrl,
        content
      )

    case 'telegram':
      return await tryAppScheme(
        appUrls.telegram,
        appUrls.telegramWeb,
        'Telegram',
        imageUrl,
        content
      )

    case 'instagram':
      // Instagram não aceita URLs diretas, copia e abre app
      await copyToClipboard(imageUrl, content)
      window.open(appUrls.instagram, '_blank')
      return {
        success: true,
        method: 'copy',
        message: 'Instagram aberto!',
        action: 'Texto copiado. Cole na sua história/post'
      }

    case 'tiktok':
      // TikTok requer upload manual
      await copyToClipboard(imageUrl, content)
      window.open(appUrls.tiktok, '_blank')
      return {
        success: true,
        method: 'copy',
        message: 'TikTok aberto!',
        action: 'Texto copiado. Faça upload manual da imagem'
      }

    case 'copy':
      return await copyToClipboard(imageUrl, content)

    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

/**
 * Tenta abrir app nativo, fallback para web
 */
async function tryAppScheme(
  appUrl: string,
  webUrl: string,
  platformName: string,
  imageUrl: string,
  content: ShareContent
): Promise<ShareResult> {
  try {
    // Tenta abrir app nativo
    const opened = window.open(appUrl, '_blank')

    // Se não conseguiu abrir, usa web
    if (!opened) {
      window.open(webUrl, '_blank')
    }

    return {
      success: true,
      method: 'web',
      message: `${platformName} aberto!`,
      action: 'Imagem e texto compartilhados'
    }

  } catch (error) {
    // Fallback: copia e abre web
    await copyToClipboard(imageUrl, content)
    window.open(webUrl, '_blank')

    return {
      success: true,
      method: 'copy',
      message: `${platformName} aberto!`,
      action: 'Texto copiado. Cole manualmente'
    }
  }
}

/**
 * Compartilhamento desktop com download
 */
async function shareWithDownload(
  imageUrl: string,
  content: ShareContent,
  platform: SharePlatform
): Promise<ShareResult> {
  try {
    // Inicia download da imagem
    const filename = generateFilename(imageUrl, `vibePhoto_${platform}`)
    const downloadSuccess = await downloadImage(imageUrl, { filename })

    if (!downloadSuccess) {
      console.warn('⚠️ [DESKTOP] Download failed, continuing with web share only')
    }

    // Abre plataforma web
    const webUrls = getWebUrls(content)
    let webUrl: string

    switch (platform) {
      case 'instagram':
        webUrl = webUrls.instagram
        break
      case 'tiktok':
        webUrl = webUrls.tiktok
        break
      case 'whatsapp':
        webUrl = webUrls.whatsapp
        break
      case 'telegram':
        webUrl = webUrls.telegram
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    window.open(webUrl, '_blank')

    return {
      success: true,
      method: 'download',
      message: downloadSuccess ? 'Download iniciado!' : 'Plataforma aberta!',
      action: downloadSuccess
        ? `${platform} aberto. Faça upload da imagem baixada`
        : `${platform} aberto. Use a URL da imagem`
    }

  } catch (error) {
    console.error(`❌ [DESKTOP] ${platform} sharing failed:`, error)
    return await copyToClipboard(imageUrl, content)
  }
}

/**
 * Compartilhamento via Gmail
 */
async function shareViaGmail(
  imageUrl: string,
  content: ShareContent
): Promise<ShareResult> {
  const subject = encodeURIComponent(content.title)
  const body = encodeURIComponent(`${content.text}\n\nImagem: ${imageUrl}\n\nCriado com VibePhoto ✨`)
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`

  window.open(gmailUrl, '_blank')

  return {
    success: true,
    method: 'web',
    message: 'Gmail aberto!',
    action: 'Email pré-preenchido com imagem'
  }
}

/**
 * Copia conteúdo para clipboard
 */
async function copyToClipboard(
  imageUrl: string,
  content: ShareContent
): Promise<ShareResult> {
  try {
    const textToCopy = `${content.title}\n${content.text}\n${imageUrl}`

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(textToCopy)
    } else {
      // Fallback para browsers antigos
      const textArea = document.createElement('textarea')
      textArea.value = textToCopy
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }

    return {
      success: true,
      method: 'copy',
      message: 'Link copiado!',
      action: 'Conteúdo copiado para área de transferência'
    }

  } catch (error) {
    console.error('❌ [COPY] Failed:', error)
    return {
      success: false,
      method: 'copy',
      message: 'Erro ao copiar',
      action: 'Tente novamente'
    }
  }
}

/**
 * Interface para conteúdo do compartilhamento
 */
interface ShareContent {
  title: string
  text: string
  hashtags: string
}

/**
 * Gera conteúdo personalizado para cada plataforma
 */
function generateShareContent(
  generation: any,
  platform: SharePlatform,
  customText?: string,
  customTitle?: string
): ShareContent {
  const baseTitle = customTitle || 'Imagem Incrível Gerada por IA!'
  const baseText = customText || `Confira esta arte criada por IA: "${generation.prompt}"`

  switch (platform) {
    case 'instagram':
      return {
        title: baseTitle,
        text: `${baseText} 📸✨`,
        hashtags: '#IA #ArtificialIntelligence #AIArt #VibePhoto #Arte #Tecnologia'
      }

    case 'tiktok':
      return {
        title: baseTitle,
        text: `${baseText} 🎨🤖`,
        hashtags: '#IA #AI #Arte #ArtificialIntelligence #Tecnologia #VibePhoto #AIArt'
      }

    case 'whatsapp':
      return {
        title: baseTitle,
        text: `🤖✨ ${baseText}\n\nCriado com VibePhoto`,
        hashtags: ''
      }

    case 'telegram':
      return {
        title: baseTitle,
        text: `🎨 ${baseText}\n\nGerado com IA | VibePhoto`,
        hashtags: ''
      }

    case 'gmail':
      return {
        title: baseTitle,
        text: `Olá!\n\n${baseText}\n\nPrompt utilizado: "${generation.prompt}"`,
        hashtags: ''
      }

    case 'copy':
      return {
        title: baseTitle,
        text: baseText,
        hashtags: ''
      }

    default:
      return {
        title: baseTitle,
        text: baseText,
        hashtags: ''
      }
  }
}

/**
 * URLs web para cada plataforma
 */
function getWebUrls(content: ShareContent) {
  const encodedText = encodeURIComponent(content.text)

  return {
    instagram: 'https://www.instagram.com/create/story/',
    tiktok: 'https://www.tiktok.com/upload',
    whatsapp: `https://wa.me/?text=${encodedText}`,
    telegram: `https://t.me/share/url?text=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
    facebook: 'https://www.facebook.com/share/'
  }
}

/**
 * Função de conveniência para compartilhamento rápido
 */
export async function quickShare(
  imageUrl: string,
  prompt: string,
  platform: SharePlatform
): Promise<ShareResult> {
  return await sharePhoto({
    imageUrl,
    generation: { id: 'quick', prompt },
    platform
  })
}

/**
 * Obtém capacidades de compartilhamento do dispositivo
 */
export function getShareCapabilities() {
  const deviceInfo = getDeviceInfo()

  return {
    isMobile: deviceInfo.isMobile,
    hasWebShareAPI: deviceInfo.hasShareAPI,
    canDownload: typeof document !== 'undefined',
    supportedPlatforms: ['instagram', 'tiktok', 'whatsapp', 'telegram', 'gmail', 'copy'] as SharePlatform[],
    recommendedStrategy: deviceInfo.isMobile ? 'native' : 'download'
  }
}