import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCreditPackageById } from '@/config/pricing'

/**
 * API de Compra Rápida de Créditos
 * POST /api/payments/credits/quick-purchase
 *
 * Suporta 2 métodos:
 * 1. CREDIT_CARD - Tokenização (cartão salvo ou novo)
 * 2. PIX - Geração de QR Code
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const body = await req.json()
    const { packageId, paymentMethod, cardToken, newCard } = body

    // Validação básica
    if (!packageId || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Buscar pacote
    const creditPackage = getCreditPackageById(packageId)
    if (!creditPackage) {
      return NextResponse.json(
        { success: false, error: 'Pacote não encontrado' },
        { status: 404 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        asaasCustomerId: true
      }
    })

    if (!user?.asaasCustomerId) {
      return NextResponse.json({
        success: false,
        error: 'Complete seu cadastro',
        action: 'COMPLETE_PROFILE'
      }, { status: 400 })
    }

    const description = `${creditPackage.name} - ${creditPackage.credits} créditos`
    const amount = creditPackage.price

    // Processar baseado no método
    switch (paymentMethod) {
      case 'CREDIT_CARD':
        return await processCardPayment(user, amount, description, cardToken, newCard, packageId)

      case 'PIX':
        return await processPixPayment(user, amount, description, packageId)

      default:
        return NextResponse.json(
          { success: false, error: 'Método inválido' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Quick purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao processar compra' },
      { status: 500 }
    )
  }
}

/**
 * Processar pagamento com cartão (crédito ou débito)
 */
async function processCardPayment(
  user: any,
  amount: number,
  description: string,
  cardToken: string | undefined,
  newCard: any | undefined,
  packageId: string
) {
  let tokenToUse = cardToken

  // Se não tem token mas tem dados de novo cartão, tokenizar primeiro
  if (!tokenToUse && newCard) {
    const tokenResponse = await fetch('https://api.asaas.com/v3/creditCard/tokenize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': process.env.ASAAS_API_KEY!,
        'User-Agent': 'VibePhoto/1.0'
      },
      body: JSON.stringify({
        customer: user.asaasCustomerId,
        creditCard: {
          holderName: newCard.holderName,
          number: newCard.number,
          expiryMonth: newCard.expiryMonth,
          expiryYear: newCard.expiryYear,
          ccv: newCard.ccv
        },
        creditCardHolderInfo: newCard.holderInfo,
        remoteIp: '127.0.0.1'
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Erro ao tokenizar cartão' },
        { status: 400 }
      )
    }

    tokenToUse = tokenData.creditCardToken

    // Salvar cartão tokenizado
    await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        asaasTokenId: tokenToUse,
        cardLast4: newCard.number.slice(-4),
        cardBrand: tokenData.creditCardBrand?.toLowerCase() || 'unknown',
        cardHolderName: newCard.holderName,
        expiryMonth: newCard.expiryMonth,
        expiryYear: newCard.expiryYear,
        isActive: true,
        isDefault: false
      }
    })
  }

  if (!tokenToUse) {
    return NextResponse.json(
      { success: false, error: 'Token do cartão é obrigatório' },
      { status: 400 }
    )
  }

  // Criar cobrança
  const response = await fetch('https://api.asaas.com/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY!,
      'User-Agent': 'VibePhoto/1.0'
    },
    body: JSON.stringify({
      customer: user.asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description,
      externalReference: `credit-${packageId}-${Date.now()}`,
      creditCard: {
        creditCardToken: tokenToUse
      },
      creditCardHolderInfo: {
        name: user.name,
        email: user.email
      }
    })
  })

  const payment = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      { success: false, error: payment.errors?.[0]?.description || 'Erro no pagamento' },
      { status: 400 }
    )
  }

  // Registrar no banco
  await prisma.usageLog.create({
    data: {
      userId: user.id,
      action: 'CREDIT_PACKAGE_PURCHASE',
      creditsUsed: 0,
      details: {
        packageId,
        paymentId: payment.id,
        amount,
        status: payment.status
      }
    }
  })

  return NextResponse.json({
    success: true,
    message: '✅ Pagamento aprovado! Seus créditos foram adicionados.',
    payment: {
      id: payment.id,
      status: payment.status,
      value: payment.value
    }
  })
}

/**
 * Processar pagamento PIX
 */
async function processPixPayment(
  user: any,
  amount: number,
  description: string,
  packageId: string
) {
  // Criar cobrança PIX
  const response = await fetch('https://api.asaas.com/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY!,
      'User-Agent': 'VibePhoto/1.0'
    },
    body: JSON.stringify({
      customer: user.asaasCustomerId,
      billingType: 'PIX',
      value: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description,
      externalReference: `credit-${packageId}-${Date.now()}`
    })
  })

  const payment = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      { success: false, error: payment.errors?.[0]?.description || 'Erro ao gerar PIX' },
      { status: 400 }
    )
  }

  // Buscar QR Code
  const qrCodeResponse = await fetch(`https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`, {
    headers: {
      'access_token': process.env.ASAAS_API_KEY!,
      'User-Agent': 'VibePhoto/1.0'
    }
  })

  const pixData = await qrCodeResponse.json()

  // Registrar no banco
  await prisma.usageLog.create({
    data: {
      userId: user.id,
      action: 'CREDIT_PACKAGE_PURCHASE_PENDING',
      creditsUsed: 0,
      details: {
        packageId,
        paymentId: payment.id,
        amount,
        status: payment.status
      }
    }
  })

  return NextResponse.json({
    success: true,
    message: '⏳ PIX gerado! Aguardando pagamento...',
    payment: {
      id: payment.id,
      status: payment.status,
      value: payment.value
    },
    pix: {
      payload: pixData.payload,
      encodedImage: pixData.encodedImage,
      expirationDate: pixData.expirationDate
    }
  })
}
