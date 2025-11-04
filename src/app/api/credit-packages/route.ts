/**
 * API para gerenciamento de pacotes de créditos
 * GET - Lista pacotes disponíveis
 * POST - Processa compra de pacote de créditos
 * 
 * Performance: Cache de 5min (pacotes mudam raramente) - Sprint 1
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CreditPackageService } from '@/lib/services/credit-package-service'
import { unstable_cache } from 'next/cache'

// GET /api/credit-packages - Lista pacotes disponíveis
export async function GET() {
  try {
    // Cache de 5 minutos para pacotes (mudam raramente) - Sprint 1
    const getCachedPackages = unstable_cache(
      async () => {
        return CreditPackageService.getAvailablePackages()
      },
      ['credit-packages'],
      {
        revalidate: 300, // 5 minutos
        tags: ['credit-packages']
      }
    )

    const packages = await getCachedPackages()
    
    return NextResponse.json({
      success: true,
      packages
    })
    
  } catch (error: any) {
    console.error('Error fetching credit packages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credit packages' },
      { status: 500 }
    )
  }
}

// POST /api/credit-packages - Inicia compra de pacote
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { packageId } = body

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      )
    }

    // Verificar se o pacote existe
    const creditPackage = await CreditPackageService.getPackageById(packageId)
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      )
    }

    // TODO: Integrar com Asaas para criar cobrança
    // Por enquanto, simular a criação da compra
    
    return NextResponse.json({
      success: true,
      message: 'Purchase initiated',
      package: creditPackage,
      // TODO: Retornar dados de pagamento (PIX, cartão, etc)
      paymentInfo: {
        packageId,
        amount: creditPackage.price,
        description: `${creditPackage.name} - ${creditPackage.creditAmount + creditPackage.bonusCredits} créditos`,
        // paymentUrl: 'https://...' // URL de pagamento do Asaas
      }
    })

  } catch (error: any) {
    console.error('Error processing credit package purchase:', error)
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    )
  }
}