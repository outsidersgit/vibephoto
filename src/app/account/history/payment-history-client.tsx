'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Calendar, CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

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

interface PaymentHistoryClientProps {
  userId: string
}

export function PaymentHistoryClient({ userId }: PaymentHistoryClientProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'subscription' | 'purchase'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch payments from API
  const fetchPayments = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/account/payments?page=${page}&limit=20`)
      const data = await response.json()

      if (data.success) {
        setPayments(data.payments)
        setPagination(data.pagination)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchPayments()
  }, [])

  // Auto-refresh every 30 seconds for payment status updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPayments(currentPage)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [currentPage])

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true
    if (filter === 'subscription') return payment.type === 'SUBSCRIPTION'
    if (filter === 'purchase') return payment.type === 'CREDIT_PURCHASE' || payment.type === 'PHOTO_PACKAGE'
    return true
  })

  // Status badge helper
  const getStatusBadge = (status: Payment['status']) => {
    const statusConfig = {
      PENDING: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
      CONFIRMED: { label: 'Confirmado', variant: 'default' as const, icon: CheckCircle2 },
      COMPLETED: { label: 'Concluído', variant: 'default' as const, icon: CheckCircle2 },
      OVERDUE: { label: 'Vencido', variant: 'destructive' as const, icon: AlertCircle },
      REFUNDED: { label: 'Reembolsado', variant: 'secondary' as const, icon: XCircle },
      CANCELLED: { label: 'Cancelado', variant: 'secondary' as const, icon: XCircle },
      FAILED: { label: 'Falhou', variant: 'destructive' as const, icon: XCircle },
      EXPIRED: { label: 'Expirado', variant: 'secondary' as const, icon: Clock }
    }

    const config = statusConfig[status] || statusConfig.PENDING
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-600 text-slate-200 border-slate-500">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  // Billing type helper
  const getBillingTypeLabel = (billingType: Payment['billingType']) => {
    const labels = {
      PIX: 'PIX',
      CREDIT_CARD: 'Cartão de Crédito',
      BOLETO: 'Boleto',
      UNDEFINED: 'Não definido'
    }
    return labels[billingType] || billingType
  }

  // Payment type helper
  const getPaymentTypeLabel = (payment: Payment) => {
    if (payment.type === 'SUBSCRIPTION') {
      const planName = payment.planType
        ? payment.planType.charAt(0) + payment.planType.slice(1).toLowerCase()
        : ''
      return `Assinatura ${planName} ${payment.billingCycle === 'YEARLY' ? '(Anual)' : '(Mensal)'}`
    }
    if (payment.type === 'CREDIT_PURCHASE') {
      return payment.description || `Compra de ${payment.creditAmount} créditos`
    }
    if (payment.type === 'PHOTO_PACKAGE') {
      return 'Pacote de Fotos'
    }
    return payment.description || 'Pagamento'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Todos ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Assinaturas ({payments.filter(p => p.type === 'SUBSCRIPTION').length})
          </TabsTrigger>
          <TabsTrigger value="purchase" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">
            Compras ({payments.filter(p => p.type !== 'SUBSCRIPTION').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
            {filteredPayments.length === 0 ? (
              <CardContent className="py-12 text-center">
                <p className="text-slate-300">Nenhum pagamento encontrado.</p>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <div className="divide-y divide-slate-600/30">
                  {filteredPayments.map((payment) => (
                    <div key={payment.id} className="p-5 hover:bg-slate-700/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left side - Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <div>
                              <h3 className="font-semibold text-white text-sm">
                                {getPaymentTypeLabel(payment)}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {getBillingTypeLabel(payment.billingType)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-400 ml-7">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(payment.confirmedDate || payment.dueDate || payment.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Right side - Value & Status */}
                        <div className="text-right space-y-2">
                          <div className="text-base font-semibold text-white">
                            R$ {payment.value.toFixed(2)}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    </div>
                  ))}
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
              onClick={() => fetchPayments(currentPage - 1)}
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
              onClick={() => fetchPayments(currentPage + 1)}
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
