import { asaas } from '@/lib/payments/asaas'
import { formatBrazilianDate } from '@/lib/utils'

export interface OptimizedPixPayment {
  id: string
  value: number
  description: string
  dueDate: string
  status: string
  qrCode: string
  pixKey: string
  expiresAt: Date
  discount?: {
    value: number
    type: 'PERCENTAGE' | 'FIXED'
  }
}

export class OptimizedPixService {
  /**
   * Cria um pagamento PIX otimizado com desconto e QR code instantâneo
   */
  static async createOptimizedPixPayment(
    customerId: string,
    value: number,
    description: string,
    externalReference?: string,
    applyDiscount: boolean = true
  ): Promise<OptimizedPixPayment> {

    // Aplicar desconto de 5% para PIX (preferência do mercado brasileiro)
    const discount = applyDiscount ? {
      value: 5,
      type: 'PERCENTAGE' as const
    } : undefined

    // Criar pagamento com 24h de expiração
    const payment = await asaas.createPayment({
      customer: customerId,
      billingType: 'PIX',
      dueDate: formatBrazilianDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24h expiry
      value,
      description,
      externalReference,
      discount
    })

    // Buscar QR Code e chave PIX simultaneamente para display imediato
    const [qrCodeResult, pixKeyResult] = await Promise.all([
      asaas.getPixQrCode(payment.id),
      asaas.getPixKey(payment.id)
    ])

    return {
      id: payment.id,
      value: payment.value,
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      qrCode: qrCodeResult.encodedImage,
      pixKey: pixKeyResult.key,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      discount
    }
  }

  /**
   * Verifica o status de um pagamento PIX
   */
  static async checkPixPaymentStatus(paymentId: string) {
    return await asaas.getPaymentById(paymentId)
  }

  /**
   * Gera QR Code dinâmico para pagamento existente
   */
  static async generatePixQrCode(paymentId: string) {
    return await asaas.getPixQrCode(paymentId)
  }

  /**
   * Obtém chave PIX para pagamento
   */
  static async getPixKey(paymentId: string) {
    return await asaas.getPixKey(paymentId)
  }

  /**
   * Calcula valor com desconto PIX
   */
  static calculatePixValue(originalValue: number, discountPercentage: number = 5): number {
    return originalValue * (1 - discountPercentage / 100)
  }

  /**
   * Formata dados do PIX para display no frontend
   */
  static formatPixDisplayData(payment: OptimizedPixPayment) {
    return {
      paymentId: payment.id,
      amount: payment.value,
      originalAmount: payment.discount ?
        payment.value / (1 - payment.discount.value / 100) :
        payment.value,
      discountAmount: payment.discount ?
        (payment.value / (1 - payment.discount.value / 100)) - payment.value :
        0,
      discountPercentage: payment.discount?.value || 0,
      qrCode: payment.qrCode,
      pixKey: payment.pixKey,
      expiresAt: payment.expiresAt.toISOString(),
      status: payment.status,
      instructions: [
        'Abra o aplicativo do seu banco',
        'Escaneie o código QR ou copie e cole a chave PIX',
        'Confirme o pagamento',
        'Aprovação instantânea após confirmação'
      ]
    }
  }

  /**
   * Gera mensagem promocional para PIX
   */
  static getPixPromotionalMessage(originalValue: number): string {
    const discountValue = originalValue * 0.05 // 5% discount
    const finalValue = originalValue - discountValue

    return `💳 Pague com PIX e economize R$ ${discountValue.toFixed(2)}! De R$ ${originalValue.toFixed(2)} por apenas R$ ${finalValue.toFixed(2)} ⚡ Aprovação instantânea`
  }
}