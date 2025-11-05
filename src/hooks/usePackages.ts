/**
 * Hook para gerenciar pacotes de fotos com React Query
 * Performance: Cache otimizado para mobile (Sprint 3)
 */

import { useQuery } from '@tanstack/react-query'
import { EnhancedPhotoPackage } from '@/types'

/**
 * Hook para buscar todos os pacotes de fotos
 */
export function usePackages() {
  return useQuery<EnhancedPhotoPackage[]>({
    queryKey: ['packages'],
    queryFn: async () => {
      // Usar cache: 'no-store' apenas no primeiro fetch para garantir dados frescos
      // Mas permitir cache do navegador para requisições subsequentes
      const response = await fetch('/api/packages', {
        cache: 'no-store', // Sempre buscar dados frescos (primeira carga)
        next: { revalidate: 600 } // Revalidar a cada 10 minutos
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch packages')
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Error loading packages')
      }
      
      return data.packages || []
    },
    // Cache agressivo: pacotes mudam raramente
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // Sempre buscar dados frescos na montagem (override do staleTime)
    retry: 2, // Tentar 2 vezes em caso de erro
    retryDelay: 1000, // Esperar 1s entre tentativas
  })
}

