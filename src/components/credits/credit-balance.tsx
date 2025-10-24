'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Wallet, 
  TrendingUp, 
  Calendar,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

interface CreditBalanceProps {
  balance: {
    subscriptionCredits: number
    purchasedCredits: number
    totalCredits: number
    availableCredits: number
    usedCredits: number
    creditLimit: number
    nextReset: string | null
    efficiency?: number
    monthlyTrend?: number
    purchases?: Array<{
      id: string
      credits: number
      expiresAt: string
      isExpired: boolean
    }>
  } | null
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
  }
}

export function CreditBalance({ balance, user }: CreditBalanceProps) {
  const refreshBalance = () => {
    window.location.reload()
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50'
    if (percentage >= 70) return 'text-orange-600 bg-orange-50'
    return 'text-green-600 bg-green-50'
  }

  const subscriptionUsagePercentage = balance 
    ? Math.round((balance.usedCredits / balance.creditLimit) * 100)
    : Math.round((user.creditsUsed / user.creditsLimit) * 100)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (!balance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Wallet className="w-5 h-5 mr-2" />
              Meus Créditos
            </span>
            <Button variant="outline" size="sm" onClick={refreshBalance}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-gray-600">Erro ao carregar saldo de créditos</p>
            <Button variant="outline" onClick={refreshBalance} className="mt-2">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Wallet className="w-5 h-5 mr-2" />
              Meus Créditos
            </span>
            <Button variant="outline" size="sm" onClick={refreshBalance}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Disponível */}
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {balance.totalCredits.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mb-1">Total Disponível</div>
              <div className="text-xs text-gray-500">
                Para usar agora
              </div>
            </div>

            {/* Assinatura */}
            <div className="text-center">
              <div className="text-2xl font-semibold text-blue-600 mb-2">
                {balance.subscriptionCredits.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mb-1">Da Assinatura</div>
              <div className="text-xs text-gray-500">
                Renova mensalmente
              </div>
            </div>

            {/* Comprados */}
            <div className="text-center">
              <div className="text-2xl font-semibold text-purple-600 mb-2">
                {balance.purchasedCredits.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mb-1">Comprados</div>
              <div className="text-xs text-gray-500">
                Válidos por 12 meses
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes da Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Plano {user.plan}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uso da Assinatura</span>
                <span className="font-medium">
                  {balance.usedCredits} / {balance.creditLimit} créditos
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    subscriptionUsagePercentage >= 90 
                      ? 'bg-red-500' 
                      : subscriptionUsagePercentage >= 70
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(subscriptionUsagePercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <Badge 
                  variant="outline" 
                  className={getUsageColor(subscriptionUsagePercentage)}
                >
                  {subscriptionUsagePercentage}% usado
                </Badge>
                {balance.nextReset && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    Renova em {formatDate(balance.nextReset)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Créditos Comprados */}
      {balance.purchases && balance.purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wallet className="w-5 h-5 mr-2" />
              Créditos Comprados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {balance.purchases.map((purchase) => (
                <div 
                  key={purchase.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    purchase.isExpired 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex items-center">
                    {purchase.isExpired ? (
                      <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mr-3" />
                    )}
                    <div>
                      <div className="font-medium">
                        {purchase.credits.toLocaleString()} créditos
                      </div>
                      <div className={`text-sm ${
                        purchase.isExpired ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {purchase.isExpired 
                          ? `Expirou em ${formatDate(purchase.expiresAt)}`
                          : `Expira em ${formatDate(purchase.expiresAt)}`
                        }
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={purchase.isExpired ? "destructive" : "secondary"}
                  >
                    {purchase.isExpired ? 'Expirado' : 'Ativo'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-sm">
            <Info className="w-4 h-4 mr-2" />
            Como Funcionam os Créditos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>Sistema usa primeiro os créditos da assinatura, depois os comprados</span>
          </div>
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>Créditos da assinatura renovam todo mês</span>
          </div>
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>Créditos comprados são válidos por 12 meses</span>
          </div>
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span>1 crédito = 1 geração de imagem</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}