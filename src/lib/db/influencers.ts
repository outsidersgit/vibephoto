import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface CreateInfluencerInput {
  userId: string
  couponCode: string
  asaasWalletId: string
  commissionPercentage?: number
  commissionFixedValue?: number | null
  incomeValue?: number | null
}

export async function createInfluencerRecord({
  userId,
  couponCode,
  asaasWalletId,
  commissionPercentage,
  commissionFixedValue,
  incomeValue
}: CreateInfluencerInput) {
  return prisma.influencer.create({
    data: {
      userId,
      couponCode,
      asaasWalletId,
      ...(typeof commissionPercentage === 'number'
        ? { commissionPercentage: new Prisma.Decimal(commissionPercentage) }
        : {}),
      ...(typeof commissionFixedValue === 'number'
        ? { commissionFixedValue: new Prisma.Decimal(commissionFixedValue) }
        : commissionFixedValue === null
          ? { commissionFixedValue: null }
          : {}),
      ...(typeof incomeValue === 'number'
        ? { monthlyIncome: new Prisma.Decimal(incomeValue) }
        : {})
    }
  })
}

export async function findInfluencerByCouponCode(
  code: string,
  options?: { includeUser?: boolean }
) {
  return prisma.influencer.findUnique({
    where: { couponCode: code.toUpperCase() },
    include: options?.includeUser ? { user: true } : undefined
  })
}

export async function findInfluencerByUserId(userId: string) {
  return prisma.influencer.findUnique({
    where: { userId }
  })
}

export async function findInfluencerByWalletId(walletId: string) {
  return prisma.influencer.findUnique({
    where: { asaasWalletId: walletId }
  })
}

export async function isCouponAvailable(couponCode: string) {
  const existing = await prisma.influencer.findUnique({
    where: { couponCode: couponCode.toUpperCase() }
  })
  return !existing
}

export async function isWalletAvailable(walletId: string) {
  const existing = await prisma.influencer.findUnique({
    where: { asaasWalletId: walletId }
  })
  return !existing
}

export async function incrementInfluencerStats(
  influencerId: string,
  {
    referrals = 0,
    commissionValue = 0
  }: { referrals?: number; commissionValue?: number }
) {
  return prisma.influencer.update({
    where: { id: influencerId },
    data: {
      totalReferrals: {
        increment: referrals
      },
      totalCommissions: {
        increment: new Prisma.Decimal(commissionValue)
      }
    }
  })
}

