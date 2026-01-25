'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardData {
  metrics: {
    totalPaying: number
    renewalsToday: number
    totalProblems: number
    criticalAlerts: number
  }
  problems: {
    expiredGracePeriod: number
    badgeMismatch: number
    missingSubscriptionId: number
  }
  renewalsNext7Days: Array<{
    id: string
    name: string
    email: string
    plan: string
    creditsExpiresAt: string
    creditsLimit: number
  }>
  recentRenewals: Array<{
    id: string
    userId: string
    userName: string
    userEmail: string
    plan: string
    amount: number
    description: string
    createdAt: string
  }>
}

export default function CreditsDashboardClient({ initialData }: { initialData: DashboardData | null }) {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(initialData)
  const [loading, setLoading] = useState(false)
  const [executingCron, setExecutingCron] = useState(false)

  const refreshData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/credits/dashboard')
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

  const executeCron = async () => {
    if (!confirm('Executar job de renovação mensal agora?')) return

    setExecutingCron(true)
    try {
      const res = await fetch('/api/admin/credits/cron/execute', { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        alert(`✅ Cron executado!\n\nProcessados: ${result.data.summary.totalProcessed}\nRenovados: ${result.data.summary.renewed}\nSkipped: ${result.data.summary.skipped}`)
        await refreshData()
      } else {
        alert('❌ Erro ao executar cron')
      }
    } catch (error) {
      console.error('Failed to execute cron:', error)
      alert('❌ Erro ao executar cron')
    } finally {
      setExecutingCron(false)
    }
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">💰 Monitoramento de Créditos</h1>
        <div className="text-center py-12">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">💰 Monitoramento de Créditos</h1>
        <button
          onClick={refreshData}
          disabled={loading}
          className="rounded-md bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">👥 Usuários Pagantes</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{data.metrics.totalPaying}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">🔄 Renovando Hoje</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{data.metrics.renewalsToday}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">⚠️ Problemas</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{data.metrics.totalProblems}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">🔔 Alertas Críticos</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{data.metrics.criticalAlerts}</div>
        </div>
      </div>

      {/* Alertas Críticos */}
      {data.metrics.criticalAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-2">🔴 Alertas Críticos</h3>
          <div className="space-y-2">
            {data.problems.expiredGracePeriod > 0 && (
              <div className="text-sm text-red-800">
                • {data.problems.expiredGracePeriod} usuário(s) com renovação atrasada (&gt; 24h)
              </div>
            )}
            {data.problems.missingSubscriptionId > 0 && (
              <div className="text-sm text-red-800">
                • {data.problems.missingSubscriptionId} usuário(s) sem subscriptionId
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renovações Programadas */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">📅 Renovações Programadas (Próximos 7 dias)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Usuário</th>
                <th className="px-4 py-2">Plano</th>
                <th className="px-4 py-2">Créditos</th>
                <th className="px-4 py-2">Expira Em</th>
                <th className="px-4 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.renewalsNext7Days.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma renovação programada para os próximos 7 dias
                  </td>
                </tr>
              ) : (
                data.renewalsNext7Days.map((renewal) => (
                  <tr key={renewal.id} className="border-t border-gray-200">
                    <td className="px-4 py-2">
                      <div className="font-medium">{renewal.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{renewal.email}</div>
                    </td>
                    <td className="px-4 py-2">{renewal.plan}</td>
                    <td className="px-4 py-2">{renewal.creditsLimit} créditos</td>
                    <td className="px-4 py-2">
                      {new Date(renewal.creditsExpiresAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => router.push(`/admin/users/${renewal.id}/credits`)}
                        className="text-purple-600 hover:text-purple-800 text-sm"
                      >
                        Ver Diagnóstico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">🔧 Ações Rápidas</h3>
        <div className="flex gap-2">
          <button
            onClick={executeCron}
            disabled={executingCron}
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {executingCron ? 'Executando...' : 'Executar Cron de Renovação'}
          </button>
          <button
            onClick={() => router.push('/admin/users')}
            className="rounded-md bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-700"
          >
            Ver Todos os Usuários
          </button>
        </div>
      </div>

      {/* Histórico Recente */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">📊 Renovações Recentes (Últimas 24h)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Data/Hora</th>
                <th className="px-4 py-2">Usuário</th>
                <th className="px-4 py-2">Plano</th>
                <th className="px-4 py-2">Créditos</th>
                <th className="px-4 py-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRenewals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma renovação nas últimas 24 horas
                  </td>
                </tr>
              ) : (
                data.recentRenewals.map((renewal) => (
                  <tr key={renewal.id} className="border-t border-gray-200">
                    <td className="px-4 py-2">
                      {new Date(renewal.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{renewal.userName}</div>
                      <div className="text-xs text-gray-500">{renewal.userEmail}</div>
                    </td>
                    <td className="px-4 py-2">{renewal.plan}</td>
                    <td className="px-4 py-2 text-green-600">+{renewal.amount}</td>
                    <td className="px-4 py-2 text-gray-600">{renewal.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
