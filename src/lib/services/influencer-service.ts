import { createInfluencerRecord } from '@/lib/db/influencers'

export function generateCouponCode(base?: string) {
  const seed = (base || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const prefix = seed ? seed.slice(0, 6) : 'VIBE'
  return `${prefix}${random}`
}

export interface InfluencerSetupInput {
  userId: string
  couponCode: string
  asaasWalletId: string
  commissionPercentage?: number
  commissionFixedValue?: number | null
  name: string
  incomeValue?: number | null
}

export async function createInfluencer(input: InfluencerSetupInput) {
  return createInfluencerRecord({
    userId: input.userId,
    couponCode: input.couponCode,
    asaasWalletId: input.asaasWalletId,
    commissionPercentage: input.commissionPercentage,
    commissionFixedValue: input.commissionFixedValue,
    incomeValue: input.incomeValue ?? undefined
  })
}

