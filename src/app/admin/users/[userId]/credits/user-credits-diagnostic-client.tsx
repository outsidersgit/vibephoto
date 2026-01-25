'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DiagnosticData {
  user: {
    id: string
    name: string | null
    email: string
    plan: string | null
    billingCycle: string | null
    subscriptionStatus: string | null
    subscriptionId: string | null
    asaasCustomerId: string | null
  }
  credits: {
    subscription: {
      limit: number
      used: number
      available: number
      percentage: number
    }
    purchased: {
      balance: number
      purchases: Array<{
        id: string
        packageName: string
        creditAmount: number
        usedCredits: number
        value: number
        status: string
        validUntil: string
        isExpired: boolean
        createdAt: string
      }>
    }
    total: {
      available: number
    }
  }
  cycle: {
    startedAt: string | null
    expiresAt: string | null
    lastRenewalAt: string | null
    nextDueDate: string | null
    endsAt: string | null
    cancelledAt: string | null
    status: string
    message: string
  }
  transactions: Array<{
    id: string
    type: string
    source: string
    amount: number
    description: string | null
    balanceAfter: number
    createdAt: string
  }>
  issues: {
    hasExpired: boolean
    inGracePeriod: boolean
    missingSubscriptionId: boolean
    needsRenewal: boolean
  }
}

