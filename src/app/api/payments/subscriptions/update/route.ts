import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscriptionService, SubscriptionPlan } from '@/lib/services/subscription-service'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { subscriptionId, newPlan } = body

    console.log('📝 Update Subscription Request:', {
      subscriptionId,
      newPlan,
      userId: session.user.id
    })

    if (!subscriptionId || !newPlan) {
      return NextResponse.json(
        { error: 'ID da assinatura e novo plano são obrigatórios' },
        { status: 400 }
      )
    }

    // Get user from database to verify subscription ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        subscriptionId: true, 
        asaasCustomerId: true,
        plan: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verify subscription belongs to user
    if (user.subscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Esta assinatura não pertence ao usuário logado' },
        { status: 403 }
      )
    }

    // Validate new plan
    const subscriptionPlan: SubscriptionPlan = {
      plan: newPlan.plan,
      cycle: newPlan.cycle,
      paymentMethod: newPlan.paymentMethod || 'CREDIT_CARD' // Default for updates
    }

    if (!['STARTER', 'PREMIUM', 'GOLD'].includes(subscriptionPlan.plan)) {
      return NextResponse.json(
        { error: 'Plano inválido' },
        { status: 400 }
      )
    }

    if (!['MONTHLY', 'YEARLY'].includes(subscriptionPlan.cycle)) {
      return NextResponse.json(
        { error: 'Ciclo inválido' },
        { status: 400 }
      )
    }

    // Check if it's actually a change
    if (user.plan === subscriptionPlan.plan) {
      // Maybe just cycle change, allow it
      console.log('Plan unchanged, but cycle might be different')
    }

    // Get current subscription details
    const currentSubscriptionResult = await subscriptionService.getSubscription(subscriptionId)
    
    if (!currentSubscriptionResult.success) {
      return NextResponse.json(
        { error: 'Erro ao buscar assinatura atual' },
        { status: 400 }
      )
    }

    const currentSubscription = currentSubscriptionResult.subscription

    // Calculate proration if needed
    const nextDueDate = new Date(currentSubscription.nextDueDate)
    const now = new Date()
    const daysRemaining = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    let proratedAmount = 0
    if (daysRemaining > 0 && user.plan) {
      proratedAmount = subscriptionService.calculateProratedAmount(
        user.plan as 'STARTER' | 'PREMIUM' | 'GOLD',
        subscriptionPlan.plan,
        subscriptionPlan.cycle,
        daysRemaining
      )
    }

    // Update subscription in Asaas
    const updateResult = await subscriptionService.updateSubscription(
      subscriptionId,
      subscriptionPlan
    )

    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error },
        { status: 400 }
      )
    }

    // Update user plan in database
    // IMPORTANTE: Apenas atualiza o plan, NÃO atualiza creditsLimit
    // Os créditos do plano antigo serão mantidos até o próximo pagamento
    // Quando o próximo pagamento for confirmado via webhook, aí sim o creditsLimit será atualizado
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan: subscriptionPlan.plan,
        billingCycle: subscriptionPlan.cycle,
        subscriptionStatus: updateResult.subscription.status || 'ACTIVE'
        // creditsLimit e creditsUsed permanecem inalterados
        // Isso garante que o usuário continue usando os créditos do plano antigo até o próximo pagamento
      }
    })

    // Create a payment record if there's a prorated amount to charge
    if (proratedAmount > 0) {
      try {
        // This would create an additional payment for the prorated amount
        // Implementation depends on whether you want immediate charge or add to next bill
        console.log(`Prorated amount to charge: R$ ${proratedAmount.toFixed(2)}`)
        
        // Log the plan change
        await prisma.usageLog.create({
          data: {
            userId: session.user.id,
            action: 'PLAN_UPGRADED',
            creditsUsed: 0,
            details: {
              subscriptionId,
              oldPlan: user.plan,
              newPlan: subscriptionPlan.plan,
              proratedAmount,
              daysRemaining,
              updatedAt: new Date().toISOString()
            }
          }
        })
      } catch (prorationError) {
        console.error('Error handling proration:', prorationError)
        // Continue execution - the plan was updated successfully
      }
    } else {
      // Log the plan change
      await prisma.usageLog.create({
        data: {
          userId: session.user.id,
          action: user.plan === subscriptionPlan.plan ? 'PLAN_CYCLE_CHANGED' : 
                  (user.plan && ['PREMIUM', 'GOLD'].includes(subscriptionPlan.plan) && 
                   ['STARTER', 'PREMIUM'].includes(user.plan)) ? 'PLAN_UPGRADED' : 'PLAN_DOWNGRADED',
          creditsUsed: 0,
          details: {
            subscriptionId,
            oldPlan: user.plan,
            newPlan: subscriptionPlan.plan,
            oldCycle: currentSubscription.cycle,
            newCycle: subscriptionPlan.cycle,
            updatedAt: new Date().toISOString()
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Plano atualizado com sucesso',
      subscription: {
        id: updateResult.subscription.id,
        plan: subscriptionPlan.plan,
        cycle: subscriptionPlan.cycle,
        value: updateResult.subscription.value,
        status: updateResult.subscription.status,
        nextDueDate: updateResult.subscription.nextDueDate
      },
      proration: {
        amount: proratedAmount,
        daysRemaining,
        description: proratedAmount > 0 ? 
          `Valor proporcional cobrado pelos ${daysRemaining} dias restantes` :
          'Nenhuma cobrança adicional'
      }
    })

  } catch (error: any) {
    console.error('Subscription update error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET method to preview plan change costs
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
    const subscriptionId = searchParams.get('subscriptionId')
    const newPlan = searchParams.get('newPlan') as 'STARTER' | 'PREMIUM' | 'GOLD'
    const newCycle = searchParams.get('newCycle') as 'MONTHLY' | 'YEARLY'

    if (!subscriptionId || !newPlan || !newCycle) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // Get user current plan
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, subscriptionId: true }
    })

    if (!user || user.subscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada' },
        { status: 404 }
      )
    }

    // Get current subscription
    const subscriptionResult = await subscriptionService.getSubscription(subscriptionId)
    
    if (!subscriptionResult.success) {
      return NextResponse.json(
        { error: 'Erro ao buscar assinatura' },
        { status: 400 }
      )
    }

    const currentSubscription = subscriptionResult.subscription
    const nextDueDate = new Date(currentSubscription.nextDueDate)
    const now = new Date()
    const daysRemaining = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Calculate costs
    const proratedAmount = user.plan ? subscriptionService.calculateProratedAmount(
      user.plan as 'STARTER' | 'PREMIUM' | 'GOLD',
      newPlan,
      newCycle,
      daysRemaining
    ) : 0

    const currentPlanBenefits = subscriptionService.getPlanBenefits(user.plan as 'STARTER' | 'PREMIUM' | 'GOLD')
    const newPlanBenefits = subscriptionService.getPlanBenefits(newPlan)

    return NextResponse.json({
      current: {
        plan: user.plan,
        cycle: currentSubscription.cycle,
        value: currentSubscription.value,
        nextDueDate: nextDueDate.toLocaleDateString('pt-BR'),
        daysRemaining,
        benefits: currentPlanBenefits
      },
      new: {
        plan: newPlan,
        cycle: newCycle,
        benefits: newPlanBenefits
      },
      costs: {
        proratedAmount,
        immediateCharge: proratedAmount > 0,
        nextBillAmount: subscriptionService.getNextBillingDate(newCycle),
        description: proratedAmount > 0 ? 
          `Você pagará R$ ${proratedAmount.toFixed(2)} hoje pelos ${daysRemaining} dias restantes no novo plano` :
          'Não há cobrança adicional. O novo valor será cobrado na próxima fatura.'
      }
    })

  } catch (error: any) {
    console.error('Plan change preview error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}