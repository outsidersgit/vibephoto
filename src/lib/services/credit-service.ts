import { 
  asaas, 
  AsaasCustomer, 
  AsaasPayment,
  CREDIT_PACKAGES,
  formatCustomerForAsaas,
  validateCustomerData,
  handleAsaasError,
  createPixPayment,
  createBoletoPayment,
  createCreditCardPayment
} from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'
import { recordCreditPurchase } from '@/lib/services/credit-transaction-service'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

export interface CreditPackage {
  id: keyof typeof CREDIT_PACKAGES
  name: string
  credits: number
  price: number
  description: string
  popular: boolean
  bonus?: number
}

export interface CreditPurchaseData {
  packageId: keyof typeof CREDIT_PACKAGES
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  installments?: number
  customerData: {
    name: string
    email: string
    cpfCnpj?: string
    phone?: string
    mobilePhone?: string
    address?: string
    addressNumber?: string
    complement?: string
    province?: string
    city?: string
    state?: string
    postalCode?: string
  }
  creditCardData?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
    holderInfo: {
      name: string
      email: string
      cpfCnpj: string
      postalCode: string
      addressNumber: string
      phone: string
      addressComplement?: string
      province?: string
      city?: string
      state?: string
    }
  }
}

export class CreditService {
  
  // Get available credit packages
  getCreditPackages(): CreditPackage[] {
    return Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
      id: id as keyof typeof CREDIT_PACKAGES,
      ...pkg
    }))
  }

  // Get specific credit package
  getCreditPackage(packageId: keyof typeof CREDIT_PACKAGES): CreditPackage | null {
    const pkg = CREDIT_PACKAGES[packageId]
    if (!pkg) return null

    return {
      id: packageId,
      ...pkg
    }
  }

  // Calculate total credits including bonus
  calculateTotalCredits(packageId: keyof typeof CREDIT_PACKAGES): number {
    const pkg = CREDIT_PACKAGES[packageId]
    if (!pkg) return 0

    return pkg.credits + (pkg.bonus || 0)
  }

  // Purchase credit package
  async purchaseCreditPackage(
    userId: string,
    purchaseData: CreditPurchaseData
  ): Promise<{
    success: boolean
    paymentId?: string
    customerId?: string
    error?: string
    pix?: { qrCode: string; payload: string }
    boleto?: { identificationField: string; nossoNumero: string }
  }> {
    try {
      // Validate package
      const creditPackage = this.getCreditPackage(purchaseData.packageId)
      if (!creditPackage) {
        return { success: false, error: 'Pacote de créditos inválido' }
      }

      // Validate customer data
      const formattedCustomer = formatCustomerForAsaas({
        ...purchaseData.customerData,
        externalReference: userId
      })
      
      const validation = validateCustomerData(formattedCustomer)
      if (!validation.isValid) {
        return { 
          success: false, 
          error: `Dados inválidos: ${validation.errors.join(', ')}` 
        }
      }

      // Create or get Asaas customer
      let asaasCustomer
      try {
        asaasCustomer = await asaas.createCustomer(formattedCustomer)
      } catch (error: any) {
        const asaasError = handleAsaasError(error)
        return { success: false, error: asaasError.message }
      }

      // Update user with customer ID if not already set
      await prisma.user.update({
        where: { id: userId },
        data: {
          asaasCustomerId: asaasCustomer.id,
          // Update customer fields if provided
          ...(purchaseData.customerData.cpfCnpj && { cpfCnpj: purchaseData.customerData.cpfCnpj.replace(/\D/g, '') }),
          ...(purchaseData.customerData.phone && { phone: purchaseData.customerData.phone.replace(/\D/g, '') }),
          ...(purchaseData.customerData.mobilePhone && { mobilePhone: purchaseData.customerData.mobilePhone.replace(/\D/g, '') }),
          ...(purchaseData.customerData.address && { address: purchaseData.customerData.address }),
          ...(purchaseData.customerData.addressNumber && { addressNumber: purchaseData.customerData.addressNumber }),
          ...(purchaseData.customerData.complement && { complement: purchaseData.customerData.complement }),
          ...(purchaseData.customerData.province && { province: purchaseData.customerData.province }),
          ...(purchaseData.customerData.city && { city: purchaseData.customerData.city }),
          ...(purchaseData.customerData.state && { state: purchaseData.customerData.state }),
          ...(purchaseData.customerData.postalCode && { postalCode: purchaseData.customerData.postalCode.replace(/\D/g, '') })
        }
      })

      // Create payment based on method
      const externalReference = `credits-${creditPackage.credits + (creditPackage.bonus || 0)}-${Date.now()}`
      const description = `Compra de ${creditPackage.name} - ${this.calculateTotalCredits(purchaseData.packageId)} créditos`

      let paymentResult
      
      switch (purchaseData.paymentMethod) {
        case 'PIX':
          paymentResult = await createPixPayment(
            asaasCustomer.id,
            creditPackage.price,
            description,
            externalReference
          )
          break

        case 'BOLETO':
          paymentResult = await createBoletoPayment(
            asaasCustomer.id,
            creditPackage.price,
            description,
            7, // 7 days to pay
            externalReference
          )
          break

        case 'CREDIT_CARD':
          if (!purchaseData.creditCardData) {
            return { success: false, error: 'Dados do cartão de crédito são obrigatórios' }
          }

          // Create payment with card
          const paymentData: AsaasPayment = {
            customer: asaasCustomer.id,
            billingType: 'CREDIT_CARD',
            dueDate: new Date().toISOString().split('T')[0],
            value: creditPackage.price,
            description,
            externalReference,
            installmentCount: purchaseData.installments || 1,
            installmentValue: purchaseData.installments ? creditPackage.price / purchaseData.installments : undefined,
            creditCard: purchaseData.creditCardData,
            creditCardHolderInfo: {
              ...purchaseData.creditCardData.holderInfo,
              cpfCnpj: purchaseData.creditCardData.holderInfo.cpfCnpj.replace(/\D/g, ''),
              postalCode: purchaseData.creditCardData.holderInfo.postalCode.replace(/\D/g, ''),
              phone: purchaseData.creditCardData.holderInfo.phone.replace(/\D/g, '')
            }
          }

          paymentResult = await asaas.createPayment(paymentData)
          break

        default:
          return { success: false, error: 'Método de pagamento não suportado' }
      }

      // Create credit purchase record in our database
      await prisma.creditPurchase.create({
        data: {
          userId,
          asaasPaymentId: paymentResult.id,
          packageName: creditPackage.name,
          creditAmount: this.calculateTotalCredits(purchaseData.packageId),
          value: creditPackage.price,
          status: 'PENDING',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      })

      // Create payment record
      await prisma.payment.create({
        data: {
          asaasPaymentId: paymentResult.id,
          userId,
          type: 'CREDIT_PURCHASE',
          status: 'PENDING',
          billingType: purchaseData.paymentMethod,
          value: creditPackage.price,
          description,
          dueDate: new Date(paymentResult.dueDate),
          externalReference,
          creditAmount: this.calculateTotalCredits(purchaseData.packageId),
          installmentCount: purchaseData.installments
        }
      })

      const result: any = {
        success: true,
        paymentId: paymentResult.id,
        customerId: asaasCustomer.id
      }

      // Get additional payment info for PIX/Boleto
      if (purchaseData.paymentMethod === 'PIX') {
        try {
          const pixResult = await asaas.getPixQrCode(paymentResult.id)
          result.pix = {
            qrCode: pixResult.encodedImage,
            payload: pixResult.payload
          }
        } catch (error) {
          console.warn('Failed to get PIX QR code:', error)
        }
      }

      if (purchaseData.paymentMethod === 'BOLETO') {
        try {
          const boletoResult = await asaas.getBoletoUrl(paymentResult.id)
          result.boleto = {
            identificationField: boletoResult.identificationField,
            nossoNumero: boletoResult.nossoNumero
          }
        } catch (error) {
          console.warn('Failed to get boleto info:', error)
        }
      }

      return result

    } catch (error: any) {
      console.error('Credit purchase error:', error)
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Get user's credit purchases
  async getUserCreditPurchases(userId: string, limit: number = 10) {
    return prisma.creditPurchase.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        packageName: true,
        creditAmount: true,
        value: true,
        status: true,
        validUntil: true,
        isExpired: true,
        purchasedAt: true,
        confirmedAt: true
      }
    })
  }

  // Get user's credit balance and history
  async getUserCreditInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditsBalance: true,
        creditsUsed: true,
        creditsLimit: true,
        plan: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const purchases = await this.getUserCreditPurchases(userId, 5)
    
    // Calculate total purchased credits
    const totalPurchased = await prisma.creditPurchase.aggregate({
      where: { 
        userId,
        status: 'CONFIRMED',
        isExpired: false
      },
      _sum: { creditAmount: true }
    })

    // Get recent usage
    const recentUsage = await prisma.usageLog.findMany({
      where: { 
        userId,
        creditsUsed: { gt: 0 }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        action: true,
        creditsUsed: true,
        createdAt: true,
        details: true
      }
    })

    return {
      balance: user.creditsBalance || 0,
      used: user.creditsUsed || 0,
      limit: user.creditsLimit || 0,
      plan: user.plan,
      totalPurchased: totalPurchased._sum.creditAmount || 0,
      purchases,
      recentUsage
    }
  }

  // Process credit purchase confirmation (called by webhook)
  async confirmCreditPurchase(paymentId: string): Promise<{
    success: boolean
    error?: string
    creditsAdded?: number
  }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Find the credit purchase
        const purchase = await tx.creditPurchase.findUnique({
          where: { asaasPaymentId: paymentId },
          include: { user: true }
        })

        if (!purchase) {
          return { error: 'Credit purchase not found' } as const
        }

        // If already confirmed, fetch latest user snapshot for broadcasting
        if (purchase.status === 'CONFIRMED') {
          const currentUser = await tx.user.findUnique({
            where: { id: purchase.userId },
            select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
          })

          return {
            purchase,
            updatedUser: currentUser,
            alreadyConfirmed: true
          } as const
        }

        const now = new Date()

        const updatedPurchase = await tx.creditPurchase.update({
          where: { id: purchase.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now
          }
        })

        const updatedUser = await tx.user.update({
          where: { id: purchase.userId },
          data: {
            creditsBalance: { increment: purchase.creditAmount }
          },
          select: {
            creditsUsed: true,
            creditsLimit: true,
            creditsBalance: true
          }
        })

        await recordCreditPurchase(
          purchase.userId,
          purchase.id,
          purchase.creditAmount,
          {
            packageId: purchase.packageId || undefined,
            packageName: purchase.packageName
          },
          tx
        )

        await tx.payment.updateMany({
          where: { asaasPaymentId: paymentId },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now
          }
        })

        await tx.usageLog.create({
          data: {
            userId: purchase.userId,
            action: 'CREDITS_PURCHASED',
            creditsUsed: 0,
            details: {
              paymentId,
              packageName: purchase.packageName,
              creditsAdded: purchase.creditAmount,
              value: purchase.value
            }
          }
        })

        return {
          purchase: updatedPurchase,
          updatedUser,
          alreadyConfirmed: false
        } as const
      })

      if (!result || 'error' in result) {
        return { success: false, error: result?.error || 'Credit purchase not found' }
      }

      if (result.updatedUser) {
        await broadcastCreditsUpdate(
          result.purchase.userId,
          result.updatedUser.creditsUsed,
          result.updatedUser.creditsLimit,
          'CREDIT_PURCHASE',
          result.updatedUser.creditsBalance
        )
      }

      return {
        success: true,
        creditsAdded: result.purchase.creditAmount
      }

    } catch (error: any) {
      console.error('Error confirming credit purchase:', error)
      return { success: false, error: error.message }
    }
  }

  // Check and mark expired credit purchases
  async markExpiredCredits(): Promise<{ expiredCount: number }> {
    const now = new Date()
    
    const result = await prisma.creditPurchase.updateMany({
      where: {
        validUntil: { lt: now },
        isExpired: false,
        status: 'CONFIRMED'
      },
      data: { isExpired: true }
    })

    return { expiredCount: result.count }
  }

  // Get credit package recommendations for user
  getCreditPackageRecommendations(userPlan: 'STARTER' | 'PREMIUM' | 'GOLD'): {
    recommended: keyof typeof CREDIT_PACKAGES
    alternatives: (keyof typeof CREDIT_PACKAGES)[]
    reasons: string[]
  } {
    const reasons: string[] = []
    let recommended: keyof typeof CREDIT_PACKAGES
    let alternatives: (keyof typeof CREDIT_PACKAGES)[]

    switch (userPlan) {
      case 'STARTER':
        recommended = 'ESSENCIAL'
        alternatives = ['PROFISSIONAL']
        reasons.push('Ideal para começar com mais créditos')
        reasons.push('Ótima relação custo-benefício')
        break

      case 'PREMIUM':
        recommended = 'PROFISSIONAL'
        alternatives = ['PREMIUM', 'ESSENCIAL']
        reasons.push('Pacote popular entre usuários Premium')
        reasons.push('Inclui créditos bônus')
        break

      case 'GOLD':
        recommended = 'PREMIUM'
        alternatives = ['MEGA', 'PROFISSIONAL']
        reasons.push('Máximo valor para usuários avançados')
        reasons.push('Maior quantidade de créditos bônus')
        break

      default:
        recommended = 'ESSENCIAL'
        alternatives = ['PROFISSIONAL']
        reasons.push('Pacote recomendado para iniciantes')
        break
    }

    return { recommended, alternatives, reasons }
  }
}

// Export singleton instance
export const creditService = new CreditService()