'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Wallet,
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Settings,
  Download,
  RefreshCw,
  Bell,
  AlertCircle,
  CheckCircle2,
  Zap,
  History
} from 'lucide-react'

import { CreditBalance } from './credit-balance'
import { UsageAnalytics } from './usage-analytics'
import { UsageProjections } from './usage-projections'

interface User {
  id: string
  name?: string
  email: string
  plan: string
  creditsUsed: number
  creditsLimit: number
}

interface CreditsDashboardProps {
  user: User
}

interface DashboardStats {
  totalCredits: number
  usedCredits: number
  availableCredits: number
  subscriptionCredits: number
  purchasedCredits: number
  creditLimit: number
  nextReset: string | null
  efficiency: number
  monthlyTrend: number
}

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action: () => void
  variant: 'default' | 'outline' | 'destructive'
}

export function CreditsDashboard({ user }: CreditsDashboardProps) {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'warning' | 'info' | 'success'
    message: string
    action?: () => void
  }>>([])

  useEffect(() => {
    loadDashboardData()
  }, [user.id])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/credits/balance')
      const data = await response.json()
      
      if (data.success) {
        const balance = data.balance
        const stats: DashboardStats = {
          totalCredits: balance.totalCredits,
          usedCredits: balance.usedCredits,
          availableCredits: balance.availableCredits,
          subscriptionCredits: balance.subscriptionCredits,
          purchasedCredits: balance.purchasedCredits,
          creditLimit: balance.creditLimit,
          nextReset: balance.nextReset,
          efficiency: Math.round((balance.usedCredits / balance.creditLimit) * 100),
          monthlyTrend: 15 // Mock - seria calculado baseado no histórico
        }
        
        setDashboardStats(stats)
        generateNotifications(stats)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateNotifications = (stats: DashboardStats) => {
    const newNotifications = []
    
    if (stats.efficiency > 80) {
      newNotifications.push({
        id: 'high-usage',
        type: 'warning' as const,
        message: `Você já usou ${stats.efficiency}% dos seus créditos mensais`,
        action: () => setActiveTab('projections')
      })
    }

    if (stats.purchasedCredits > 0) {
      newNotifications.push({
        id: 'purchased-available',
        type: 'info' as const,
        message: `${stats.purchasedCredits} créditos extras disponíveis`,
      })
    }

    if (stats.efficiency < 50) {
      newNotifications.push({
        id: 'efficient-usage',
        type: 'success' as const,
        message: 'Uso eficiente dos seus créditos este mês!'
      })
    }

    setNotifications(newNotifications)
  }

  const quickActions: QuickAction[] = [
    {
      id: 'buy-credits',
      title: 'Comprar Créditos',
      description: 'Adquirir pacotes extras',
      icon: <Wallet className="w-4 h-4" />,
      action: () => window.location.href = '/credits',
      variant: 'default'
    },
    {
      id: 'view-history',
      title: 'Ver Histórico',
      description: 'Transações detalhadas',
      icon: <History className="w-4 h-4" />,
      action: () => window.location.href = '/credits/history',
      variant: 'outline'
    },
    {
      id: 'export-data',
      title: 'Exportar Dados',
      description: 'Download do relatório',
      icon: <Download className="w-4 h-4" />,
      action: () => console.log('Export data'),
      variant: 'outline'
    },
    {
      id: 'settings',
      title: 'Configurações',
      description: 'Alertas e preferências',
      icon: <Settings className="w-4 h-4" />,
      action: () => console.log('Settings'),
      variant: 'outline'
    }
  ]

  const mockCurrentMonthUsage = [45, 38, 52, 41] // Mock data para projeções
  const mockHistoricalData = {
    lastMonth: 180,
    twoMonthsAgo: 165,
    threeMonthsAgo: 142
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-300 rounded w-1/3"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-full"></div>
                  <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard de Créditos
              </h1>
            </div>
            <p className="text-gray-600">
              Painel completo para gerenciar e monitorar seus créditos
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadDashboardData} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            {dashboardStats && (
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {dashboardStats.availableCredits} créditos disponíveis
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                notification.type === 'warning' ? 'border-orange-200 bg-orange-50' :
                notification.type === 'info' ? 'border-blue-200 bg-blue-50' :
                'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-orange-500" />}
                  {notification.type === 'info' && <Bell className="w-5 h-5 text-blue-500" />}
                  {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </div>
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
              {notification.action && (
                <Button variant="outline" size="sm" onClick={notification.action}>
                  Ver Detalhes
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant}
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={action.action}
                >
                  <div className="flex items-center gap-2 w-full">
                    {action.icon}
                    <span className="font-medium">{action.title}</span>
                  </div>
                  <span className="text-xs opacity-70 text-left">{action.description}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Análises</span>
          </TabsTrigger>
          <TabsTrigger value="projections" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Projeções</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {dashboardStats && (
            <>
              <CreditBalance 
                balance={dashboardStats} 
                user={user} 
              />
              
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Eficiência do Mês</CardTitle>
                    <Target className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{dashboardStats.efficiency}%</div>
                    <p className="text-xs text-gray-500">dos créditos usados</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tendência Mensal</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">+{dashboardStats.monthlyTrend}%</div>
                    <p className="text-xs text-gray-500">vs. mês anterior</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
                    <Badge variant="outline">{user.plan}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.creditLimit}</div>
                    <p className="text-xs text-gray-500">créditos/mês</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Próxima Renovação</CardTitle>
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-purple-600">
                      {dashboardStats.nextReset 
                        ? new Date(dashboardStats.nextReset).toLocaleDateString('pt-BR', { 
                            day: 'numeric', 
                            month: 'short' 
                          })
                        : 'N/A'
                      }
                    </div>
                    <p className="text-xs text-gray-500">renovação automática</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {dashboardStats && (
            <UsageAnalytics 
              userId={user.id}
              plan={user.plan}
              balance={dashboardStats}
            />
          )}
        </TabsContent>

        <TabsContent value="projections" className="space-y-6">
          {dashboardStats && (
            <UsageProjections 
              balance={dashboardStats}
              plan={user.plan}
              currentMonthUsage={mockCurrentMonthUsage}
              historicalData={mockHistoricalData}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico Detalhado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Histórico Completo
                </h3>
                <p className="text-gray-500 mb-4">
                  Para ver o histórico detalhado de transações
                </p>
                <Button onClick={() => window.location.href = '/credits/history'}>
                  Ver Histórico Completo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}