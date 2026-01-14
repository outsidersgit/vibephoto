/**
 * WhatsApp Contact Configuration
 * Centralized config for WhatsApp contact functionality
 */

export const WHATSAPP_CONFIG = {
  // WhatsApp number (international format without + or spaces)
  // Example: 5511999999999 for Brazil +55 11 99999-9999
  phoneNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511999999999',

  // Default pre-filled messages for different contexts
  messages: {
    default: 'Olá! Estou com uma dúvida sobre o VibePhoto.',
    pricing: 'Olá! Gostaria de saber mais sobre os planos e preços do VibePhoto.',
    support: 'Olá! Preciso de ajuda com o VibePhoto.',
    demo: 'Olá! Gostaria de ver uma demonstração do VibePhoto.',
  },

  // UI Configuration
  ui: {
    floatingButton: {
      enabled: true,
      position: 'bottom-right', // 'bottom-right' | 'bottom-left'
      offsetBottom: '24px',
      offsetRight: '24px',
      offsetLeft: '24px',
    },
    tooltip: 'Fale com a gente no WhatsApp',
  },
} as const

/**
 * Generate WhatsApp link
 * @param message - Custom message (optional, uses default if not provided)
 * @returns WhatsApp web link
 */
export function getWhatsAppLink(message?: string): string {
  const encodedMessage = encodeURIComponent(
    message || WHATSAPP_CONFIG.messages.default
  )
  return `https://wa.me/${WHATSAPP_CONFIG.phoneNumber}?text=${encodedMessage}`
}

/**
 * Open WhatsApp in new tab
 * @param message - Custom message (optional)
 */
export function openWhatsApp(message?: string): void {
  const link = getWhatsAppLink(message)
  window.open(link, '_blank', 'noopener,noreferrer')
}
