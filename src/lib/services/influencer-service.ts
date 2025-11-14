import { asaas } from '@/lib/payments/asaas'
import {
  createInfluencerRecord,
  CreateInfluencerInput
} from '@/lib/db/influencers'

export function generateCouponCode(base?: string) {
  const seed = (base || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const prefix = seed ? seed.slice(0, 6) : 'VIBE'
  return `${prefix}${random}`
}

export interface InfluencerSetupInput
  extends Omit<CreateInfluencerInput, 'asaasWalletId' | 'asaasApiKey'> {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  incomeValue: number
  phone?: string
  mobilePhone?: string
  personType?: 'FISICA' | 'JURIDICA'
  companyType?: string
}

export async function createInfluencerWithSubaccount(input: InfluencerSetupInput) {
  const subaccount = await asaas.createSubaccount({
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    postalCode: input.postalCode,
    incomeValue: input.incomeValue,
    phone: input.phone,
    mobilePhone: input.mobilePhone,
    personType: input.personType,
    companyType: input.companyType
  })

  const influencer = await createInfluencerRecord({
    userId: input.userId,
    couponCode: input.couponCode,
    commissionPercentage: input.commissionPercentage,
    commissionFixedValue: input.commissionFixedValue,
    asaasWalletId: subaccount.walletId,
    asaasApiKey: subaccount.apiKey,
    incomeValue: input.incomeValue
  })

  return {
    influencer,
    subaccount
  }
}

