import { prisma } from '@/lib/db'
import { asaas } from './asaas'

export interface PaymentError {
  code: string
  message: string
  type: 'NETWORK' | 'VALIDATION' | 'PROVIDER' | 'SYSTEM'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  retryable: boolean
  userMessage: string
}

export interface RecoveryAction {
  id: string
  type: 'RETRY' | 'REFUND' | 'CANCEL' | 'MANUAL_REVIEW' | 'CONTACT_SUPPORT'
  description: string
  automated: boolean
  timeoutMinutes?: number
}

export class PaymentErrorHandler {
  
  static getErrorInfo(error: any): PaymentError {
    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Falha de conexão com o provedor de pagamento',
        type: 'NETWORK',
        severity: 'HIGH',
        retryable: true,
        userMessage: 'Problema temporário de conexão. Tentaremos novamente em alguns minutos.'
      }
    }

    // Asaas specific errors
    if (error.response?.data?.errors) {
      const asaasError = error.response.data.errors[0]
      return this.mapAsaasError(asaasError)
    }

    // HTTP status codes
    if (error.response?.status) {
      return this.mapHttpError(error.response.status, error.response.data)
    }

    // Generic errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Erro desconhecido',
      type: 'SYSTEM',
      severity: 'MEDIUM',
      retryable: false,
      userMessage: 'Ocorreu um erro inesperado. Nossa equipe foi notificada.'
    }
  }

  private static mapAsaasError(asaasError: any): PaymentError {
    const errorMap: Record<string, PaymentError> = {
      'invalid_cpfCnpj': {
        code: 'INVALID_DOCUMENT',
        message: 'CPF/CNPJ inválido',
        type: 'VALIDATION',
        severity: 'MEDIUM',
        retryable: false,
        userMessage: 'CPF ou CNPJ informado é inválido. Verifique os dados e tente novamente.'
      },
      'invalid_postalCode': {
        code: 'INVALID_POSTAL_CODE',
        message: 'CEP inválido',
        type: 'VALIDATION',
        severity: 'MEDIUM',
        retryable: false,
        userMessage: 'CEP informado é inválido. Verifique o CEP e tente novamente.'
      },
      'invalid_phone': {
        code: 'INVALID_PHONE',
        message: 'Telefone inválido',
        type: 'VALIDATION',
        severity: 'MEDIUM',
        retryable: false,
        userMessage: 'Número de telefone inválido. Use o formato (11) 99999-9999.'
      },
      'invalid_creditCardNumber': {
        code: 'INVALID_CARD',
        message: 'Número do cartão inválido',
        type: 'VALIDATION',
        severity: 'MEDIUM',
        retryable: false,
        userMessage: 'Número do cartão de crédito inválido. Verifique os dados do cartão.'
      },
      'invalid_creditCardExpiryDate': {
        code: 'INVALID_CARD_EXPIRY',
        message: 'Data de validade do cartão inválida',
        type: 'VALIDATION',
        severity: 'MEDIUM',
        retryable: false,
        userMessage: 'Data de validade do cartão inválida ou expirada.'
      },
      'insufficient_funds': {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Saldo insuficiente',
        type: 'PROVIDER',
        severity: 'HIGH',
        retryable: false,
        userMessage: 'Saldo insuficiente no cartão ou conta. Tente outro método de pagamento.'
      },
      'card_declined': {
        code: 'CARD_DECLINED',
        message: 'Cartão recusado',
        type: 'PROVIDER',
        severity: 'HIGH',
        retryable: false,
        userMessage: 'Pagamento recusado pela operadora do cartão. Entre em contato com seu banco.'
      },
      'pix_expired': {
        code: 'PIX_EXPIRED',
        message: 'PIX expirado',
        type: 'PROVIDER',
        severity: 'MEDIUM',
        retryable: true,
        userMessage: 'O PIX expirou. Você pode gerar um novo código PIX.'
      },
      'duplicate_payment': {
        code: 'DUPLICATE_PAYMENT',
        message: 'Pagamento duplicado',
        type: 'VALIDATION',
        severity: 'LOW',
        retryable: false,
        userMessage: 'Este pagamento já foi processado. Verifique seu extrato.'
      }
    }

    return errorMap[asaasError.code] || {
      code: 'ASAAS_ERROR',
      message: asaasError.description || 'Erro do provedor de pagamento',
      type: 'PROVIDER',
      severity: 'MEDIUM',
      retryable: false,
      userMessage: `Erro do provedor: ${asaasError.description || 'Tente novamente mais tarde'}`
    }
  }

  private static mapHttpError(status: number, data: any): PaymentError {
    switch (status) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: 'Requisição inválida',
          type: 'VALIDATION',
          severity: 'MEDIUM',
          retryable: false,
          userMessage: 'Dados inválidos. Verifique as informações e tente novamente.'
        }
      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
          type: 'SYSTEM',
          severity: 'CRITICAL',
          retryable: false,
          userMessage: 'Erro de autenticação. Nossa equipe foi notificada.'
        }
      case 402:
        return {
          code: 'PAYMENT_REQUIRED',
          message: 'Pagamento necessário',
          type: 'PROVIDER',
          severity: 'HIGH',
          retryable: false,
          userMessage: 'Pagamento necessário para continuar.'
        }
      case 403:
        return {
          code: 'FORBIDDEN',
          message: 'Acesso negado',
          type: 'PROVIDER',
          severity: 'HIGH',
          retryable: false,
          userMessage: 'Acesso negado pelo provedor de pagamento.'
        }
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Recurso não encontrado',
          type: 'PROVIDER',
          severity: 'MEDIUM',
          retryable: true,
          userMessage: 'Recurso não encontrado. Tente novamente.'
        }
      case 429:
        return {
          code: 'RATE_LIMIT',
          message: 'Muitas tentativas',
          type: 'PROVIDER',
          severity: 'MEDIUM',
          retryable: true,
          userMessage: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
        }
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: 'Erro do servidor do provedor',
          type: 'PROVIDER',
          severity: 'HIGH',
          retryable: true,
          userMessage: 'Problema temporário no provedor de pagamento. Tentaremos novamente.'
        }
      default:
        return {
          code: 'HTTP_ERROR',
          message: `HTTP ${status}`,
          type: 'PROVIDER',
          severity: 'MEDIUM',
          retryable: status >= 500,
          userMessage: 'Erro de comunicação com o provedor de pagamento.'
        }
    }
  }

  static getRecoveryActions(error: PaymentError, context: any = {}): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    switch (error.code) {
      case 'NETWORK_ERROR':
      case 'SERVER_ERROR':
      case 'RATE_LIMIT':
        actions.push({
          id: 'auto_retry',
          type: 'RETRY',
          description: 'Tentar novamente automaticamente',
          automated: true,
          timeoutMinutes: 5
        })
        break

      case 'PIX_EXPIRED':
        actions.push({
          id: 'generate_new_pix',
          type: 'RETRY',
          description: 'Gerar novo código PIX',
          automated: false
        })
        break

      case 'CARD_DECLINED':
      case 'INSUFFICIENT_FUNDS':
        actions.push({
          id: 'try_different_method',
          type: 'RETRY',
          description: 'Tentar com método de pagamento diferente',
          automated: false
        })
        break

      case 'INVALID_DOCUMENT':
      case 'INVALID_POSTAL_CODE':
      case 'INVALID_PHONE':
      case 'INVALID_CARD':
      case 'INVALID_CARD_EXPIRY':
        actions.push({
          id: 'correct_data',
          type: 'RETRY',
          description: 'Corrigir dados e tentar novamente',
          automated: false
        })
        break

      case 'DUPLICATE_PAYMENT':
        actions.push({
          id: 'check_existing',
          type: 'MANUAL_REVIEW',
          description: 'Verificar pagamento existente',
          automated: false
        })
        break

      default:
        if (error.severity === 'CRITICAL') {
          actions.push({
            id: 'contact_support',
            type: 'CONTACT_SUPPORT',
            description: 'Entrar em contato com o suporte',
            automated: false
          })
        } else if (error.retryable) {
          actions.push({
            id: 'manual_retry',
            type: 'RETRY',
            description: 'Tentar novamente',
            automated: false
          })
        }
        break
    }

    return actions
  }

  static async logError(error: PaymentError, context: any = {}) {
    try {
      await prisma.systemLog.create({
        data: {
          level: this.getSeverityLogLevel(error.severity),
          category: 'payment_error',
          message: error.message,
          userId: context.userId,
          metadata: {
            errorCode: error.code,
            errorType: error.type,
            severity: error.severity,
            retryable: error.retryable,
            context,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (logError) {
      console.error('Failed to log payment error:', logError)
    }
  }

  private static getSeverityLogLevel(severity: PaymentError['severity']): string {
    const map = {
      'LOW': 'INFO',
      'MEDIUM': 'WARN',
      'HIGH': 'ERROR',
      'CRITICAL': 'FATAL'
    }
    return map[severity]
  }
}

export class PaymentRecoveryService {
  
  async processFailedPayments() {
    console.log('Starting failed payments recovery process...')

    // Get failed payments from last 24 hours
    const failedPayments = await prisma.payment.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        // Don't retry more than 3 times
        retryCount: { lt: 3 }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            asaasCustomerId: true
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    })

    let recoveredCount = 0

    for (const payment of failedPayments) {
      try {
        const recovered = await this.attemptPaymentRecovery(payment)
        if (recovered) {
          recoveredCount++
        }
      } catch (error) {
        console.error(`Failed to recover payment ${payment.id}:`, error)
      }

      // Wait 2 seconds between attempts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log(`Payment recovery completed: ${recoveredCount}/${failedPayments.length} recovered`)
    return { processed: failedPayments.length, recovered: recoveredCount }
  }

  private async attemptPaymentRecovery(payment: any): Promise<boolean> {
    try {
      // Check current status in Asaas
      const asaasPayment = await asaas.getPayment(payment.asaasPaymentId)
      
      // Update retry count
      await prisma.payment.update({
        where: { id: payment.id },
        data: { retryCount: { increment: 1 } }
      })

      switch (asaasPayment.status) {
        case 'CONFIRMED':
          // Payment was actually successful, update our records
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'CONFIRMED',
              confirmedDate: new Date(asaasPayment.confirmedDate)
            }
          })

          // Process the successful payment (add credits, activate subscription, etc.)
          await this.processSuccessfulPayment(payment, asaasPayment)
          
          console.log(`Payment ${payment.id} was actually successful, updated status`)
          return true

        case 'PENDING':
          // Still pending, update status
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'PENDING' }
          })
          
          console.log(`Payment ${payment.id} still pending`)
          return false

        case 'OVERDUE':
          // Try to create a new payment with same details
          return await this.createRetryPayment(payment)

        default:
          console.log(`Payment ${payment.id} still failed with status: ${asaasPayment.status}`)
          return false
      }

    } catch (error: any) {
      console.error(`Error recovering payment ${payment.id}:`, error)
      
      // Log recovery attempt
      await PaymentErrorHandler.logError(
        PaymentErrorHandler.getErrorInfo(error),
        {
          paymentId: payment.id,
          userId: payment.userId,
          recoveryAttempt: true
        }
      )
      
      return false
    }
  }

  private async processSuccessfulPayment(payment: any, asaasPayment: any) {
    try {
      if (payment.type === 'SUBSCRIPTION') {
        // CRÍTICO: Usar updateSubscriptionStatus para garantir que creditsLimit seja atualizado
        const { updateSubscriptionStatus } = await import('@/lib/db/subscriptions')
        const plan = this.getPlanFromPayment(payment) as any
        
        // Buscar billingCycle do Payment se disponível
        const billingCycle = payment.billingCycle || undefined
        
        await updateSubscriptionStatus(
          payment.userId,
          'ACTIVE',
          asaasPayment.dueDate ? new Date(asaasPayment.dueDate) : undefined,
          plan,
          billingCycle
        )

        // CRÍTICO: Broadcast atualização para frontend
        const updatedUser = await prisma.user.findUnique({
          where: { id: payment.userId },
          select: {
            creditsUsed: true,
            creditsLimit: true,
            creditsBalance: true,
            subscriptionStatus: true,
            plan: true
          }
        })

        if (updatedUser) {
          const { broadcastCreditsUpdate, broadcastUserUpdate } = await import('@/lib/services/realtime-service')
          await broadcastCreditsUpdate(
            payment.userId,
            updatedUser.creditsUsed,
            updatedUser.creditsLimit,
            'PAYMENT_RECOVERED',
            updatedUser.creditsBalance
          ).catch(console.error)
          
          await broadcastUserUpdate(
            payment.userId,
            {
              plan: updatedUser.plan,
              subscriptionStatus: updatedUser.subscriptionStatus,
              creditsLimit: updatedUser.creditsLimit,
              creditsUsed: updatedUser.creditsUsed,
              creditsBalance: updatedUser.creditsBalance
            },
            'PAYMENT_RECOVERED'
          ).catch(console.error)
        }
      } else if (payment.type === 'CREDIT_PURCHASE' && payment.creditAmount) {
        // Add credits
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            creditsBalance: { increment: payment.creditAmount }
          }
        })

        // Update credit purchase
        await prisma.creditPurchase.update({
          where: { asaasPaymentId: payment.asaasPaymentId },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(asaasPayment.confirmedDate)
          }
        })
      }

      // Log successful recovery
      await prisma.usageLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_RECOVERED',
          creditsUsed: 0,
          details: {
            paymentId: payment.id,
            asaasPaymentId: payment.asaasPaymentId,
            type: payment.type,
            value: payment.value,
            recoveredAt: new Date().toISOString()
          }
        }
      })

    } catch (error) {
      console.error('Error processing recovered payment:', error)
    }
  }

  private async createRetryPayment(originalPayment: any): Promise<boolean> {
    try {
      // This would require implementing a retry payment creation
      // For now, just log that a retry is needed
      console.log(`Payment ${originalPayment.id} needs manual retry`)
      
      await prisma.systemLog.create({
        data: {
          level: 'WARN',
          category: 'payment_recovery',
          message: 'Payment needs manual retry',
          userId: originalPayment.userId,
          metadata: {
            originalPaymentId: originalPayment.id,
            asaasPaymentId: originalPayment.asaasPaymentId,
            needsManualReview: true
          }
        }
      })

      return false
    } catch (error) {
      console.error('Error creating retry payment:', error)
      return false
    }
  }

  private getPlanFromPayment(payment: any): string {
    // Extract plan from payment description or external reference
    if (payment.description?.includes('PREMIUM')) return 'PREMIUM'
    if (payment.description?.includes('GOLD')) return 'GOLD'
    return 'STARTER'
  }

  async getPaymentHealthMetrics() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const metrics = await Promise.all([
      // Success rate last 24h
      prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: last24h } },
        _count: { status: true }
      }),
      
      // Success rate last 7d
      prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: last7d } },
        _count: { status: true }
      }),

      // Failed payments by error type
      prisma.systemLog.groupBy({
        by: ['metadata'],
        where: {
          category: 'payment_error',
          createdAt: { gte: last7d }
        },
        _count: true
      }),

      // Recovery success rate
      prisma.usageLog.count({
        where: {
          action: 'PAYMENT_RECOVERED',
          createdAt: { gte: last7d }
        }
      })
    ])

    const [status24h, status7d, errorTypes, recoveredCount] = metrics

    const calculate24hRate = () => {
      const total = status24h.reduce((sum, s) => sum + s._count.status, 0)
      const confirmed = status24h.find(s => s.status === 'CONFIRMED')?._count.status || 0
      return total > 0 ? Math.round((confirmed / total) * 100) : 0
    }

    const calculate7dRate = () => {
      const total = status7d.reduce((sum, s) => sum + s._count.status, 0)
      const confirmed = status7d.find(s => s.status === 'CONFIRMED')?._count.status || 0
      return total > 0 ? Math.round((confirmed / total) * 100) : 0
    }

    return {
      successRate24h: calculate24hRate(),
      successRate7d: calculate7dRate(),
      totalPayments24h: status24h.reduce((sum, s) => sum + s._count.status, 0),
      totalPayments7d: status7d.reduce((sum, s) => sum + s._count.status, 0),
      recoveredPayments7d: recoveredCount,
      commonErrors: errorTypes.slice(0, 5),
      timestamp: new Date().toISOString()
    }
  }
}

// Utility function to handle payment errors in API routes
export async function handlePaymentError(error: any, context: any = {}) {
  const errorInfo = PaymentErrorHandler.getErrorInfo(error)
  const recoveryActions = PaymentErrorHandler.getRecoveryActions(errorInfo, context)
  
  // Log the error
  await PaymentErrorHandler.logError(errorInfo, context)
  
  return {
    error: {
      code: errorInfo.code,
      message: errorInfo.userMessage,
      type: errorInfo.type,
      severity: errorInfo.severity,
      retryable: errorInfo.retryable
    },
    recoveryActions: recoveryActions.map(action => ({
      type: action.type,
      description: action.description,
      automated: action.automated
    }))
  }
}

export const paymentRecoveryService = new PaymentRecoveryService()