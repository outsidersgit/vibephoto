'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, TrendingUp, Users, CreditCard, Activity, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Stats {
  users: {
    total: number
    withAsaasId: number
    percentage: string
  }
  payments: {
    total: number
  }
  webhooks: {
    total: number
    failed: number
    successRate: string
  }
  subscriptions: Array<{
    plan: string
    count: number
  }>
}

interface RecentActivity {
  payments: any[]
  webhooks: Array<{
    id: string
    event: string
    processed: boolean
    processingError: string | null
    retryCount: number
    createdAt: string
  }>
}

export default function AsaasDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null)
  const [eventDistribution, setEventDistribution] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/asaas/stats')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar estatísticas')
      }

      setStats(data.stats)
      setRecentActivity(data.recentActivity)
      setEventDistribution(data.eventDistribution)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Asaas</h1>
        <p className="text-muted-foreground">Monitoramento de pagamentos e integrações</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Usuários</p>
              <p className="text-2xl font-bold">{stats?.users.total}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.users.withAsaasId} com Asaas ID ({stats?.users.percentage}%)
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pagamentos</p>
              <p className="text-2xl font-bold">{stats?.payments.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total registrado</p>
            </div>
            <CreditCard className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Webhooks</p>
              <p className="text-2xl font-bold">{stats?.webhooks.total}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.webhooks.successRate}% sucesso
              </p>
            </div>
            <Activity className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Falhas</p>
              <p className="text-2xl font-bold">{stats?.webhooks.failed}</p>
              <p className="text-xs text-muted-foreground mt-1">Webhooks falhados</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Subscription Distribution */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Distribuição de Planos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats?.subscriptions.map((sub) => (
            <div key={sub.plan} className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{sub.count}</p>
              <p className="text-sm text-muted-foreground">{sub.plan}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Event Distribution */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Top 10 Eventos de Webhook</h2>
        <div className="space-y-2">
          {eventDistribution.map((event) => (
            <div key={event.event} className="flex items-center justify-between p-3 bg-muted rounded">
              <span className="font-mono text-sm">{event.event}</span>
              <Badge variant="secondary">{event.count} eventos</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Webhooks */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Webhooks Recentes</h2>
        <div className="space-y-2">
          {recentActivity?.webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className={`flex items-center justify-between p-3 rounded ${
                webhook.processed && !webhook.processingError
                  ? 'bg-green-50 border border-green-200'
                  : webhook.processingError
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {webhook.processed && !webhook.processingError ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <div>
                  <p className="font-mono text-sm">{webhook.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(webhook.createdAt).toLocaleString('pt-BR')}
                  </p>
                  {webhook.processingError && (
                    <p className="text-xs text-red-600 mt-1">{webhook.processingError}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={webhook.processed ? 'default' : 'destructive'}>
                  {webhook.processed ? 'Processado' : 'Pendente'}
                </Badge>
                {webhook.retryCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {webhook.retryCount} tentativas
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Payments */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Pagamentos Recentes</h2>
        <div className="space-y-2">
          {recentActivity?.payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pagamento registrado</p>
          ) : (
            recentActivity?.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-muted rounded">
                <div>
                  <p className="font-semibold">{payment.user?.name || 'Usuário desconhecido'}</p>
                  <p className="text-xs text-muted-foreground">{payment.user?.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    R$ {typeof payment.amount === 'number' ? payment.amount.toFixed(2) : '0.00'}
                  </p>
                  <Badge variant={payment.status === 'CONFIRMED' ? 'default' : 'secondary'}>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}