'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminToolsPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

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

        {/* Placeholder para outras ferramentas futuras */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Outras Ferramentas</CardTitle>
            <CardDescription>
              Mais ferramentas administrativas serão adicionadas aqui conforme necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Em breve...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
