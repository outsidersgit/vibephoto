'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Smartphone, 
  Copy, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  QrCode,
  AlertCircle,
  Timer,
  Zap
} from 'lucide-react'

interface PixPaymentProps {
  paymentId?: string
  qrCode?: string
  payload?: string
  amount: number
  onPaymentConfirmed?: () => void
  onPaymentExpired?: () => void
  disabled?: boolean
}

export function PixPayment({
  paymentId,
  qrCode,
  payload,
  amount,
  onPaymentConfirmed,
  onPaymentExpired,
  disabled = false
}: PixPaymentProps) {
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'confirmed' | 'expired'>('waiting')
  const [timeRemaining, setTimeRemaining] = useState(15 * 60) // 15 minutes
  const [isPolling, setIsPolling] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      setPaymentStatus('expired')
      onPaymentExpired?.()
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setPaymentStatus('expired')
          onPaymentExpired?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, onPaymentExpired])

  // Poll payment status
  useEffect(() => {
    if (!paymentId || paymentStatus !== 'waiting') return

    const pollPayment = async () => {
      if (isPolling) return
      setIsPolling(true)

      try {
        const response = await fetch(`/api/payments/status?paymentId=${paymentId}`)
        const data = await response.json()

        if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') {
          setPaymentStatus('confirmed')
          onPaymentConfirmed?.()
        }
      } catch (error) {
        console.error('Error polling payment:', error)
      } finally {
        setIsPolling(false)
      }
    }

    // Poll every 5 seconds
    const pollInterval = setInterval(pollPayment, 5000)
    
    // Initial poll
    pollPayment()

    return () => clearInterval(pollInterval)
  }, [paymentId, paymentStatus, onPaymentConfirmed, isPolling])

  const handleCopyPayload = async () => {
    if (!payload) return

    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy payload:', error)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatAmount = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (paymentStatus === 'confirmed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h3 className="text-2xl font-bold text-green-800 mb-2">
              Pagamento Confirmado!
            </h3>
            <p className="text-green-700 mb-4">
              Seu PIX foi processado com sucesso.
            </p>
            <p className="text-sm text-green-600">
              Valor: {formatAmount(amount)}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (paymentStatus === 'expired') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-red-800 mb-2">
              PIX Expirado
            </h3>
            <p className="text-red-700 mb-4">
              O tempo para pagamento via PIX expirou.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700"
            >
              Gerar Novo PIX
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Timer and Status */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-full">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Pagamento via PIX
                </h3>
                <p className="text-sm text-blue-700">
                  Valor: {formatAmount(amount)}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 text-blue-900">
                <Timer className="w-4 h-4" />
                <span className="font-mono text-lg font-semibold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <p className="text-xs text-blue-600">
                Tempo restante
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <QrCode className="w-5 h-5" />
            Escaneie o QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {qrCode ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="p-4 bg-white border-2 border-gray-200 rounded-xl shadow-lg">
                <img 
                  src={`data:image/png;base64,${qrCode}`}
                  alt="PIX QR Code"
                  className="w-64 h-64 mx-auto"
                />
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Aprovação Instantânea
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 max-w-md">
                  Abra o app do seu banco, escaneie o código QR e confirme o pagamento
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Gerando QR Code...</p>
            </div>
          )}

          {/* Polling Status */}
          {isPolling && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando pagamento...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIX Copy and Paste */}
      {payload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-sm">
              Ou copie o código PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs text-gray-600 mb-2">
                Código PIX (Cole no seu app bancário):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white p-2 rounded border font-mono break-all">
                  {payload.substring(0, 50)}...
                </code>
                <Button
                  onClick={handleCopyPayload}
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Como pagar:</strong>
                <ol className="mt-2 space-y-1 text-sm">
                  <li>1. Abra o app do seu banco</li>
                  <li>2. Acesse a área PIX</li>
                  <li>3. Escaneie o QR Code ou cole o código</li>
                  <li>4. Confirme o pagamento</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                O pagamento será confirmado automaticamente após a aprovação
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}