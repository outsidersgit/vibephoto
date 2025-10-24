'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Zap,
  BarChart3,
  PieChart,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

interface UsageProjection {
  scenario: 'conservative' | 'current' | 'aggressive'
  monthlyUsage: number
  daysUntilLimit: number | null
  recommendedAction: string
  confidence: number
}

interface MonthlyForecast {
  week: number
  projected: number
  actual?: number
  confidence: number
}

interface UsageProjectionsProps {
  balance: {
    totalCredits: number
    usedCredits: number
    creditLimit: number
    subscriptionCredits: number
    purchasedCredits: number
  }
  plan: string
  currentMonthUsage: number[]
  historicalData?: {
    lastMonth: number
    twoMonthsAgo: number
    threeMonthsAgo: number
  }
}

export function UsageProjections({ 
  balance, 
  plan, 
  currentMonthUsage, 
  historicalData 
}: UsageProjectionsProps) {
  const [projections, setProjections] = useState<UsageProjection[]>([])
  const [monthlyForecast, setMonthlyForecast] = useState<MonthlyForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState<'conservative' | 'current' | 'aggressive'>('current')

  useEffect(() => {
    calculateProjections()
  }, [balance, currentMonthUsage, historicalData])

  const calculateProjections = () => {
    setLoading(true)
    
    try {
      const currentDay = new Date().getDate()
      const daysInMonth = new Date().getMonth() === 1 
        ? (new Date().getFullYear() % 4 === 0 ? 29 : 28)
        : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][new Date().getMonth()]
      
      const dailyAverage = balance.usedCredits / currentDay
      const weeklyAverage = currentMonthUsage.length > 0 
        ? currentMonthUsage.reduce((sum, week) => sum + week, 0) / currentMonthUsage.length
        : dailyAverage * 7

      // Cenário Conservador (reduz 20% do uso atual)
      const conservativeDaily = dailyAverage * 0.8
      const conservativeMonthly = Math.round(conservativeDaily * daysInMonth)
      
      // Cenário Atual (mantém padrão atual)
      const currentMonthly = Math.round(dailyAverage * daysInMonth)
      
      // Cenário Agressivo (aumenta 25% do uso atual)
      const aggressiveDaily = dailyAverage * 1.25
      const aggressiveMonthly = Math.round(aggressiveDaily * daysInMonth)

      const calculateDaysUntilLimit = (dailyRate: number) => {
        if (dailyRate === 0) return null
        const remainingCredits = balance.totalCredits - balance.usedCredits
        return remainingCredits > 0 ? Math.floor(remainingCredits / dailyRate) : 0
      }

      const newProjections: UsageProjection[] = [
        {
          scenario: 'conservative',
          monthlyUsage: conservativeMonthly,
          daysUntilLimit: calculateDaysUntilLimit(conservativeDaily),
          recommendedAction: conservativeMonthly > balance.creditLimit ? 
            'Mesmo com uso reduzido, considere comprar créditos' : 
            'Mantenha o uso eficiente',
          confidence: 75
        },
        {
          scenario: 'current',
          monthlyUsage: currentMonthly,
          daysUntilLimit: calculateDaysUntilLimit(dailyAverage),
          recommendedAction: currentMonthly > balance.creditLimit ? 
            'Provável necessidade de créditos extras' : 
            'Uso dentro do limite do plano',
          confidence: 85
        },
        {
          scenario: 'aggressive',
          monthlyUsage: aggressiveMonthly,
          daysUntilLimit: calculateDaysUntilLimit(aggressiveDaily),
          recommendedAction: aggressiveMonthly > balance.creditLimit ? 
            'Necessário comprar créditos ou fazer upgrade' : 
            'Plano suficiente para maior uso',
          confidence: 65
        }
      ]

      setProjections(newProjections)

      // Projeção semanal para o mês
      const weeksInMonth = Math.ceil(daysInMonth / 7)
      const weeklyProjection = currentMonthly / weeksInMonth
      
      const forecast: MonthlyForecast[] = Array.from({ length: weeksInMonth }, (_, index) => ({
        week: index + 1,
        projected: Math.round(weeklyProjection * (index + 1)),
        actual: currentMonthUsage[index],
        confidence: Math.max(90 - (index * 10), 60)
      }))
      
      setMonthlyForecast(forecast)
    } catch (error) {
      console.error('Error calculating projections:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScenarioColor = (scenario: UsageProjection['scenario']) => {
    switch (scenario) {
      case 'conservative':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'current':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'aggressive':
        return 'text-orange-600 bg-orange-50 border-orange-200'
    }
  }

  const getScenarioIcon = (scenario: UsageProjection['scenario']) => {
    switch (scenario) {
      case 'conservative':
        return <TrendingDown className="w-4 h-4" />
      case 'current':
        return <Target className="w-4 h-4" />
      case 'aggressive':
        return <TrendingUp className="w-4 h-4" />
    }
  }

  const getScenarioTitle = (scenario: UsageProjection['scenario']) => {
    switch (scenario) {
      case 'conservative':
        return 'Conservador'
      case 'current':
        return 'Atual'
      case 'aggressive':
        return 'Intensivo'
    }
  }

  const selectedProjection = projections.find(p => p.scenario === selectedScenario)

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-300 rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Seletor de Cenário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Projeções de Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projections.map((projection) => (
              <div
                key={projection.scenario}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  selectedScenario === projection.scenario
                    ? getScenarioColor(projection.scenario)
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedScenario(projection.scenario)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getScenarioIcon(projection.scenario)}
                  <h3 className="font-semibold">{getScenarioTitle(projection.scenario)}</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {projection.monthlyUsage}
                  </p>
                  <p className="text-sm opacity-75">créditos/mês</p>
                  <Badge variant="secondary" className="text-xs">
                    {projection.confidence}% confiança
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalhes do Cenário Selecionado */}
      {selectedProjection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Cenário {getScenarioTitle(selectedProjection.scenario)}
              </span>
              <Badge variant="outline" className={getScenarioColor(selectedProjection.scenario)}>
                {selectedProjection.confidence}% confiança
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Uso projetado:</span>
                  <span className="font-semibold">{selectedProjection.monthlyUsage} créditos</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Limite do plano:</span>
                  <span className="font-semibold">{balance.creditLimit} créditos</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Diferença:</span>
                  <span className={`font-semibold ${
                    selectedProjection.monthlyUsage > balance.creditLimit 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {selectedProjection.monthlyUsage > balance.creditLimit ? '+' : ''}
                    {selectedProjection.monthlyUsage - balance.creditLimit}
                  </span>
                </div>

                <Progress 
                  value={(selectedProjection.monthlyUsage / balance.creditLimit) * 100} 
                  className="h-2"
                />
                
                {selectedProjection.daysUntilLimit && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      Créditos esgotarão em aproximadamente {selectedProjection.daysUntilLimit} dias
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  selectedProjection.monthlyUsage > balance.creditLimit
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedProjection.monthlyUsage > balance.creditLimit ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    <h4 className="font-medium">Recomendação</h4>
                  </div>
                  <p className="text-sm">{selectedProjection.recommendedAction}</p>
                </div>

                {selectedProjection.monthlyUsage > balance.creditLimit && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Créditos extras necessários:</h4>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedProjection.monthlyUsage - balance.creditLimit}
                    </p>
                    <Button size="sm" className="w-full">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Ver Pacotes de Créditos
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previsão Semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Previsão Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyForecast.map((week) => (
              <div key={week.week} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">{week.week}</span>
                  </div>
                  <div>
                    <p className="font-medium">Semana {week.week}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Projetado: {week.projected}</span>
                      {week.actual !== undefined && (
                        <span>• Real: {week.actual}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    {week.confidence}% confiança
                  </Badge>
                  {week.actual !== undefined && (
                    <div className={`text-xs mt-1 ${
                      week.actual > week.projected ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {week.actual > week.projected ? '+' : ''}
                      {week.actual - week.projected}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparação com Histórico */}
      {historicalData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Comparação Histórica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Há 3 meses</p>
                  <p className="text-xl font-semibold">{historicalData.threeMonthsAgo}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Há 2 meses</p>
                  <p className="text-xl font-semibold">{historicalData.twoMonthsAgo}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Mês passado</p>
                  <p className="text-xl font-semibold text-blue-600">{historicalData.lastMonth}</p>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600">Tendência de crescimento:</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {historicalData.lastMonth > historicalData.twoMonthsAgo ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-green-600 font-medium">
                        +{((historicalData.lastMonth - historicalData.twoMonthsAgo) / historicalData.twoMonthsAgo * 100).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 font-medium">
                        {((historicalData.lastMonth - historicalData.twoMonthsAgo) / historicalData.twoMonthsAgo * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações Recomendadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Ações Recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {selectedProjection && selectedProjection.monthlyUsage > balance.creditLimit && (
              <div className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <span>Comprar créditos extras para este mês</span>
                </div>
                <Button variant="outline" size="sm">
                  Ver Pacotes
                </Button>
              </div>
            )}
            
            <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                <span>Revisar projeções semanalmente</span>
              </div>
              <Button variant="outline" size="sm" onClick={calculateProjections}>
                Atualizar
              </Button>
            </div>
            
            {selectedProjection && selectedProjection.monthlyUsage < balance.creditLimit * 0.7 && (
              <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Uso eficiente - considere plano inferior?</span>
                </div>
                <Button variant="outline" size="sm">
                  Ver Planos
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}