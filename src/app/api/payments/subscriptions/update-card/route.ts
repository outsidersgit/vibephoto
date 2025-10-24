import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest) {
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
    const { creditCard, creditCardHolderInfo } = body

    // Validate required fields
    if (!creditCard || !creditCardHolderInfo) {
      return NextResponse.json(
        { error: 'Dados do cartão são obrigatórios' },
        { status: 400 }
      )
    }

    // Get user subscription
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionId: true,
        asaasCustomerId: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (!user.subscriptionId) {
      return NextResponse.json(
        { error: 'Nenhuma assinatura ativa encontrada' },
        { status: 400 }
      )
    }

    // Get client IP for fraud prevention
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const remoteIp = forwardedFor?.split(',')[0].trim() || realIp || '127.0.0.1'

    // Format credit card data for Asaas
    const cardData = {
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ''), // Remove spaces
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''), // Only numbers
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''), // Only numbers
        addressNumber: creditCardHolderInfo.addressNumber,
        phone: creditCardHolderInfo.phone.replace(/\D/g, ''), // Only numbers
        addressComplement: creditCardHolderInfo.addressComplement || undefined,
        province: creditCardHolderInfo.province || undefined,
        city: creditCardHolderInfo.city || undefined,
        state: creditCardHolderInfo.state || undefined
      },
      remoteIp
    }

    // Update credit card in Asaas
    const result = await asaas.updateSubscriptionCreditCard(user.subscriptionId, cardData)

    // Log the card update
    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        action: 'CARD_UPDATED',
        creditsUsed: 0,
        details: {
          subscriptionId: user.subscriptionId,
          lastFourDigits: creditCard.number.slice(-4),
          updatedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Cartão atualizado com sucesso. O cartão anterior foi excluído automaticamente.',
      subscription: {
        id: user.subscriptionId,
        lastFourDigits: creditCard.number.slice(-4)
      }
    })

  } catch (error: any) {
    console.error('Card update error:', error)

    // Parse Asaas error if available
    let errorMessage = 'Erro ao atualizar cartão'
    if (error.message?.includes('Asaas API Error')) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
