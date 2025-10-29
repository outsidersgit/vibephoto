/**
 * Hooks para dados de account (orders, history) com React Query
 * Performance: Cache otimizado para páginas lentas (Sprint 2)
 */

import { useQuery } from '@tanstack/react-query'

interface CreditTransaction {
  id: string
  type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'REFUNDED'
  source: 'SUBSCRIPTION' | 'PURCHASE' | 'BONUS' | 'GENERATION' | 'TRAINING' | 'REFUND' | 'EXPIRATION' | 'UPSCALE' | 'EDIT' | 'VIDEO'
  amount: number
  description: string | null
  referenceId: string | null
  balanceAfter: number
  createdAt: string
  metadata: any
}

interface Payment {
  id: string
  type: 'SUBSCRIPTION' | 'CREDIT_PURCHASE' | 'PHOTO_PACKAGE'
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED' | 'FAILED' | 'EXPIRED'
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED'
  value: number
  description: string | null
  dueDate: string
  confirmedDate: string | null
  createdAt: string
  planType: 'STARTER' | 'PREMIUM' | 'GOLD' | null
  billingCycle: string | null
  creditAmount: number | null
  asaasPaymentId: string | null
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalRecords: number
  recordsPerPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Hook para buscar transações de créditos com paginação
 */
export function useCreditTransactions(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['account', 'credit-transactions', page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/account/credit-transactions?page=${page}&limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch credit transactions')
      }
      const data = await response.json()
      return {
        transactions: data.transactions as CreditTransaction[],
        pagination: data.pagination as Pagination
      }
    },
    // Cache moderado: dados mudam com frequência mas não precisam ser real-time
    staleTime: 60 * 1000, // 1 minuto
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

/**
 * Hook para buscar histórico de pagamentos com paginação
 */
export function usePaymentHistory(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['account', 'payment-history', page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/account/payments?page=${page}&limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch payment history')
      }
      const data = await response.json()
      return {
        payments: data.payments as Payment[],
        pagination: data.pagination as Pagination
      }
    },
    // Cache mais agressivo: histórico de pagamentos muda raramente
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

