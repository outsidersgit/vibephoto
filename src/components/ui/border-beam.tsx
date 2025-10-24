'use client'

import { cn } from '@/lib/utils'

interface BorderBeamProps {
  className?: string
  size?: number
  duration?: number
  borderWidth?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
}

export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  borderWidth = 1.5,
  colorFrom = '#8b5cf6',
  colorTo = '#ec4899',
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        className
      )}
      style={{
        '--size': size,
        '--duration': duration,
        '--border-width': borderWidth,
        '--color-from': colorFrom,
        '--color-to': colorTo,
        '--delay': `-${delay}s`,
      } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]"
        style={{
          background: `linear-gradient(90deg, transparent, transparent), 
                      conic-gradient(from 90deg at 50% 50%, transparent 0%, var(--color-from) 50%, var(--color-to) 100%, transparent 100%)`,
          backgroundClip: 'padding-box, border-box',
          backgroundOrigin: 'border-box',
          animation: `border-beam calc(var(--duration) * 1s) infinite linear var(--delay)`,
        }}
      />
      <style jsx>{`
        @keyframes border-beam {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  )
}