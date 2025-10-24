'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  BarChart3,
  PieChart,
  Target,
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'

interface UsagePattern {
  period: string
  usage: number
  efficiency: number
  trend: 'up' | 'down' | 'stable'
}

interface UsageAnalyticsProps {
  userId: string
  plan: string
  balance: {
    totalCredits: number
    usedCredits: number
    creditLimit: number
    subscriptionCredits: number
    purchasedCredits: number
  }
}

interface UsageInsight {
  type: 'warning' | 'info' | 'success'
  title: string
  description: string
  action?: string
}

export function UsageAnalytics({ userId, plan, balance }: UsageAnalyticsProps) {
  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | 'quarter'>('month')
  const [usagePatterns, setUsagePatterns] = useState<UsagePattern[]>([])
  const [insights, setInsights] = useState<UsageInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsageAnalytics()
  }, [timeFrame, userId])

  const loadUsageAnalytics = async () => {
    setLoading(true)
    try {
      // Simular dados de análise - em produção viria da API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockPatterns: UsagePattern[] = [
        { period: 'Semana 1', usage: 45, efficiency: 85, trend: 'up' },
        { period: 'Semana 2', usage: 38, efficiency: 92, trend: 'down' },
        { period: 'Semana 3', usage: 52, efficiency: 78, trend: 'up' },
        { period: 'Semana 4', usage: 41, efficiency: 88, trend: 'down' }
      ]
      
      setUsagePatterns(mockPatterns)
      generateInsights()
    } catch (error) {
      console.error('Error loading usage analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = () => {
    const currentUsage = (balance.usedCredits / balance.creditLimit) * 100
    const newInsights: UsageInsight[] = []

    if (currentUsage > 80) {
      newInsights.push({
        type: 'warning',
        title: 'Alto consumo detectado',
        description: `Você já usou ${currentUsage.toFixed(0)}% dos seus créditos mensais`,
        action: 'Considere comprar créditos extras'
      })
    }

    if (balance.purchasedCredits > balance.subscriptionCredits) {
      newInsights.push({
        type: 'info',
        title: 'Dependência de créditos comprados',
        description: 'Você está usando mais créditos comprados que da assinatura',
        action: 'Considere fazer upgrade do plano'
      })
    }

    if (currentUsage < 50) {
      newInsights.push({
        type: 'success',
        title: 'Uso eficiente',
        description: 'Você está usando seus créditos de forma equilibrada',
        action: 'Continue assim!'
      })
    }

    setInsights(newInsights)
  }

  const avgUsage = usagePatterns.reduce((acc, pattern) => acc + pattern.usage, 0) / usagePatterns.length
  const avgEfficiency = usagePatterns.reduce((acc, pattern) => acc + pattern.efficiency, 0) / usagePatterns.length
  
  const projectedMonthlyUsage = Math.round(avgUsage * 4.33) // Aproximadamente semanas em um mês
  const remainingDays = 30 - new Date().getDate()
  const dailyBudget = Math.round((balance.totalCredits - balance.usedCredits) / Math.max(remainingDays, 1))

  const getInsightIcon = (type: UsageInsight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'info':
        return <Activity className="w-5 h-5 text-blue-500" />
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
    }
  }

  const getInsightBadge = (type: UsageInsight['type']) => {
    switch (type) {
      case 'warning':
        return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Atenção</Badge>
      case 'info':
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Dica</Badge>
      case 'success':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Sucesso</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-300 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 rounded w-full"></div>
                <div className="h-3 bg-gray-300 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controles de Período */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Análise de Uso
            </CardTitle>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <Button
                  key={period}
                  variant={timeFrame === period ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeFrame(period)}
                >
                  {period === 'week' && '7 dias'}
                  {period === 'month' && '30 dias'}
                  {period === 'quarter' && '90 dias'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso Médio Semanal</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{avgUsage.toFixed(0)}</div>
            <p className="text-xs text-gray-500">créditos por semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiência Média</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgEfficiency.toFixed(0)}%</div>
            <p className="text-xs text-gray-500">aproveitamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projeção Mensal</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{projectedMonthlyUsage}</div>
            <p className="text-xs text-gray-500">créditos estimados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamento Diário</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dailyBudget}</div>
            <p className="text-xs text-gray-500">créditos por dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Padrões de Uso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Padrões de Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usagePatterns.map((pattern, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {pattern.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {pattern.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {pattern.trend === 'stable' && <Activity className="w-4 h-4 text-blue-500" />}
                  <div>
                    <p className="font-medium">{pattern.period}</p>
                    <p className="text-sm text-gray-600">{pattern.usage} créditos usados</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{pattern.efficiency}% eficiente</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Insights e Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Colete mais dados para ver insights personalizados</p>
              </div>
            ) : (
              insights.map((insight, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{insight.title}</p>
                      {getInsightBadge(insight.type)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    {insight.action && (
                      <p className="text-sm font-medium text-blue-600">{insight.action}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparação com Plano */}
      <Card>
        <CardHeader>
          <CardTitle>Análise por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Seu Plano: {plan}</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Limite mensal:</span>
                  <span className="font-medium">{balance.creditLimit} créditos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Usado este mês:</span>
                  <span className="font-medium">{balance.usedCredits} créditos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxa de uso:</span>
                  <span className="font-medium">
                    {((balance.usedCredits / balance.creditLimit) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Otimização</h4>
              <div className="space-y-2 text-sm">
                {projectedMonthlyUsage > balance.creditLimit ? (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Considere upgrade do plano</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Plano adequado ao seu uso</span>
                  </div>
                )}
                {balance.purchasedCredits > 0 && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Activity className="w-4 h-4" />
                    <span>{balance.purchasedCredits} créditos extras disponíveis</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}