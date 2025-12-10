import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/coupons
 * Lista todos os cupons
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const coupons = await prisma.discountCoupon.findMany({
      include: {
        influencer: {
          select: {
            id: true,
            couponCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            usages: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ coupons })

  } catch (error: any) {
    console.error('Error fetching coupons:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar cupons' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/coupons
 * Cria novo cupom
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const {
      code,
      type,
      discountType,
      discountValue,
      durationType,
      influencerId,
      customCommissionPercentage,
      customCommissionFixedValue,
      applicablePlans,
      isActive,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser
    } = body

    // Validações
    if (!code || !type || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Normalizar código para uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Verificar se código já existe
    const existing = await prisma.discountCoupon.findUnique({
      where: { code: normalizedCode }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Código de cupom já existe' },
        { status: 400 }
      )
    }

    // Validar tipo HYBRID tem influencer
    if (type === 'HYBRID' && !influencerId) {
      return NextResponse.json(
        { error: 'Cupom HÍBRIDO requer um influenciador vinculado' },
        { status: 400 }
      )
    }

    // Determine which commission to save (only one should be set)
    // If both are provided, fixed takes priority
    let finalCustomPercentage = null
    let finalCustomFixed = null

    if (customCommissionFixedValue && parseFloat(customCommissionFixedValue) > 0) {
      finalCustomFixed = parseFloat(customCommissionFixedValue)
      finalCustomPercentage = null // Clear percentage when using fixed
    } else if (customCommissionPercentage && parseFloat(customCommissionPercentage) > 0) {
      finalCustomPercentage = parseFloat(customCommissionPercentage)
      finalCustomFixed = null // Clear fixed when using percentage
    }

    // Criar cupom
    const coupon = await prisma.discountCoupon.create({
      data: {
        code: normalizedCode,
        type,
        discountType,
        discountValue: parseFloat(discountValue),
        durationType: durationType || 'FIRST_CYCLE',
        influencerId: influencerId || null,
        customCommissionPercentage: finalCustomPercentage,
        customCommissionFixedValue: finalCustomFixed,
        applicablePlans: applicablePlans || [],
        isActive: isActive !== undefined ? isActive : true,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : 1
      },
      include: {
        influencer: {
          select: {
            id: true,
            couponCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ coupon }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating coupon:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar cupom' },
      { status: 500 }
    )
  }
}
