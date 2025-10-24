import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { creditService, CreditPurchaseData } from '@/lib/services/credit-service'

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
    const { packageId, paymentMethod, installments, customer, creditCard } = body

    // Validate required fields
    if (!packageId || !paymentMethod || !customer) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // Validate package exists
    const creditPackage = creditService.getCreditPackage(packageId)
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Pacote de créditos inválido' },
        { status: 400 }
      )
    }

    // Validate payment method
    if (!['PIX', 'CREDIT_CARD', 'BOLETO'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Método de pagamento inválido' },
        { status: 400 }
      )
    }

    // Validate credit card data if needed
    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      return NextResponse.json(
        { error: 'Dados do cartão de crédito são obrigatórios para este método' },
        { status: 400 }
      )
    }

    // Validate customer data
    const customerData = {
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

    if (!customerData.name || !customerData.email) {
      return NextResponse.json(
        { error: 'Nome e email são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate installments for credit card
    const maxInstallments = 12 // Could be based on user plan
    if (paymentMethod === 'CREDIT_CARD' && installments) {
      if (installments < 1 || installments > maxInstallments) {
        return NextResponse.json(
          { error: `Número de parcelas deve ser entre 1 e ${maxInstallments}` },
          { status: 400 }
        )
      }
    }

    // Prepare purchase data
    const purchaseData: CreditPurchaseData = {
      packageId,
      paymentMethod,
      installments: paymentMethod === 'CREDIT_CARD' ? (installments || 1) : undefined,
      customerData,
      creditCardData: paymentMethod === 'CREDIT_CARD' ? {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
        holderInfo: {
          name: creditCard.holderInfo.name || customerData.name,
          email: creditCard.holderInfo.email || customerData.email,
          cpfCnpj: creditCard.holderInfo.cpfCnpj || customerData.cpfCnpj || '',
          postalCode: creditCard.holderInfo.postalCode || customerData.postalCode || '',
          addressNumber: creditCard.holderInfo.addressNumber || customerData.addressNumber || '',
          phone: creditCard.holderInfo.phone || customerData.phone || '',
          addressComplement: creditCard.holderInfo.addressComplement || customerData.complement,
          province: creditCard.holderInfo.province || customerData.province,
          city: creditCard.holderInfo.city || customerData.city,
          state: creditCard.holderInfo.state || customerData.state
        }
      } : undefined
    }

    // Process the purchase
    const result = await creditService.purchaseCreditPackage(
      session.user.id,
      purchaseData
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Prepare response
    const response: any = {
      success: true,
      paymentId: result.paymentId,
      customerId: result.customerId,
      package: {
        id: packageId,
        name: creditPackage.name,
        credits: creditService.calculateTotalCredits(packageId),
        price: creditPackage.price
      },
      paymentMethod,
      installments: installments || 1
    }

    // Add payment-specific data
    if (paymentMethod === 'PIX' && result.pix) {
      response.pix = result.pix
    }

    if (paymentMethod === 'BOLETO' && result.boleto) {
      response.boleto = result.boleto
    }

    if (paymentMethod === 'CREDIT_CARD') {
      response.creditCard = {
        approved: true, // Assuming immediate approval for demo
        installments: installments || 1,
        installmentValue: installments ? creditPackage.price / installments : creditPackage.price
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Credit purchase error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET method to get available credit packages
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Get user info for recommendations
    const user = await creditService.getUserCreditInfo(session.user.id)
    const packages = creditService.getCreditPackages()
    const recommendations = creditService.getCreditPackageRecommendations(user.plan as any)

    return NextResponse.json({
      packages: packages.map(pkg => ({
        ...pkg,
        totalCredits: creditService.calculateTotalCredits(pkg.id),
        recommended: pkg.id === recommendations.recommended,
        reasons: pkg.id === recommendations.recommended ? recommendations.reasons : []
      })),
      recommendations,
      userInfo: {
        currentBalance: user.balance,
        plan: user.plan,
        totalPurchased: user.totalPurchased
      }
    })

  } catch (error: any) {
    console.error('Get credit packages error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}