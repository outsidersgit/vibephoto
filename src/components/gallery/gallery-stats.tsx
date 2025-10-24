'use client'

interface GalleryStatsProps {
  stats: {
    totalGenerations: number
    completedGenerations: number
    totalImages: number
    favoriteImages: number
    collections: number
  }
}

export function GalleryStats({ stats }: GalleryStatsProps) {
  return null
}