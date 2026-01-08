'use client'

import { forwardRef, TextareaHTMLAttributes, useEffect, useRef, useState } from 'react'
import { detectBrowser, logClientError } from '@/lib/client-logger'

/**
 * SafeTextarea - Textarea com validação defensiva cross-browser
 *
 * Resolve problemas de validação do Safari que pode rejeitar certos caracteres
 * ou padrões com o erro "did not match the expected pattern"
 */

interface SafeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSanitizedChange?: (value: string, wasSanitized: boolean) => void
}

export const SafeTextarea = forwardRef<HTMLTextAreaElement, SafeTextareaProps>(
  ({ onChange, onSanitizedChange, value, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value || '')
    const browser = useRef(detectBrowser())
    const lastSanitizedRef = useRef('')

    useEffect(() => {
      setLocalValue(value || '')
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      let sanitizedValue = newValue
      let wasSanitized = false

      try {
        // Sanitização específica para Safari/iOS
        if (browser.current.isSafari || browser.current.isIOS) {
          // Remover caracteres de controle que Safari pode rejeitar
          const cleaned = newValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

          if (cleaned !== newValue) {
            sanitizedValue = cleaned
            wasSanitized = true

            // Log apenas se for diferente do último log (evitar spam)
            if (lastSanitizedRef.current !== newValue) {
              console.warn('[SAFE_TEXTAREA] Removed control characters for Safari compatibility')
              lastSanitizedRef.current = newValue

              logClientError('Safari control character sanitization', {
                context: 'safe-textarea',
                browser: browser.current,
                originalLength: newValue.length,
                sanitizedLength: cleaned.length,
                removedChars: newValue.length - cleaned.length
              })
            }
          }
        }

        // Atualizar valor local
        setLocalValue(sanitizedValue)

        // Chamar callback customizado se fornecido
        if (onSanitizedChange) {
          onSanitizedChange(sanitizedValue, wasSanitized)
        }

        // Chamar onChange original com valor sanitizado
        if (onChange) {
          // Criar novo evento com valor sanitizado
          const sanitizedEvent = {
            ...e,
            target: {
              ...e.target,
              value: sanitizedValue
            }
          } as React.ChangeEvent<HTMLTextAreaElement>

          onChange(sanitizedEvent)
        }

      } catch (error) {
        console.error('[SAFE_TEXTAREA] Error during sanitization:', error)

        logClientError(error as Error, {
          context: 'safe-textarea-error',
          browser: browser.current,
          valueLength: newValue?.length
        })

        // Em caso de erro, usar valor original
        setLocalValue(newValue)
        if (onChange) onChange(e)
      }
    }

    return (
      <textarea
        {...props}
        ref={ref}
        value={localValue}
        onChange={handleChange}
        // Remover pattern validation no Safari para evitar conflitos
        pattern={browser.current.isSafari ? undefined : props.pattern}
      />
    )
  }
)

SafeTextarea.displayName = 'SafeTextarea'
