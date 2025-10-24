'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Calendar, Image, Video, Wand2, Bot, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface Pagination {
  currentPage: number
  totalPages: number
  totalRecords: number
  recordsPerPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface CreditOrdersClientProps {
  userId: string
}

export function CreditOrdersClient({ userId }: CreditOrdersClientProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch transactions from API
  const fetchTransactions = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/account/credit-transactions?page=${page}&limit=20`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.transactions)
        setPagination(data.pagination)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Error fetching credit transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchTransactions()
  }, [])

  // Auto-refresh every 30 seconds for transaction updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTransactions(currentPage)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [currentPage])

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true
    if (filter === 'earned') return transaction.type === 'EARNED'
    if (filter === 'spent') return transaction.type === 'SPENT'
    return true
  })

  // Get icon for transaction source
  const getSourceIcon = (source: CreditTransaction['source']) => {
    const icons = {
      SUBSCRIPTION: Calendar,
      PURCHASE: Calendar,
      BONUS: Calendar,
      GENERATION: Image,
      TRAINING: Bot,
      REFUND: Calendar,
      EXPIRATION: Calendar,
      UPSCALE: ArrowUp,
      EDIT: Wand2,
      VIDEO: Video
    }
    return icons[source] || Calendar
  }

  // Get label for transaction source
  const getSourceLabel = (source: CreditTransaction['source']) => {
    const labels = {
      SUBSCRIPTION: 'Renovação de Assinatura',
      PURCHASE: 'Compra de Créditos',
      BONUS: 'Bônus',
      GENERATION: 'Geração de Imagem',
      TRAINING: 'Criação de Modelo IA',
      REFUND: 'Reembolso',
      EXPIRATION: 'Expiração',
      UPSCALE: 'Upscale de Imagem',
      EDIT: 'Edição de Imagem',
      VIDEO: 'Geração de Vídeo'
    }
    return labels[source] || source
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Todas ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="earned" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Entradas ({transactions.filter(t => t.type === 'EARNED').length})
          </TabsTrigger>
          <TabsTrigger value="spent" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Saídas ({transactions.filter(t => t.type === 'SPENT').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
            {filteredTransactions.length === 0 ? (
              <CardContent className="py-12 text-center">
                <p className="text-slate-300">Nenhuma movimentação encontrada.</p>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <div className="divide-y divide-slate-600/30">
                  {filteredTransactions.map((transaction) => {
                    const Icon = getSourceIcon(transaction.source)
                    const isPositive = transaction.amount > 0

                    return (
                      <div key={transaction.id} className="p-5 hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          {/* Left side - Icon & Details */}
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                              <Icon className={`w-5 h-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-white text-sm">
                                {getSourceLabel(transaction.source)}
                              </h3>
                              {transaction.description && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {transaction.description}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                {new Date(transaction.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          {/* Right side - Amount & Balance */}
                          <div className="text-right">
                            <div className={`text-base font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                              {isPositive ? '+' : ''}{transaction.amount.toLocaleString()}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Saldo: {transaction.balanceAfter.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-4">
          <p className="text-sm text-slate-400">
            Mostrando {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} a {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} de {pagination.totalRecords} registros
          </p>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => fetchTransactions(currentPage - 1)}
              disabled={!pagination.hasPrevPage || loading}
              variant="outline"
              size="sm"
              className="border-slate-600/30 text-slate-300 hover:bg-slate-700 bg-transparent disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>

            <span className="text-sm text-slate-300 px-3">
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>

            <Button
              onClick={() => fetchTransactions(currentPage + 1)}
              disabled={!pagination.hasNextPage || loading}
              variant="outline"
              size="sm"
              className="border-slate-600/30 text-slate-300 hover:bg-slate-700 bg-transparent disabled:opacity-50"
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
