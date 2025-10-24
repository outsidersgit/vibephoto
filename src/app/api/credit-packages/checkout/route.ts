import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// import { CreditPackageService } from '@/lib/packages/credit-package-service' // TODO: Implement credit package service
import { asaas, formatCustomerForAsaas, createPixPayment, createBoletoPayment, createCreditCardPayment } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packageId, paymentMethod, installments = 1 } = await request.json()

    // Import credit package service
    const { CreditPackageService } = await import('@/lib/services/credit-package-service')

    const creditPackage = CreditPackageService.getPackageById(packageId || 'ESSENTIAL')
    if (!creditPackage) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Buscar ou criar cliente no Asaas
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        asaasCustomerId: true,
        mobilePhone: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validar que usuário tem asaasCustomerId
    if (!user.asaasCustomerId) {
      return NextResponse.json({
        error: 'Complete seu cadastro antes de comprar créditos',
        message: 'Você precisa completar seu perfil com CPF/CNPJ e dados de endereço antes de realizar compras.',
        action: 'COMPLETE_PROFILE',
        redirectTo: '/settings/account'
      }, { status: 400 })
    }

    const customerId = user.asaasCustomerId

    // Criar o pagamento baseado no método escolhido
    let payment
    const description = `${creditPackage.name} - ${creditPackage.creditAmount} créditos`
    const externalReference = `credit-package-${packageId}-${Date.now()}`

    try {
      switch (paymentMethod) {
        case 'PIX':
          payment = await createPixPayment(customerId, creditPackage.price, description, externalReference)
          break

        case 'BOLETO':
          payment = await createBoletoPayment(customerId, creditPackage.price, description, 7, externalReference)
          break

        case 'CREDIT_CARD':
          payment = await createCreditCardPayment(customerId, creditPackage.price, description, installments, undefined, externalReference)
          break

        default:
          // Para método não especificado, criar payment link que permite escolher
          const paymentLink = await asaas.createPaymentLink({
            name: creditPackage.name,
            description: `Compra de ${creditPackage.creditAmount} créditos`,
            value: creditPackage.price,
            billingType: 'UNDEFINED', // Permite PIX, cartão e boleto
            chargeType: 'DETACHED',
            maxInstallmentCount: 12,
            notificationEnabled: true
          })

          return NextResponse.json({
            success: true,
            checkoutUrl: paymentLink.url,
            paymentId: paymentLink.id,
            package: creditPackage,
            paymentMethod: 'LINK'
          })
      }

      // Salvar a transação pendente no banco (para rastrear e processar webhook)
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'CREDIT_PACKAGE_PURCHASE_PENDING',
          creditsUsed: 0, // Será atualizado quando pagamento for confirmado
          details: {
            packageId,
            paymentId: payment.id,
            paymentMethod,
            creditAmount: creditPackage.creditAmount,
            bonusCredits: creditPackage.bonusCredits,
            price: creditPackage.price,
            installments,
            externalReference,
            status: 'PENDING'
          }
        }
      })

      // Retornar URLs específicas baseadas no método de pagamento
      let checkoutUrl = payment.invoiceUrl // URL padrão do Asaas

      if (paymentMethod === 'PIX' && payment.encodedImage) {
        // Para PIX, usar URL com QR Code
        checkoutUrl = `data:${payment.encodedImage}`
      } else if (paymentMethod === 'BOLETO') {
        // Para boleto, usar URL do PDF
        checkoutUrl = payment.bankSlipUrl || payment.invoiceUrl
      }

      return NextResponse.json({
        success: true,
        checkoutUrl,
        paymentId: payment.id,
        package: creditPackage,
        paymentMethod,
        paymentInfo: {
          pixQrCode: payment.encodedImage,
          pixKey: payment.pixKey,
          boletoUrl: payment.bankSlipUrl,
          invoiceUrl: payment.invoiceUrl
        }
      })

    } catch (error) {
      console.error('Error creating payment:', error)
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing credit package checkout:', error)
    return NextResponse.json(
      { error: 'Failed to process checkout' },
      { status: 500 }
    )
  }
}