'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Settings,
  Download,
  Shield,
  Zap,
  Star,
  Crown
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface SubscriptionManagerProps {
  userId: string
  onPlanChange?: (newPlan: string) => void
}

interface SubscriptionData {
  user: {
    id: string
    plan: string
    creditsBalance: number
    creditsLimit: number
    creditsUsed: number
  }
  subscription?: {
    id: string
    plan: string
    status: string
    cycle: string
    value: number
    nextPayment: string
    nextPaymentDays: number
    isActive: boolean
    isOverdue: boolean
    willExpireSoon: boolean
    formattedValue: string
    formattedNextPayment: string
  }
  nextPayments: any[]
  metrics: {
    totalPaid: number
    totalPayments: number
    thisYearPaid: number
    subscriptionDays: number
    subscriptionMonths: number
  }
  availablePlans: {
    upgrades: string[]
    downgrades: string[]
    all: Array<{
      name: string
      isCurrent: boolean
      isUpgrade: boolean
      isDowngrade: boolean
    }>
  }
  canCancel: boolean
}

const planIcons = {
  STARTER: Shield,
  PREMIUM: Star,
  GOLD: Crown
}

const planColors = {
  STARTER: 'bg-gray-100 text-gray-800',
  PREMIUM: 'bg-blue-100 text-blue-800', 
  GOLD: 'bg-yellow-100 text-yellow-800'
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  OVERDUE: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800'
}

export function SubscriptionManager({ userId, onPlanChange }: SubscriptionManagerProps) {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelImmediately, setCancelImmediately] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSubscriptionData()
  }, [userId])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/payments/subscription/status')
      
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da assinatura',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
      toast({
        title: 'Erro',
        description: 'Erro de conexão ao carregar assinatura',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!data?.subscription?.id) return

    try {
      setCancelling(true)
      
      const response = await fetch('/api/payments/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: data.subscription.id,
          reason: cancelReason,
          cancelImmediately
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Assinatura Cancelada',
          description: result.message,
        })
        setShowCancelDialog(false)
        await loadSubscriptionData()
        
        if (cancelImmediately && onPlanChange) {
          onPlanChange('STARTER')
        }
      } else {
        toast({
          title: 'Erro ao Cancelar',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão ao cancelar assinatura',
        variant: 'destructive'
      })
    } finally {
      setCancelling(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return CheckCircle2
      case 'CANCELLED':
        return XCircle
      case 'OVERDUE':
        return AlertTriangle
      case 'SUSPENDED':
        return Clock
      default:
        return Clock
    }
  }

  const getUsagePercentage = () => {
    if (!data?.user) return 0
    return Math.min((data.user.creditsUsed / data.user.creditsLimit) * 100, 100)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Não foi possível carregar os dados da assinatura</p>
          <Button onClick={loadSubscriptionData} className="mt-4">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const PlanIcon = planIcons[data.user.plan as keyof typeof planIcons] || Shield
  const StatusIcon = data.subscription ? getStatusIcon(data.subscription.status) : XCircle

  return (
    <div className="space-y-6">
      {/* Main Subscription Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PlanIcon className="h-5 w-5 text-primary" />
                <span>Plano {data.user.plan}</span>
              </div>
              {data.subscription && (
                <Badge 
                  variant="secondary" 
                  className={statusColors[data.subscription.status as keyof typeof statusColors]}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {data.subscription.status}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {data.subscription 
                ? `Assinatura ${data.subscription.cycle === 'MONTHLY' ? 'mensal' : 'anual'} • ${data.subscription.formattedValue}`
                : 'Sem assinatura ativa'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {data.subscription ? (
              <>
                {/* Next Payment Info */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Próximo Pagamento</p>
                      <p className="text-sm text-muted-foreground">
                        {data.subscription.formattedNextPayment}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{data.subscription.formattedValue}</p>
                    <p className={`text-sm ${
                      data.subscription.willExpireSoon 
                        ? 'text-amber-600' 
                        : data.subscription.isOverdue 
                        ? 'text-red-600' 
                        : 'text-muted-foreground'
                    }`}>
                      {data.subscription.isOverdue 
                        ? 'Em atraso'
                        : data.subscription.willExpireSoon 
                        ? `Em ${data.subscription.nextPaymentDays} dias`
                        : `${data.subscription.nextPaymentDays} dias`
                      }
                    </p>
                  </div>
                </div>

                {/* Usage Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uso de Créditos Este Mês</span>
                    <span>{data.user.creditsUsed} / {data.user.creditsLimit}</span>
                  </div>
                  <Progress value={getUsagePercentage()} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Saldo atual: {data.user.creditsBalance} créditos
                  </p>
                </div>

                {/* Alerts */}
                {data.subscription.isOverdue && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Pagamento em Atraso</p>
                      <p className="text-xs text-red-600">
                        Regularize seu pagamento para manter o acesso completo
                      </p>
                    </div>
                  </div>
                )}

                {data.subscription.willExpireSoon && !data.subscription.isOverdue && (
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Renovação Próxima</p>
                      <p className="text-xs text-amber-600">
                        Seu próximo pagamento será processado em breve
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {data.availablePlans.upgrades.length > 0 && (
                    <Button variant="default" size="sm">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Fazer Upgrade
                    </Button>
                  )}
                  
                  <Button variant="outline" size="sm">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Alterar Pagamento
                  </Button>

                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Faturas
                  </Button>

                  {data.canCancel && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>Tem certeza que deseja cancelar sua assinatura?</p>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm">
                              <p className="font-medium mb-2">O que acontecerá:</p>
                              <ul className="space-y-1 text-muted-foreground">
                                <li>• Acesso aos recursos premium até {data.subscription.formattedNextPayment}</li>
                                <li>• Plano será alterado para STARTER após o vencimento</li>
                                <li>• Sem cobrança do próximo ciclo</li>
                                <li>• Modelos e dados serão mantidos</li>
                              </ul>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Manter Assinatura</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancelSubscription}
                            disabled={cancelling}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {cancelling ? 'Cancelando...' : 'Sim, Cancelar'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </>
            ) : (
              /* No Subscription */
              <div className="text-center py-8">
                <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Plano Gratuito</h3>
                <p className="text-muted-foreground mb-4">
                  Você está usando o plano gratuito com {data.user.creditsLimit} créditos diários
                </p>
                
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span>Uso Hoje</span>
                    <span>{data.user.creditsUsed} / {data.user.creditsLimit}</span>
                  </div>
                  <Progress value={getUsagePercentage()} className="h-2" />
                </div>

                <Button className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Escolher Plano Premium
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscription Metrics */}
      {data.subscription && data.metrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas da Assinatura</CardTitle>
              <CardDescription>
                Resumo dos seus {data.metrics.subscriptionMonths} meses como assinante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(data.metrics.totalPaid)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Investido</p>
                </div>
                
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {data.metrics.totalPayments}
                  </p>
                  <p className="text-sm text-muted-foreground">Pagamentos Realizados</p>
                </div>
                
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(data.metrics.thisYearPaid)}
                  </p>
                  <p className="text-sm text-muted-foreground">Gasto Este Ano</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Next Payments Preview */}
      {data.nextPayments && data.nextPayments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Próximos Pagamentos</CardTitle>
              <CardDescription>
                Previsão dos próximos ciclos de cobrança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.nextPayments.slice(0, 3).map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{payment.formattedDate}</p>
                        <p className="text-sm text-muted-foreground">
                          Cobrança {payment.cycle === 'MONTHLY' ? 'mensal' : 'anual'}
                        </p>
                      </div>
                    </div>
                    <div className="font-bold">
                      {payment.formattedValue}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}