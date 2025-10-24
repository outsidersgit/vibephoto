'use client'

import { cn } from '@/lib/utils'
import React from 'react'

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
  className?: string
  children?: React.ReactNode
}

export function ShimmerButton({
  shimmerColor = '#ffffff',
  shimmerSize = '0.05em',
  borderRadius = '100px',
  shimmerDuration = '3s',
  background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={
        {
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': shimmerDuration,
          '--cut': shimmerSize,
          '--bg': background,
        } as React.CSSProperties
      }
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/25',
        'before:absolute before:inset-0 before:overflow-hidden before:[border-radius:var(--radius)] before:[background:linear-gradient(var(--spread),transparent_74%,var(--shimmer-color)_86%,transparent_100%)] before:[mask:linear-gradient(rgb(0,0,0),rgb(0,0,0))_content-box,linear-gradient(rgb(0,0,0),rgb(0,0,0))] before:[mask-composite:xor] before:[mask-size:100%_100%]',
        'after:absolute after:inset-0 after:z-10 after:[border-radius:var(--radius)] after:[background:var(--bg)]',
        'hover:before:animate-shimmer',
        className
      )}
      {...props}
    >
      <span className="z-20 flex items-center justify-center gap-2 font-medium">
        {children}
      </span>
      
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .animate-shimmer::before {
          animation: shimmer var(--speed) infinite;
        }
      `}</style>
    </button>
  )
}