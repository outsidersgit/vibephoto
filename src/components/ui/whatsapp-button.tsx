'use client'

import { getWhatsAppLink, WHATSAPP_CONFIG } from '@/lib/config/whatsapp'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WhatsAppIcon } from '@/components/ui/social-icons'

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
      <WhatsAppIcon size={iconOnly && size === 'icon' ? 24 : 20} />
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
        className="bg-[#25D366] hover:bg-[#20BA5A] text-white h-14 w-14 rounded-full"
      />
    </div>
  )
}
