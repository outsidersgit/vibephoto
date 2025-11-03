'use client'

import { InputHTMLAttributes, useRef, useEffect } from 'react'

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number
  onChange: (value: number) => void
  allowNegative?: boolean
  allowDecimal?: boolean
}

/**
 * Campo numérico com auto-clear (sobrescreve totalmente ao focar)
 * Melhora usabilidade para edição de valores numéricos
 */
export function NumericInput({
  value,
  onChange,
  allowNegative = false,
  allowDecimal = false,
  ...props
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isFocusedRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handleFocus = () => {
      isFocusedRef.current = true
      // Selecionar todo o texto para sobrescrever facilmente
      input.select()
    }

    const handleBlur = () => {
      isFocusedRef.current = false
    }

    input.addEventListener('focus', handleFocus)
    input.addEventListener('blur', handleBlur)

    return () => {
      input.removeEventListener('focus', handleFocus)
      input.removeEventListener('blur', handleBlur)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value

    // Permitir vazio durante digitação
    if (rawValue === '') {
      onChange(0)
      return
    }

    // Remover caracteres não numéricos (exceto ponto decimal e sinal negativo se permitido)
    let cleaned = rawValue.replace(/[^\d.-]/g, '')

    // Remover sinal negativo se não permitido
    if (!allowNegative) {
      cleaned = cleaned.replace(/-/g, '')
    }

    // Garantir apenas um ponto decimal
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('')
    }

    // Remover ponto decimal se não permitido
    if (!allowDecimal) {
      cleaned = cleaned.replace(/\./g, '')
    }

    // Converter para número
    const numValue = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10)

    if (!isNaN(numValue)) {
      onChange(numValue)
    }
  }

  const displayValue = value === 0 ? '' : String(value)

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => {
        e.target.select()
        props.onFocus?.(e)
      }}
      className={`${props.className || ''} focus:ring-2 focus:ring-purple-500`}
    />
  )
}