export default function UserCreditsDiagnosticClient({
  userId,
  initialData
}: {
  userId: string
  initialData: DiagnosticData | null
}) {
  const router = useRouter()
  const [data, setData] = useState<DiagnosticData | null>(initialData)
  const [loading, setLoading] = useState(false)
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showRenewModal, setShowRenewModal] = useState(false)

  const refreshData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/credits/users/${userId}/diagnostic`)
      if (res.ok) {
        const result = await res.json()
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReconcile = async () => {
    try {
      const res = await fetch(`/api/admin/credits/users/${userId}/reconcile`, { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        alert('✅ Badge reconciliado com sucesso!')
        await refreshData()
      } else {
        alert('❌ Erro ao reconciliar badge')
      }
    } catch (error) {
      alert('❌ Erro ao reconciliar badge')
    }
    setShowReconcileModal(false)
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/users" className="text-purple-600 hover:text-purple-800">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Diagnóstico de Créditos</h1>
        </div>
        <div className="text-center py-12">Carregando...</div>
      </div>
    )
  }

  const getCycleStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600'
      case 'GRACE_PERIOD': return 'text-yellow-600'
      case 'EXPIRED': return 'text-red-600'
      case 'EXPIRING_SOON': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const getCycleStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '🟢'
      case 'GRACE_PERIOD': return '⏳'
      case 'EXPIRED': return '❌'
      case 'EXPIRING_SOON': return '⚠️'
      default: return '⚪'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users" className="text-purple-600 hover:text-purple-800">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            💰 Diagnóstico de Créditos - {data.user.name || data.user.email}
          </h1>
        </div>
        <button
          onClick={refreshData}
          disabled={loading}
          className="rounded-md bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Alertas de Problemas */}
      {Object.values(data.issues).some(v => v) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Problemas Detectados</h3>
          <div className="space-y-1 text-sm text-yellow-800">
            {data.issues.hasExpired && <div>• Créditos expiraram</div>}
            {data.issues.inGracePeriod && <div>• Em grace period (24h)</div>}
            {data.issues.missingSubscriptionId && <div>• Sem subscriptionId (não pode renovar via cron)</div>}
            {data.issues.needsRenewal && <div>• Precisa renovar</div>}
          </div>
        </div>
      )}

      {/* Info do Usuário */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">👤 Informações do Usuário</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Nome:</div>
            <div className="font-medium">{data.user.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">Email:</div>
            <div className="font-medium">{data.user.email}</div>
          </div>
          <div>
            <div className="text-gray-500">Plano:</div>
            <div className="font-medium">{data.user.plan || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">Ciclo:</div>
            <div className="font-medium">{data.user.billingCycle || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">Status:</div>
            <div className="font-medium">{data.user.subscriptionStatus || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">ID Asaas:</div>
            <div className="font-medium text-xs">{data.user.asaasCustomerId || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Saldo de Créditos */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">💰 Saldo de Créditos</h3>
        <div className="space-y-4">
          {/* Créditos da Assinatura */}
          <div className="border-l-4 border-purple-500 pl-4">
            <div className="text-sm text-gray-500 mb-1">Créditos da Assinatura</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-purple-600">
                {data.credits.subscription.available}
              </div>
              <div className="text-gray-500">
                / {data.credits.subscription.limit} ({data.credits.subscription.percentage}% usado)
              </div>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${data.credits.subscription.percentage}%` }}
              />
            </div>
          </div>

          {/* Créditos Comprados */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="text-sm text-gray-500 mb-1">Créditos Comprados</div>
            <div className="text-2xl font-bold text-green-600">
              {data.credits.purchased.balance}
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="text-sm text-gray-500 mb-1">Total Disponível</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.credits.total.available} créditos
            </div>
          </div>
        </div>
      </div>

      {/* Ciclo de Renovação */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">🔄 Ciclo de Renovação</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Status do Ciclo:</span>
            <span className={`font-semibold ${getCycleStatusColor(data.cycle.status)}`}>
              {getCycleStatusIcon(data.cycle.status)} {data.cycle.message}
            </span>
          </div>
          {data.cycle.startedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Iniciou em:</span>
              <span className="font-medium">{new Date(data.cycle.startedAt).toLocaleString('pt-BR')}</span>
            </div>
          )}
          {data.cycle.lastRenewalAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Última Renovação:</span>
              <span className="font-medium">{new Date(data.cycle.lastRenewalAt).toLocaleString('pt-BR')}</span>
            </div>
          )}
          {data.cycle.expiresAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Expira em:</span>
              <span className="font-medium">{new Date(data.cycle.expiresAt).toLocaleString('pt-BR')}</span>
            </div>
          )}
          {data.cycle.nextDueDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Próxima Cobrança:</span>
              <span className="font-medium">{new Date(data.cycle.nextDueDate).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compras de Créditos */}
      {data.credits.purchased.purchases.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">📦 Compras de Créditos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2">Pacote</th>
                  <th className="px-4 py-2">Créditos</th>
                  <th className="px-4 py-2">Usados</th>
                  <th className="px-4 py-2">Restantes</th>
                  <th className="px-4 py-2">Válido Até</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.credits.purchased.purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 font-medium">{purchase.packageName}</td>
                    <td className="px-4 py-2">{purchase.creditAmount}</td>
                    <td className="px-4 py-2">{purchase.usedCredits}</td>
                    <td className="px-4 py-2 text-green-600 font-medium">
                      {purchase.creditAmount - purchase.usedCredits}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(purchase.validUntil).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        purchase.isExpired 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {purchase.isExpired ? 'Expirado' : 'Ativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Últimas Transações */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">📜 Últimas Transações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Data/Hora</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Origem</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma transação encontrada
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-gray-200">
                    <td className="px-4 py-2">
                      {new Date(tx.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        tx.type === 'EARNED' || tx.type === 'RENEWED'
                          ? 'bg-green-100 text-green-800'
                          : tx.type === 'SPENT'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{tx.source}</td>
                    <td className={`px-4 py-2 font-medium ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{tx.description || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ferramentas de Correção */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">🔧 Ferramentas de Correção</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowReconcileModal(true)}
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
          >
            Reconciliar Badge
          </button>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="rounded-md bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700"
          >
            Ajustar Créditos
          </button>
          <button
            onClick={() => setShowRenewModal(true)}
            className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700"
          >
            Renovar Manual
          </button>
          <button
            onClick={() => fetch(`/api/credits/invalidate-cache`, { method: 'POST' })}
            className="rounded-md bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-700"
          >
            Invalidar Cache
          </button>
        </div>
      </div>

      {/* Modal Reconciliar */}
      {showReconcileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reconciliar Badge</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta ação irá invalidar o cache e notificar o frontend para atualizar o badge de créditos.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowReconcileModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleReconcile}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Ajuste e Renovação serão implementados separadamente */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Ajustar Créditos</h3>
            <p className="text-sm text-gray-600 mb-4">
              Funcionalidade em desenvolvimento. Use a API diretamente por enquanto.
            </p>
            <button
              onClick={() => setShowAdjustModal(false)}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showRenewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Renovar Manual</h3>
            <p className="text-sm text-gray-600 mb-4">
              Funcionalidade em desenvolvimento. Use a API diretamente por enquanto.
            </p>
            <button
              onClick={() => setShowRenewModal(false)}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
