'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function AsaasSetupPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMigrate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/asaas/customers/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult(data)
      } else {
        setError(data.error || data.message || 'Erro ao configurar conta')
      }
    } catch (err: any) {
      setError('Erro de conexão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuração de Pagamentos</h1>
        <p className="text-muted-foreground mt-2">
          Configure sua conta para realizar compras e assinaturas
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Vincular Conta Asaas</h2>
          <p className="text-sm text-muted-foreground">
            Para realizar compras de créditos ou assinar um plano, você precisa ter
            uma conta vinculada ao sistema de pagamentos Asaas.
          </p>
        </div>

        {!result && !error && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dados necessários:</strong> Nome completo e CPF/CNPJ.
                Certifique-se de que seu perfil está completo antes de continuar.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleMigrate}
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
                'Configurar Conta de Pagamentos'
              )}
            </Button>
          </div>
        )}

        {result && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-800">{result.message}</p>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Customer ID:</strong> {result.customerId}</p>
                  <p><strong>Método:</strong> {result.method}</p>
                  {result.customer && (
                    <>
                      <p><strong>Nome:</strong> {result.customer.name}</p>
                      <p><strong>Email:</strong> {result.customer.email}</p>
                    </>
                  )}
                </div>
                <p className="text-sm mt-4">
                  ✅ Agora você pode realizar compras e assinaturas!
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">{error}</p>
                {error.includes('incompletos') && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/settings/account'}
                    className="mt-2"
                  >
                    Completar Cadastro
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    setResult(null)
                  }}
                  className="mt-2 ml-2"
                >
                  Tentar Novamente
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="p-6 space-y-4 bg-muted/50">
        <h3 className="font-semibold">Como funciona?</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>O sistema verifica se você já tem uma conta Asaas vinculada</li>
          <li>Se não tiver, busca por email ou CPF cadastrados anteriormente</li>
          <li>Se encontrar, vincula automaticamente</li>
          <li>Se não encontrar, cria uma nova conta para você</li>
          <li>Após isso, você pode comprar créditos ou assinar planos</li>
        </ol>
      </Card>

      {session?.user && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-2">Seus Dados</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p><strong>Nome:</strong> {session.user.name || 'Não informado'}</p>
            <p><strong>Email:</strong> {session.user.email}</p>
          </div>
        </Card>
      )}
    </div>
  )
}