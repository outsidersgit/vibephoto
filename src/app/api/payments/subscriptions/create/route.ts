import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscriptionService, SubscriptionPlan, CustomerData, CreditCardData } from '@/lib/services/subscription-service'
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
    const { plan, customer, creditCard } = body

    // Validate required fields
    if (!plan || !customer) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // Validate plan structure
    const subscriptionPlan: SubscriptionPlan = {
      plan: plan.plan,
      cycle: plan.cycle,
      paymentMethod: plan.paymentMethod
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

    if (!['PIX', 'CREDIT_CARD', 'BOLETO'].includes(subscriptionPlan.paymentMethod)) {
      return NextResponse.json(
        { error: 'Método de pagamento inválido' },
        { status: 400 }
      )
    }

    // Validate customer data
    const customerData: CustomerData = {
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj,
      phone: customer.phone,
      mobilePhone: customer.mobilePhone,
      address: customer.address,
      addressNumber: customer.addressNumber,
      complement: customer.complement,
      province: customer.province,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode
    }

    // Buscar usuário para verificar se já tem asaasCustomerId
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { asaasCustomerId: true }
    })

    // Validar que usuário tem asaasCustomerId
    if (!user?.asaasCustomerId) {
      return NextResponse.json({
        error: 'Complete seu cadastro antes de assinar um plano',
        message: 'Você precisa completar seu perfil com CPF/CNPJ e dados de endereço antes de assinar.',
        action: 'COMPLETE_PROFILE',
        redirectTo: '/profile'
      }, { status: 400 })
    }

    const customerId = user.asaasCustomerId

    let subscriptionResult

    // Create subscription based on payment method
    switch (subscriptionPlan.paymentMethod) {
      case 'PIX':
        subscriptionResult = await subscriptionService.createPixSubscription(
          customerId,
          subscriptionPlan
        )
        break

      case 'CREDIT_CARD':
        if (!creditCard) {
          return NextResponse.json(
            { error: 'Dados do cartão de crédito são obrigatórios' },
            { status: 400 }
          )
        }

        const creditCardData: CreditCardData = {
          holderName: creditCard.holderName,
          number: creditCard.number,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
          holderInfo: {
            name: creditCard.holderInfo.name,
            email: creditCard.holderInfo.email,
            cpfCnpj: creditCard.holderInfo.cpfCnpj,
            postalCode: creditCard.holderInfo.postalCode,
            addressNumber: creditCard.holderInfo.addressNumber,
            phone: creditCard.holderInfo.phone,
            addressComplement: creditCard.holderInfo.addressComplement,
            province: creditCard.holderInfo.province,
            city: creditCard.holderInfo.city,
            state: creditCard.holderInfo.state
          }
        }

        subscriptionResult = await subscriptionService.createCreditCardSubscription(
          customerId,
          subscriptionPlan,
          creditCardData
        )
        break

      case 'BOLETO':
        subscriptionResult = await subscriptionService.createBoletoSubscription(
          customerId,
          subscriptionPlan
        )
        break

      default:
        return NextResponse.json(
          { error: 'Método de pagamento não implementado' },
          { status: 400 }
        )
    }

    if (!subscriptionResult.success) {
      return NextResponse.json(
        { error: subscriptionResult.error },
        { status: 400 }
      )
    }

    // Update user in database with subscription info
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        subscriptionId: subscriptionResult.subscription.id,
        subscriptionStatus: subscriptionResult.subscription.status || 'PENDING',
        plan: subscriptionPlan.plan,
        // Update customer fields
        cpfCnpj: customerData.cpfCnpj?.replace(/\D/g, ''),
        phone: customerData.phone?.replace(/\D/g, ''),
        mobilePhone: customerData.mobilePhone?.replace(/\D/g, ''),
        address: customerData.address,
        addressNumber: customerData.addressNumber,
        complement: customerData.complement,
        province: customerData.province,
        city: customerData.city,
        state: customerData.state,
        postalCode: customerData.postalCode?.replace(/\D/g, '')
      }
    })

    // Return subscription details
    const response: any = {
      subscriptionId: subscriptionResult.subscription.id,
      customerId: customerId,
      status: subscriptionResult.subscription.status,
      plan: subscriptionPlan.plan,
      cycle: subscriptionPlan.cycle,
      paymentMethod: subscriptionPlan.paymentMethod,
      value: subscriptionResult.subscription.value,
      nextDueDate: subscriptionResult.subscription.nextDueDate
    }

    // If PIX, get QR code for first payment
    if (subscriptionPlan.paymentMethod === 'PIX') {
      // Get first payment from subscription
      const paymentsResult = await subscriptionService.getSubscriptionPayments(
        subscriptionResult.subscription.id
      )
      
      if (paymentsResult.success && paymentsResult.payments && paymentsResult.payments.length > 0) {
        const firstPayment = paymentsResult.payments[0]
        const pixResult = await subscriptionService.getPaymentPixQrCode(firstPayment.id)
        
        if (pixResult.success) {
          response.pix = {
            paymentId: firstPayment.id,
            qrCode: pixResult.qrCode?.encodedImage,
            payload: pixResult.qrCode?.payload
          }
        }
      }
    }

    // If Boleto, get boleto info for first payment
    if (subscriptionPlan.paymentMethod === 'BOLETO') {
      const paymentsResult = await subscriptionService.getSubscriptionPayments(
        subscriptionResult.subscription.id
      )
      
      if (paymentsResult.success && paymentsResult.payments && paymentsResult.payments.length > 0) {
        const firstPayment = paymentsResult.payments[0]
        const boletoResult = await subscriptionService.getPaymentBoleto(firstPayment.id)
        
        if (boletoResult.success) {
          response.boleto = {
            paymentId: firstPayment.id,
            identificationField: boletoResult.boleto?.identificationField,
            nossoNumero: boletoResult.boleto?.nossoNumero
          }
        }
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Subscription creation error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}