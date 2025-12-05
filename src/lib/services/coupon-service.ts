import { prisma } from '@/lib/prisma'
import { getPlanById } from '@/config/pricing'
import { CouponType, DiscountType } from '@prisma/client'

export interface ValidatedCoupon {
  code: string
  type: CouponType
  discountType: DiscountType
  discountValue: number
  discountAmount: number // Calculated discount in BRL
  finalPrice: number // Price after discount
  originalPrice: number
  influencer?: {
    id: string
    couponCode: string
    commissionPercentage: number
    commissionFixedValue: number | null
    asaasWalletId: string
  }
}

export interface CouponValidationResult {
  valid: boolean
  coupon?: ValidatedCoupon
  error?: string
}

/**
 * Validate a coupon code for a specific plan and cycle
 */
export async function validateCoupon(
  code: string,
  planId: 'STARTER' | 'PREMIUM' | 'GOLD',
  cycle: 'MONTHLY' | 'YEARLY',
  userId: string
): Promise<CouponValidationResult> {
  try {
    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    console.log('🎟️ [COUPON] Validating coupon:', {
      code: normalizedCode,
      planId,
      cycle,
      userId
    })

    // Find coupon in database
    const coupon = await prisma.discountCoupon.findUnique({
      where: { code: normalizedCode },
      include: {
        influencer: {
          select: {
            id: true,
            couponCode: true,
            commissionPercentage: true,
            commissionFixedValue: true,
            asaasWalletId: true
          }
        },
        usages: {
          where: { userId }
        }
      }
    })

    // Coupon not found
    if (!coupon) {
      console.log('❌ [COUPON] Coupon not found:', normalizedCode)
      return {
        valid: false,
        error: 'Cupom não encontrado'
      }
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      console.log('❌ [COUPON] Coupon is inactive:', normalizedCode)
      return {
        valid: false,
        error: 'Cupom inativo'
      }
    }

    // Check validity dates
    const now = new Date()
    if (coupon.validFrom > now) {
      console.log('❌ [COUPON] Coupon not yet valid:', normalizedCode)
      return {
        valid: false,
        error: 'Cupom ainda não está válido'
      }
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      console.log('❌ [COUPON] Coupon expired:', normalizedCode)
      return {
        valid: false,
        error: 'Cupom expirado'
      }
    }

    // Check total usage limit
    if (coupon.maxUses !== null && coupon.totalUses >= coupon.maxUses) {
      console.log('❌ [COUPON] Coupon usage limit reached:', normalizedCode)
      return {
        valid: false,
        error: 'Limite de uso do cupom atingido'
      }
    }

    // Check per-user usage limit
    if (coupon.maxUsesPerUser !== null) {
      const userUsageCount = coupon.usages.length
      if (userUsageCount >= coupon.maxUsesPerUser) {
        console.log('❌ [COUPON] User usage limit reached:', normalizedCode)
        return {
          valid: false,
          error: 'Você já utilizou este cupom o máximo de vezes permitido'
        }
      }
    }

    // Check if coupon applies to this plan
    if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planId)) {
      console.log('❌ [COUPON] Coupon not applicable to plan:', { coupon: normalizedCode, planId })
      return {
        valid: false,
        error: 'Cupom não aplicável a este plano'
      }
    }

    // Get plan price
    const plan = await getPlanById(planId)
    if (!plan) {
      return {
        valid: false,
        error: 'Plano não encontrado'
      }
    }

    const originalPrice = cycle === 'YEARLY' ? plan.annualPrice : plan.monthlyPrice

    // Calculate discount
    let discountAmount = 0
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (originalPrice * Number(coupon.discountValue)) / 100
    } else {
      // FIXED
      discountAmount = Number(coupon.discountValue)
    }

    // Ensure discount doesn't exceed original price
    if (discountAmount > originalPrice) {
      discountAmount = originalPrice
    }

    const finalPrice = originalPrice - discountAmount

    // Build validated coupon response
    const validatedCoupon: ValidatedCoupon = {
      code: coupon.code,
      type: coupon.type,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
      finalPrice,
      originalPrice
    }

    // If HYBRID coupon, include influencer data
    if (coupon.type === 'HYBRID' && coupon.influencer) {
      validatedCoupon.influencer = {
        id: coupon.influencer.id,
        couponCode: coupon.influencer.couponCode,
        commissionPercentage: Number(coupon.influencer.commissionPercentage),
        commissionFixedValue: coupon.influencer.commissionFixedValue
          ? Number(coupon.influencer.commissionFixedValue)
          : null,
        asaasWalletId: coupon.influencer.asaasWalletId
      }
    }

    console.log('✅ [COUPON] Coupon validated successfully:', {
      code: normalizedCode,
      originalPrice,
      discountAmount,
      finalPrice,
      type: coupon.type
    })

    return {
      valid: true,
      coupon: validatedCoupon
    }

  } catch (error) {
    console.error('❌ [COUPON] Error validating coupon:', error)
    return {
      valid: false,
      error: 'Erro ao validar cupom'
    }
  }
}

/**
 * Record coupon usage after successful payment
 */
export async function recordCouponUsage(
  couponCode: string,
  userId: string,
  paymentId: string,
  discountApplied: number
): Promise<void> {
  try {
    const normalizedCode = couponCode.trim().toUpperCase()

    const coupon = await prisma.discountCoupon.findUnique({
      where: { code: normalizedCode }
    })

    if (!coupon) {
      console.warn('⚠️ [COUPON] Coupon not found when recording usage:', normalizedCode)
      return
    }

    // Create usage record
    await prisma.couponUsage.create({
      data: {
        couponId: coupon.id,
        userId,
        paymentId,
        discountApplied
      }
    })

    // Increment total uses
    await prisma.discountCoupon.update({
      where: { id: coupon.id },
      data: {
        totalUses: {
          increment: 1
        }
      }
    })

    console.log('✅ [COUPON] Usage recorded:', {
      code: normalizedCode,
      userId,
      paymentId,
      discountApplied
    })

  } catch (error) {
    console.error('❌ [COUPON] Error recording usage:', error)
    // Don't throw - we don't want to fail the payment if recording fails
  }
}
