/**
 * Hook para gerenciar créditos do usuário com React Query
 * Performance: Cache otimizado para modal instantâneo (Sprint 1)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'

interface CreditBalance {
  subscriptionCredits: number
  purchasedCredits: number
  totalCredits: number
  creditsUsed: number
  availableCredits: number
  creditLimit: number
  nextReset: string | null
}

interface CreditPackage {
  id: string
  name: string
  description?: string
  creditAmount: number
  price: number
  bonusCredits: number
  validityMonths: number
  isActive: boolean
  sortOrder: number
}

/**
 * Hook para buscar saldo de créditos com cache otimizado
 */
export function useCreditBalance() {
  return useQuery<CreditBalance>({
    queryKey: ['credits', 'balance'],
    queryFn: async () => {
      const response = await fetch('/api/credits/balance')
      if (!response.ok) {
        throw new Error('Failed to fetch credit balance')
      }
      const data = await response.json()
      return data.balance
    },
    // Cache agressivo: dados mudam pouco, modal deve ser instantâneo
    staleTime: 60 * 1000, // 1 minuto - considera dados frescos
    gcTime: 5 * 60 * 1000, // 5 minutos - mantém em cache
    refetchOnWindowFocus: false, // Não revalidar ao focar janela
    refetchOnMount: false, // Usa cache se disponível
  })
}

/**
 * Hook para buscar pacotes de créditos disponíveis
 */
export function useCreditPackages() {
  return useQuery<CreditPackage[]>({
    queryKey: ['credits', 'packages'],
    queryFn: async () => {
      const response = await fetch('/api/credit-packages')
      if (!response.ok) {
        throw new Error('Failed to fetch credit packages')
      }
      const data = await response.json()
      return data.packages || []
    },
    // Pacotes mudam raramente
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook para invalidar cache de créditos após compra/uso
 */
export function useInvalidateCredits() {
  const queryClient = useQueryClient()
  
  return {
    invalidateBalance: () => {
      queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] })
    },
    invalidatePackages: () => {
      queryClient.invalidateQueries({ queryKey: ['credits', 'packages'] })
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] })
    },
  }
}

