import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentRecoveryService, PaymentErrorHandler, handlePaymentError } from '@/lib/payments/error-recovery'
import { prisma } from '@/lib/db'

// POST method to manually trigger payment recovery
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication (you should implement proper admin auth)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, paymentId, userId } = body

    switch (action) {
      case 'recover_failed_payments':
        const result = await paymentRecoveryService.processFailedPayments()
        return NextResponse.json({
          success: true,
          message: `Processados ${result.processed} pagamentos, ${result.recovered} recuperados`,
          result
        })

      case 'retry_payment':
        if (!paymentId) {
          return NextResponse.json(
            { error: 'Payment ID é obrigatório' },
            { status: 400 }
          )
        }

        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
          include: { user: true }
        })

        if (!payment) {
          return NextResponse.json(
            { error: 'Pagamento não encontrado' },
            { status: 404 }
          )
        }

        // Attempt manual recovery for specific payment
        const recovered = await paymentRecoveryService['attemptPaymentRecovery'](payment)
        
        return NextResponse.json({
          success: true,
          recovered,
          message: recovered 
            ? 'Pagamento recuperado com sucesso' 
            : 'Não foi possível recuperar o pagamento automaticamente'
        })

      case 'get_health_metrics':
        const metrics = await paymentRecoveryService.getPaymentHealthMetrics()
        return NextResponse.json({
          success: true,
          metrics
        })

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Payment recovery error:', error)
    
    const errorInfo = await handlePaymentError(error, {
      userId: request.body?.userId,
      action: 'payment_recovery'
    })
    
    return NextResponse.json(errorInfo, { status: 500 })
  }
}

// GET method to get recovery status and metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const paymentId = searchParams.get('paymentId')
    const userId = searchParams.get('userId')

    switch (action) {
      case 'health_metrics':
        const metrics = await paymentRecoveryService.getPaymentHealthMetrics()
        return NextResponse.json(metrics)

      case 'failed_payments':
        // Get failed payments that need attention
        const failedPayments = await prisma.payment.findMany({
          where: {
            status: 'FAILED',
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })

        return NextResponse.json({
          failedPayments: failedPayments.map(payment => ({
            id: payment.id,
            asaasPaymentId: payment.asaasPaymentId,
            type: payment.type,
            status: payment.status,
            value: payment.value,
            description: payment.description,
            createdAt: payment.createdAt,
            retryCount: payment.retryCount || 0,
            user: payment.user
          })),
          total: failedPayments.length
        })

      case 'error_logs':
        // Get recent payment error logs
        const errorLogs = await prisma.systemLog.findMany({
          where: {
            category: 'payment_error',
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        })

        return NextResponse.json({
          errorLogs: errorLogs.map(log => ({
            id: log.id,
            level: log.level,
            message: log.message,
            createdAt: log.createdAt,
            metadata: log.metadata,
            userId: log.userId
          })),
          total: errorLogs.length
        })

      case 'recovery_stats':
        // Get recovery statistics
        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        
        const [totalFailed, totalRecovered, recentErrors] = await Promise.all([
          prisma.payment.count({
            where: {
              status: 'FAILED',
              createdAt: { gte: last7Days }
            }
          }),
          
          prisma.usageLog.count({
            where: {
              action: 'PAYMENT_RECOVERED',
              createdAt: { gte: last7Days }
            }
          }),

          prisma.systemLog.groupBy({
            by: ['level'],
            where: {
              category: 'payment_error',
              createdAt: { gte: last7Days }
            },
            _count: { level: true }
          })
        ])

        return NextResponse.json({
          stats: {
            totalFailedPayments: totalFailed,
            totalRecoveredPayments: totalRecovered,
            recoveryRate: totalFailed > 0 ? Math.round((totalRecovered / totalFailed) * 100) : 0,
            errorsByLevel: recentErrors.reduce((acc, error) => {
              acc[error.level] = error._count.level
              return acc
            }, {} as Record<string, number>)
          },
          period: '7 days'
        })

      default:
        return NextResponse.json(
          { error: 'Ação não especificada' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Get recovery data error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PATCH method to update payment status manually
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { paymentId, newStatus, reason } = body

    if (!paymentId || !newStatus) {
      return NextResponse.json(
        { error: 'Payment ID e novo status são obrigatórios' },
        { status: 400 }
      )
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      )
    }

    // Get current payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        ...(newStatus === 'CONFIRMED' && {
          confirmedDate: new Date()
        })
      }
    })

    // Log the manual status update
    await prisma.usageLog.create({
      data: {
        userId: payment.userId,
        action: 'PAYMENT_STATUS_UPDATED_MANUALLY',
        creditsUsed: 0,
        details: {
          paymentId,
          oldStatus: payment.status,
          newStatus,
          reason: reason || 'Manual update',
          updatedBy: session.user.id,
          updatedAt: new Date().toISOString()
        }
      }
    })

    // If confirmed, process the payment benefits
    if (newStatus === 'CONFIRMED' && payment.status !== 'CONFIRMED') {
      if (payment.type === 'CREDIT_PURCHASE' && payment.creditAmount) {
        // Add credits
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            creditsBalance: { increment: payment.creditAmount }
          }
        })

        // Update credit purchase record
        await prisma.creditPurchase.update({
          where: { asaasPaymentId: payment.asaasPaymentId },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date()
          }
        }).catch(() => {}) // Ignore if not found
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Status do pagamento atualizado com sucesso',
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        confirmedDate: updatedPayment.confirmedDate
      }
    })

  } catch (error: any) {
    console.error('Update payment status error:', error)
    
    const errorInfo = await handlePaymentError(error, {
      paymentId: request.body?.paymentId,
      action: 'manual_status_update'
    })
    
    return NextResponse.json(errorInfo, { status: 500 })
  }
}