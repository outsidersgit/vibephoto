'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Clock,
  XCircle,
  DollarSign,
  Users,
  Activity,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface PaymentRecoveryDashboardProps {
  isAdmin?: boolean
}

interface HealthMetrics {
  successRate24h: number
  successRate7d: number
  totalPayments24h: number
  totalPayments7d: number
  recoveredPayments7d: number
  commonErrors: any[]
  timestamp: string
}

interface FailedPayment {
  id: string
  asaasPaymentId: string
  type: string
  status: string
  value: number
  description: string
  createdAt: string
  retryCount: number
  user: {
    id: string
    name: string
    email: string
  }
}

interface RecoveryStats {
  totalFailedPayments: number
  totalRecoveredPayments: number
  recoveryRate: number
  errorsByLevel: Record<string, number>
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
}

const statusIcons = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: XCircle
}

export function PaymentRecoveryDashboard({ isAdmin = false }: PaymentRecoveryDashboardProps) {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null)
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([])
  const [recoveryStats, setRecoveryStats] = useState<RecoveryStats | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<FailedPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadDashboardData()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      const [metricsResponse, paymentsResponse, statsResponse] = await Promise.all([
        fetch('/api/payments/recovery?action=health_metrics'),
        fetch('/api/payments/recovery?action=failed_payments'),
        fetch('/api/payments/recovery?action=recovery_stats')
      ])

      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json()
        setHealthMetrics(metrics)
      }

      if (paymentsResponse.ok) {
        const payments = await paymentsResponse.json()
        setFailedPayments(payments.failedPayments)
      }

      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        setRecoveryStats(stats.stats)
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do dashboard',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRunRecovery = async () => {
    if (!isAdmin) return

    try {
      setRecovering(true)
      
      const response = await fetch('/api/payments/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover_failed_payments' })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Recuperação Executada',
          description: result.message,
        })
        await loadDashboardData()
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao executar recuperação',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    } finally {
      setRecovering(false)
    }
  }

  const handleRetryPayment = async (paymentId: string) => {
    if (!isAdmin) return

    try {
      const response = await fetch('/api/payments/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'retry_payment', 
          paymentId 
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: result.recovered ? 'Pagamento Recuperado' : 'Tentativa Realizada',
          description: result.message,
        })
        await loadDashboardData()
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao tentar recuperar pagamento',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const handleUpdatePaymentStatus = async (paymentId: string, newStatus: string, reason?: string) => {
    if (!isAdmin) return

    try {
      const response = await fetch('/api/payments/recovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentId, 
          newStatus, 
          reason 
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Status Atualizado',
          description: result.message,
        })
        setSelectedPayment(null)
        await loadDashboardData()
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao atualizar status',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  if (loading && !healthMetrics) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const getSuccessRateTrend = () => {
    if (!healthMetrics) return { direction: 'neutral', difference: 0 }
    
    const difference = healthMetrics.successRate24h - healthMetrics.successRate7d
    return {
      direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'neutral',
      difference: Math.abs(difference)
    }
  }

  const trend = getSuccessRateTrend()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recovery de Pagamentos</h1>
          <p className="text-muted-foreground">
            Monitoramento e recuperação automática de pagamentos falhos
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setAutoRecoveryEnabled(!autoRecoveryEnabled)}
            >
              {autoRecoveryEnabled ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Auto-Recovery {autoRecoveryEnabled ? 'Ativo' : 'Inativo'}
            </Button>
            
            <Button onClick={handleRunRecovery} disabled={recovering}>
              {recovering ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Executar Recovery
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={loadDashboardData}>
              Atualizar
            </Button>
          </div>
        )}
      </div>

      {/* Health Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthMetrics?.successRate24h || 0}%
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                ) : trend.direction === 'down' ? (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                ) : (
                  <Activity className="h-3 w-3 mr-1" />
                )}
                <span>{trend.difference.toFixed(1)}% vs 7 dias</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos (24h)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthMetrics?.totalPayments24h || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {healthMetrics?.totalPayments7d || 0} nos últimos 7 dias
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recuperados (7d)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthMetrics?.recoveredPayments7d || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {recoveryStats?.recoveryRate || 0}% de taxa de recuperação
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhas Ativas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {failedPayments.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Requerem atenção manual
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="failed_payments">Pagamentos Falhos</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status do Sistema</CardTitle>
              <CardDescription>
                Estado atual do sistema de pagamentos e recovery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Taxa de Sucesso Geral</span>
                  <div className="flex items-center space-x-2">
                    <Progress 
                      value={healthMetrics?.successRate7d || 0} 
                      className="w-32" 
                    />
                    <span className="text-sm font-medium">
                      {healthMetrics?.successRate7d || 0}%
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Auto-Recovery</span>
                  <Badge 
                    variant={autoRecoveryEnabled ? 'default' : 'secondary'}
                    className={autoRecoveryEnabled ? 'bg-green-100 text-green-800' : ''}
                  >
                    {autoRecoveryEnabled ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Última Execução</span>
                  <span className="text-sm text-muted-foreground">
                    {healthMetrics ? formatDate(healthMetrics.timestamp) : 'Nunca'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed_payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos que Falharam</CardTitle>
              <CardDescription>
                Pagamentos que precisam de atenção manual ({failedPayments.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {failedPayments.map((payment, index) => {
                  const StatusIcon = statusIcons[payment.status as keyof typeof statusIcons] || AlertTriangle
                  
                  return (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <StatusIcon className="h-4 w-4 text-red-600" />
                            </div>
                            
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium">{payment.description}</h4>
                                <Badge 
                                  variant="secondary" 
                                  className={statusColors[payment.status as keyof typeof statusColors]}
                                >
                                  {payment.status}
                                </Badge>
                              </div>
                              
                              <div className="text-sm text-muted-foreground">
                                <span>{payment.user.name} ({payment.user.email})</span>
                                <span className="ml-2">•</span>
                                <span className="ml-2">{formatCurrency(payment.value)}</span>
                                <span className="ml-2">•</span>
                                <span className="ml-2">{formatDate(payment.createdAt)}</span>
                                {payment.retryCount > 0 && (
                                  <>
                                    <span className="ml-2">•</span>
                                    <span className="ml-2">{payment.retryCount} tentativas</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedPayment(payment)}
                                >
                                  Detalhes
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Detalhes do Pagamento</DialogTitle>
                                  <DialogDescription>
                                    Informações completas e ações de recuperação
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {selectedPayment && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <strong>ID:</strong> {selectedPayment.id}
                                      </div>
                                      <div>
                                        <strong>Asaas ID:</strong> {selectedPayment.asaasPaymentId}
                                      </div>
                                      <div>
                                        <strong>Tipo:</strong> {selectedPayment.type}
                                      </div>
                                      <div>
                                        <strong>Status:</strong> {selectedPayment.status}
                                      </div>
                                      <div>
                                        <strong>Valor:</strong> {formatCurrency(selectedPayment.value)}
                                      </div>
                                      <div>
                                        <strong>Tentativas:</strong> {selectedPayment.retryCount}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <strong>Cliente:</strong><br />
                                      {selectedPayment.user.name}<br />
                                      {selectedPayment.user.email}
                                    </div>
                                    
                                    {isAdmin && (
                                      <div className="flex space-x-2 pt-4 border-t">
                                        <Button 
                                          size="sm"
                                          onClick={() => handleRetryPayment(selectedPayment.id)}
                                        >
                                          Tentar Novamente
                                        </Button>
                                        
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleUpdatePaymentStatus(selectedPayment.id, 'CONFIRMED')}
                                        >
                                          Marcar como Pago
                                        </Button>
                                        
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleUpdatePaymentStatus(selectedPayment.id, 'CANCELLED', 'Cancelado manualmente')}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            
                            {isAdmin && (
                              <Button 
                                size="sm"
                                onClick={() => handleRetryPayment(payment.id)}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}

                {failedPayments.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum Pagamento Falhou!</h3>
                    <p className="text-muted-foreground">
                      Todos os pagamentos recentes foram processados com sucesso.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Recovery</CardTitle>
              </CardHeader>
              <CardContent>
                {recoveryStats && (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Pagamentos Falhos:</span>
                      <span className="font-medium">{recoveryStats.totalFailedPayments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recuperados:</span>
                      <span className="font-medium text-green-600">{recoveryStats.totalRecoveredPayments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de Recovery:</span>
                      <span className="font-medium">{recoveryStats.recoveryRate}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Erros por Severidade</CardTitle>
              </CardHeader>
              <CardContent>
                {recoveryStats && (
                  <div className="space-y-2">
                    {Object.entries(recoveryStats.errorsByLevel).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="secondary"
                            className={
                              level === 'ERROR' ? 'bg-red-100 text-red-800' :
                              level === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {level}
                          </Badge>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}