import { prisma } from '@/lib/prisma'
import { getPlanById } from '@/config/pricing'
import { CouponType, DiscountType } from '@prisma/client'

export interface ValidatedCoupon {
  code: string
  type: CouponType
  discountType: DiscountType
  discountValue: number
  durationType: 'RECURRENT' | 'FIRST_CYCLE' // Duration of the discount
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
    // CRITICAL: Include custom commission fields from this specific coupon
    // This ensures multi-coupon support - each coupon can have different commission
    const coupon = await prisma.discountCoupon.findUnique({
      where: { code: normalizedCode },
      select: {
        id: true,
        code: true,
        type: true,
        discountType: true,
        discountValue: true,
        durationType: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        maxUses: true,
        totalUses: true,
        maxUsesPerUser: true,
        applicablePlans: true,
        customCommissionPercentage: true,
        customCommissionFixedValue: true,
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

    // Round to 2 decimal places for Asaas compatibility
    // Use Math.ceil to always round UP for better user experience
    discountAmount = Math.floor(discountAmount * 100) / 100
    const finalPrice = Math.ceil((originalPrice - discountAmount) * 100) / 100

    // Build validated coupon response
    const validatedCoupon: ValidatedCoupon = {
      code: coupon.code,
      type: coupon.type,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      durationType: coupon.durationType,
      discountAmount,
      finalPrice,
      originalPrice
    }

    // If HYBRID coupon, include influencer data with custom commission if set
    if (coupon.type === 'HYBRID' && coupon.influencer) {
      // Priority logic:
      // 1. If customCommissionFixedValue exists and > 0, use FIXED (takes priority)
      // 2. Else if customCommissionPercentage exists and > 0, use PERCENTAGE
      // 3. Else use influencer defaults

      const hasCustomFixed = coupon.customCommissionFixedValue !== null &&
                            coupon.customCommissionFixedValue !== undefined &&
                            Number(coupon.customCommissionFixedValue) > 0

      const hasCustomPercentage = coupon.customCommissionPercentage !== null &&
                                 coupon.customCommissionPercentage !== undefined &&
                                 Number(coupon.customCommissionPercentage) > 0

      let commissionPercentage: number
      let commissionFixedValue: number | null

      if (hasCustomFixed) {
        // Use custom fixed value, set percentage to 0
        commissionFixedValue = Number(coupon.customCommissionFixedValue)
        commissionPercentage = 0
        console.log('💰 [COUPON] Using CUSTOM FIXED commission:', commissionFixedValue)
      } else if (hasCustomPercentage) {
        // Use custom percentage, set fixed to null
        commissionPercentage = Number(coupon.customCommissionPercentage)
        commissionFixedValue = null
        console.log('💰 [COUPON] Using CUSTOM PERCENTAGE commission:', commissionPercentage)
      } else {
        // Use influencer defaults
        commissionPercentage = Number(coupon.influencer.commissionPercentage)
        commissionFixedValue = coupon.influencer.commissionFixedValue ? Number(coupon.influencer.commissionFixedValue) : null
        console.log('💰 [COUPON] Using INFLUENCER DEFAULT commission:', {
          percentage: commissionPercentage,
          fixed: commissionFixedValue
        })
      }

      validatedCoupon.influencer = {
        id: coupon.influencer.id,
        couponCode: coupon.influencer.couponCode,
        commissionPercentage,
        commissionFixedValue,
        asaasWalletId: coupon.influencer.asaasWalletId
      }

      console.log('✅ [COUPON] Final commission for HYBRID coupon:', {
        code: coupon.code,
        influencerId: coupon.influencer.id,
        type: hasCustomFixed ? 'FIXED' : hasCustomPercentage ? 'PERCENTAGE' : 'INFLUENCER_DEFAULT',
        percentage: commissionPercentage,
        fixed: commissionFixedValue
      })
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
