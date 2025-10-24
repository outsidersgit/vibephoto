import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CreditPackageService } from '@/lib/services/credit-package-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packageId } = await request.json()

    // Usar o pacote mais barato como padrão se não especificado
    const selectedPackageId = packageId || 'ESSENTIAL'

    // Criar checkout diretamente através do novo endpoint
    const checkoutResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credit-packages/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || '' // Passar cookies para manter sessão
      },
      body: JSON.stringify({
        packageId: selectedPackageId,
        paymentMethod: 'UNDEFINED' // Permite escolher no checkout
      })
    })

    if (!checkoutResponse.ok) {
      throw new Error('Failed to create checkout')
    }

    const checkoutData = await checkoutResponse.json()

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutData.checkoutUrl,
      package: checkoutData.package,
      paymentId: checkoutData.paymentId,
      message: 'Redirecting to checkout'
    })

  } catch (error) {
    console.error('Error processing quick purchase:', error)
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    )
  }
}