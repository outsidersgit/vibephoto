'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function QuickSetupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const CPF = '02261410123' // Seu CPF

  const handleQuickSetup = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('🚀 Iniciando quick setup com CPF:', CPF)

      const response = await fetch('/api/asaas/customers/quick-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cpfCnpj: CPF
        })
      })

      const data = await response.json()
      console.log('📦 Resposta:', data)

      if (response.ok && data.success) {
        setResult(data)
      } else {
        setError(data.error || data.message || 'Erro ao configurar conta')
        console.error('❌ Erro:', data)
      }
    } catch (err: any) {
      setError('Erro de conexão: ' + err.message)
      console.error('❌ Erro de conexão:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⚡ Setup Rápido - Asaas</h1>
        <p className="text-muted-foreground mt-2">
          Configure sua conta de pagamentos com 1 clique
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Configuração Automática</h2>
          <p className="text-sm text-muted-foreground">
            Este processo vai:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Adicionar seu CPF ao banco de dados</li>
            <li>Buscar se você já tem conta no Asaas</li>
            <li>Criar nova conta se necessário</li>
            <li>Vincular tudo automaticamente</li>
          </ul>
        </div>

        {!result && !error && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-mono">
                <strong>CPF a ser cadastrado:</strong> {CPF}
              </p>
            </div>

            <Button
              onClick={handleQuickSetup}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                '⚡ Configurar Agora'
              )}
            </Button>
          </div>
        )}

        {result && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-bold text-green-800 text-lg">{result.message}</p>

                <div className="bg-white p-3 rounded border border-green-200">
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>✅ Customer ID:</strong> <code className="font-mono bg-green-100 px-2 py-0.5 rounded">{result.customerId}</code></p>
                    <p><strong>📝 Método:</strong> {result.method === 'CREATED_NEW' ? 'Conta criada' : 'Conta existente vinculada'}</p>
                    {result.customer && (
                      <>
                        <hr className="my-2" />
                        <p><strong>👤 Nome:</strong> {result.customer.name}</p>
                        <p><strong>📧 Email:</strong> {result.customer.email}</p>
                        {result.customer.cpfCnpj && (
                          <p><strong>🆔 CPF:</strong> {result.customer.cpfCnpj}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-green-100 p-3 rounded">
                  <p className="text-sm font-semibold text-green-800">
                    🎉 Pronto! Agora você pode:
                  </p>
                  <ul className="text-sm text-green-700 list-disc list-inside mt-2 space-y-1">
                    <li>Comprar créditos</li>
                    <li>Assinar planos premium</li>
                    <li>Realizar pagamentos via PIX, Cartão ou Boleto</li>
                  </ul>
                </div>

                <Button
                  onClick={() => window.location.href = '/pricing'}
                  className="w-full"
                >
                  Ver Planos Disponíveis
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Erro ao configurar:</p>
                <p className="text-sm">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    setResult(null)
                  }}
                  className="mt-2"
                >
                  Tentar Novamente
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="p-4 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <strong>Nota técnica:</strong> Este é um endpoint temporário criado para resolver
          o problema de usuários que já tinham plano mas não tinham asaasCustomerId.
          Depois que configurar, você não precisará usar isso novamente.
        </p>
      </Card>
    </div>
  )
}