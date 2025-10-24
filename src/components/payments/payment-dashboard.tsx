'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  CreditCard, 
  Calendar, 
  Download, 
  Eye, 
  MoreVertical, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Package
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils'
import { motion } from 'framer-motion'

interface PaymentDashboardProps {
  userId: string
  initialData?: {
    subscription?: any
    creditInfo?: any
    payments?: any[]
    creditTransactions?: any[]
  }
}

interface SubscriptionInfo {
  id: string
  plan: string
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED'
  nextPayment: string
  value: number
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  cycle: 'MONTHLY' | 'YEARLY'
}

interface PaymentRecord {
  id: string
  type: 'SUBSCRIPTION' | 'CREDIT_PURCHASE'
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED'
  value: number
  date: string
  description: string
  billingType: string
  paymentUrl?: string
}

interface CreditInfo {
  balance: number
  limit: number
  plan: string
  summary: {
    totalPurchased: number
    totalUsed: number
    thisMonthUsed: number
    currentBalance: number
    usagePercentage: number
  }
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  EXPIRED: 'bg-red-100 text-red-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  FAILED: 'bg-red-100 text-red-800'
}

const statusIcons = {
  ACTIVE: CheckCircle2,
  CANCELLED: XCircle,
  SUSPENDED: AlertTriangle,
  EXPIRED: XCircle,
  CONFIRMED: CheckCircle2,
  PENDING: Clock,
  FAILED: AlertTriangle
}

export function PaymentDashboard({ userId, initialData }: PaymentDashboardProps) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [creditTransactions, setCreditTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(!initialData)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (initialData) {
      setSubscription(initialData.subscription)
      setCreditInfo(initialData.creditInfo)
      setPayments(initialData.payments || [])
      setCreditTransactions(initialData.creditTransactions || [])
    } else {
      loadPaymentData()
    }
  }, [userId, initialData])

  const loadPaymentData = async () => {
    try {
      setLoading(true)
      
      // Load subscription info
      const subResponse = await fetch('/api/payments/subscription/status')
      if (subResponse.ok) {
        const subData = await subResponse.json()
        setSubscription(subData.subscription)
      }

      // Load credit info
      const creditResponse = await fetch('/api/payments/credits/history?type=all&limit=10')
      if (creditResponse.ok) {
        const creditData = await creditResponse.json()
        setCreditInfo({
          balance: creditData.balance,
          limit: creditData.limit,
          plan: creditData.plan,
          summary: creditData.summary
        })
        setCreditTransactions(creditData.transactions)
      }

      // Load payment history
      const paymentsResponse = await fetch('/api/payments/history?limit=20')
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json()
        setPayments(paymentsData.payments)
      }

    } catch (error) {
      console.error('Error loading payment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription || !confirm('Tem certeza que deseja cancelar sua assinatura?')) return

    try {
      const response = await fetch('/api/payments/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id })
      })

      if (response.ok) {
        await loadPaymentData()
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
    }
  }

  const handleViewPayment = (payment: PaymentRecord) => {
    if (payment.paymentUrl) {
      window.open(payment.paymentUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Subscription Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinatura</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{subscription.plan}</span>
                    <Badge 
                      variant="secondary" 
                      className={statusColors[subscription.status]}
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Próximo pagamento: {formatDate(subscription.nextPayment)}
                  </p>
                  <div className="flex justify-between items-center text-sm">
                    <span>{formatCurrency(subscription.value)}</span>
                    <span className="text-muted-foreground">
                      {subscription.cycle === 'MONTHLY' ? '/mês' : '/ano'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa</p>
                  <Button size="sm" className="mt-2">
                    Assinar agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Credit Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo de Créditos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditInfo ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{creditInfo.balance}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>{creditInfo.summary.usagePercentage}% usado este mês</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${Math.min(creditInfo.summary.usagePercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* This Month Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uso Este Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditInfo ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{creditInfo.summary.thisMonthUsed}</div>
                  <p className="text-xs text-muted-foreground">
                    de {creditInfo.limit} créditos disponíveis
                  </p>
                  <div className="flex justify-between items-center text-sm">
                    <span>Total comprado: {creditInfo.summary.totalPurchased}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="subscription">Assinatura</TabsTrigger>
          <TabsTrigger value="credits">Créditos</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Conta</CardTitle>
              <CardDescription>
                Visão geral das suas atividades e gastos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Plano {subscription.plan}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(subscription.value)} • {subscription.cycle === 'MONTHLY' ? 'Mensal' : 'Anual'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusColors[subscription.status]}>
                    {subscription.status}
                  </Badge>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Histórico de Créditos</h4>
                  <div className="space-y-2">
                    {creditTransactions.slice(0, 3).map((transaction, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {transaction.description}
                        </span>
                        <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Pagamentos Recentes</h4>
                  <div className="space-y-2">
                    {payments.slice(0, 3).map((payment, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate">
                          {payment.description}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(payment.value)}</span>
                          <Badge 
                            variant="secondary" 
                            className={`${statusColors[payment.status]} text-xs`}
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Assinatura</CardTitle>
              <CardDescription>
                Gerencie sua assinatura e método de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">Plano {subscription.plan}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(subscription.value)} • {subscription.cycle === 'MONTHLY' ? 'Cobrança mensal' : 'Cobrança anual'}
                      </p>
                    </div>
                    <Badge variant="secondary" className={statusColors[subscription.status]}>
                      {subscription.status}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="font-medium">Próximo Pagamento</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(subscription.nextPayment)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeDate(subscription.nextPayment)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Método de Pagamento</h4>
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{subscription.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm">
                      Alterar Plano
                    </Button>
                    <Button variant="outline" size="sm">
                      Alterar Método de Pagamento
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700"
                      onClick={handleCancelSubscription}
                    >
                      Cancelar Assinatura
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Você não possui uma assinatura ativa</p>
                  <Button>Escolher Plano</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Créditos</CardTitle>
              <CardDescription>
                Acompanhe suas compras e uso de créditos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creditTransactions.map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        transaction.type === 'purchase' ? 'bg-green-100' : 
                        transaction.type === 'usage' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <Package className={`h-4 w-4 ${
                          transaction.type === 'purchase' ? 'text-green-600' : 
                          transaction.type === 'usage' ? 'text-red-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.formattedDate} • {transaction.formattedTime}
                        </p>
                        {transaction.relatedAction && (
                          <p className="text-xs text-muted-foreground">
                            {transaction.relatedAction}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                      </span>
                      {transaction.status && (
                        <Badge 
                          variant="secondary" 
                          className={`${statusColors[transaction.status]} ml-2 text-xs`}
                        >
                          {transaction.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {creditTransactions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhuma transação de crédito encontrada</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription>
                Todos os seus pagamentos e transações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.map((payment, index) => {
                  const StatusIcon = statusIcons[payment.status]
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <StatusIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{payment.description}</p>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{formatDate(payment.date)}</span>
                            <span>•</span>
                            <span>{payment.billingType}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(payment.value)}</p>
                          <Badge 
                            variant="secondary" 
                            className={statusColors[payment.status]}
                          >
                            {payment.status}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewPayment(payment)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}

                {payments.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}