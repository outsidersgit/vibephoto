'use client'

import { getWhatsAppLink, WHATSAPP_CONFIG } from '@/lib/config/whatsapp'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// WhatsApp Official Icon
const WhatsAppIconOfficial = ({ size = 24 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="12" fill="#25D366"/>
    <path 
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" 
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
