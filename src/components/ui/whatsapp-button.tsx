'use client'

import { getWhatsAppLink, WHATSAPP_CONFIG } from '@/lib/config/whatsapp'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// WhatsApp Official Icon - Simple and clean
const WhatsAppIconOfficial = ({ size = 24 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 48 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="24" cy="24" r="24" fill="#25D366"/>
    <path 
      d="M35.9 12C33.3 9.4 29.9 8 26.3 8C18.4 8 12 14.4 12 22.3C12 24.9 12.7 27.4 14 29.6L11.9 36L18.5 34C20.6 35.2 22.9 35.8 25.3 35.8H25.3C33.1 35.8 39.5 29.4 39.5 21.5C39.5 17.9 38.1 14.6 35.9 12ZM26.3 33.3C24.2 33.3 22.1 32.7 20.3 31.7L19.9 31.4L15.5 32.6L16.7 28.3L16.4 27.9C15.3 26 14.7 23.8 14.7 21.5C14.7 15.8 19.3 11.2 25 11.2C27.7 11.2 30.3 12.2 32.3 14.2C34.3 16.2 35.3 18.8 35.3 21.5C35.3 27.2 30.7 31.8 25 31.8L26.3 33.3ZM30.5 24.5C30.2 24.3 28.6 23.5 28.3 23.4C28 23.3 27.8 23.2 27.6 23.5C27.4 23.8 26.8 24.5 26.6 24.7C26.4 24.9 26.2 25 25.9 24.8C25.6 24.7 24.6 24.3 23.4 23.2C22.5 22.4 21.9 21.4 21.7 21.1C21.5 20.8 21.7 20.6 21.8 20.5C22 20.3 22.2 20 22.3 19.8C22.4 19.6 22.5 19.5 22.5 19.3C22.6 19.1 22.5 18.9 22.5 18.8C22.4 18.7 21.8 17.1 21.6 16.5C21.3 15.9 21.1 16 20.9 16C20.7 16 20.5 16 20.3 16C20.1 16 19.8 16.1 19.5 16.4C19.2 16.7 18.4 17.5 18.4 19.1C18.4 20.7 19.6 22.2 19.7 22.4C19.8 22.6 21.9 25.9 25.1 27.4C25.9 27.7 26.5 27.9 26.9 28.1C27.7 28.3 28.4 28.3 29 28.2C29.6 28.1 30.9 27.4 31.2 26.7C31.5 26 31.5 25.4 31.4 25.3C31.3 25.2 31.1 25.1 30.8 25L30.5 24.5Z" 
      fill="white"
    />
  </svg>
)

interface WhatsAppButtonProps {
  /**
   * Custom message to pre-fill in WhatsApp
   */
  message?: string

  /**
   * Button variant
   */
  variant?: 'default' | 'outline' | 'ghost' | 'floating'

  /**
   * Button size
   */
  size?: 'sm' | 'default' | 'lg' | 'icon'

  /**
   * Show tooltip
   */
  showTooltip?: boolean

  /**
   * Custom className
   */
  className?: string

  /**
   * Custom label (if not using icon-only)
   */
  label?: string

  /**
   * Icon only mode
   */
  iconOnly?: boolean
}

export function WhatsAppButton({
  message,
  variant = 'default',
  size = 'default',
  showTooltip = true,
  className,
  label = 'WhatsApp',
  iconOnly = false,
}: WhatsAppButtonProps) {
  const link = getWhatsAppLink(message)

  const buttonClasses = cn(
    'gap-2',
    variant === 'floating' && 'shadow-lg hover:shadow-xl transition-shadow',
    className
  )

  const content = (
    <>
      <WhatsAppIconOfficial size={iconOnly && size === 'icon' ? 28 : 22} />
      {!iconOnly && <span>{label}</span>}
    </>
  )

  return (
    <div className="relative group">
      <Button
        asChild
        variant={variant === 'floating' ? 'default' : variant}
        size={iconOnly ? 'icon' : size}
        className={buttonClasses}
      >
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={WHATSAPP_CONFIG.ui.tooltip}
        >
          {content}
        </a>
      </Button>

      {/* Tooltip */}
      {showTooltip && (
        <div className={cn(
          "absolute px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap",
          variant === 'floating'
            ? "bottom-1/2 right-full translate-y-1/2 mr-3" // Left of button for floating
            : "bottom-full left-1/2 -translate-x-1/2 mb-2" // Above button for inline
        )}>
          {WHATSAPP_CONFIG.ui.tooltip}
          {variant === 'floating' ? (
            // Arrow pointing right (to button) for floating
            <div className="absolute top-1/2 left-full -translate-y-1/2 -ml-1 border-4 border-transparent border-l-gray-900" />
          ) : (
            // Arrow pointing down (to button) for inline
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Floating WhatsApp Button (fixed position)
 */
export function WhatsAppFloatingButton({
  message,
  className,
}: {
  message?: string
  className?: string
}) {
  const { position, offsetBottom, offsetRight, offsetLeft } = WHATSAPP_CONFIG.ui.floatingButton

  const positionClasses = cn(
    'fixed z-50',
    position === 'bottom-right' && 'bottom-6 right-6',
    position === 'bottom-left' && 'bottom-6 left-6'
  )

  return (
    <div
      className={cn(positionClasses, className)}
      style={{
        bottom: offsetBottom,
        right: position === 'bottom-right' ? offsetRight : undefined,
        left: position === 'bottom-left' ? offsetLeft : undefined,
      }}
    >
      <WhatsAppButton
        message={message}
        variant="floating"
        size="icon"
        iconOnly
        showTooltip
        className="bg-transparent hover:scale-110 transition-transform text-white h-14 w-14 rounded-full shadow-lg hover:shadow-2xl"
      />
    </div>
  )
}
