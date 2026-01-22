'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminToolsPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  async function handleSyncSubscriptions() {
    if (!confirm('Sincronizar nextDueDate de todas as assinaturas ativas com o Asaas?')) return

    setSyncing(true)
    setSyncError(null)
    setSyncResult(null)

    try {
      const res = await fetch('/api/admin/sync-subscriptions', {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao sincronizar')
      }

      setSyncResult(data.results)
    } catch (error: any) {
      setSyncError(error.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleVerifyPayments() {
    if (!confirm('Verificar inconsistências entre pagamentos e status de assinatura?')) return

    setVerifying(true)
    setVerifyError(null)
    setVerifyResult(null)

    try {
      const res = await fetch('/api/cron/verify-payment-inconsistencies')

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao verificar')
      }

      setVerifyResult(data.results)
    } catch (error: any) {
      setVerifyError(error.message)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ferramentas Administrativas</h1>
        <p className="text-sm text-gray-600 mt-1">Ferramentas para manutenção e correção do sistema</p>
      </div>

      <div className="grid gap-6">
        {/* Sync Next Due Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Sincronizar Data de Próxima Cobrança</CardTitle>
            <CardDescription>
              Corrige usuários com assinatura ACTIVE que não têm `nextDueDate` ou `subscriptionEndsAt` definidos.
              Busca a data real no Asaas e atualiza o banco de dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              <p className="mb-2"><strong>O que faz:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Busca usuários com `subscriptionStatus = ACTIVE` mas sem `nextDueDate`</li>
                <li>Consulta a assinatura no Asaas para pegar a data real da próxima cobrança</li>
                <li>Atualiza `nextDueDate` e `subscriptionEndsAt` no banco de dados</li>
                <li>Se Asaas não retornar data, calcula baseado em `subscriptionStartedAt` + ciclo</li>
              </ul>
            </div>

            {syncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                ❌ Erro: {syncError}
              </div>
            )}

            {syncResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                <p className="font-semibold mb-2">✅ Sincronização concluída!</p>
                <ul className="space-y-1">
                  <li>Usuários verificados: {syncResult.users_checked}</li>
                  <li>Usuários atualizados: {syncResult.users_updated}</li>
                  <li>Erros: {syncResult.errors}</li>
                </ul>
              </div>
            )}

            <Button
              onClick={handleSyncSubscriptions}
              disabled={syncing}
              className="w-full sm:w-auto"
            >
              {syncing ? 'Sincronizando...' : '🔄 Sincronizar Agora'}
            </Button>
          </CardContent>
        </Card>

        {/* Verify Payment Inconsistencies */}
        <Card>
          <CardHeader>
            <CardTitle>Verificar Inconsistências de Pagamentos</CardTitle>
            <CardDescription>
              Detecta e corrige problemas entre status de pagamentos e assinaturas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              <p className="mb-2"><strong>O que verifica:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Usuários ACTIVE mas com último pagamento OVERDUE</li>
                <li>Pagamentos PENDING que já passaram da data de vencimento</li>
                <li>Usuários ACTIVE sem cobranças registradas no banco</li>
              </ul>
            </div>

            {verifyError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                ❌ Erro: {verifyError}
              </div>
            )}

            {verifyResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                <p className="font-semibold mb-2">✅ Verificação concluída!</p>
                <ul className="space-y-1">
                  <li>Usuários ACTIVE com pagamentos OVERDUE corrigidos: {verifyResult.active_users_with_overdue}</li>
                  <li>Pagamentos PENDING marcados como OVERDUE: {verifyResult.pending_payments_now_overdue}</li>
                  <li>Usuários ACTIVE sem pagamentos registrados: {verifyResult.active_users_without_payments}</li>
                  <li>Erros: {verifyResult.errors}</li>
                </ul>
              </div>
            )}

            <Button
              onClick={handleVerifyPayments}
              disabled={verifying}
              className="w-full sm:w-auto"
            >
              {verifying ? 'Verificando...' : '🔍 Verificar Agora'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
