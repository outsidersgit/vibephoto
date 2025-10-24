import { prisma } from '@/lib/prisma'

interface CreateCreditTransactionParams {
  userId: string
  type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'REFUNDED'
  source: 'SUBSCRIPTION' | 'PURCHASE' | 'BONUS' | 'GENERATION' | 'TRAINING' | 'REFUND' | 'EXPIRATION' | 'UPSCALE' | 'EDIT' | 'VIDEO'
  amount: number // Positive for earned, negative for spent
  description?: string
  referenceId?: string // Generation ID, Model ID, etc
  creditPurchaseId?: string
  metadata?: any
}

/**
 * Cria uma transação de crédito e atualiza o saldo do usuário
 * IMPORTANTE: Este método SEMPRE deve ser chamado quando créditos são adicionados ou gastos
 */
export async function createCreditTransaction(params: CreateCreditTransactionParams) {
  const {
    userId,
    type,
    source,
    amount,
    description,
    referenceId,
    creditPurchaseId,
    metadata
  } = params

  // Buscar saldo atual do usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsLimit: true,
      creditsUsed: true,
      creditsBalance: true
    }
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  // Calcular novo saldo total
  // Saldo = (creditsLimit - creditsUsed) + creditsBalance + amount
  const planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
  const totalBalance = planCreditsAvailable + user.creditsBalance
  const newBalance = totalBalance + amount

  // Criar transação
  const transaction = await prisma.creditTransaction.create({
    data: {
      userId,
      type,
      source,
      amount,
      description,
      referenceId,
      creditPurchaseId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      balanceAfter: newBalance
    }
  })

  return transaction
}

/**
 * Registra gasto de créditos em geração de imagem
 */
export async function recordImageGenerationCost(
  userId: string,
  generationId: string,
  creditsUsed: number,
  metadata?: { prompt?: string; variations?: number; resolution?: string }
) {
  const count = metadata?.variations || 1
  const description = count === 1 ? 'Geração de 1 imagem' : `Geração de ${count} imagens`

  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'GENERATION',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description,
    referenceId: generationId,
    metadata
  })
}

/**
 * Registra gasto de créditos em criação de modelo IA
 */
export async function recordModelTrainingCost(
  userId: string,
  modelId: string,
  creditsUsed: number,
  metadata?: { modelName?: string; photoCount?: number }
) {
  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'TRAINING',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description: `Criação de modelo IA${metadata?.modelName ? `: ${metadata.modelName}` : ''}`,
    referenceId: modelId,
    metadata
  })
}

/**
 * Registra gasto de créditos em upscale de imagem
 */
export async function recordUpscaleCost(
  userId: string,
  upscaleId: string,
  creditsUsed: number,
  metadata?: { originalResolution?: string; targetResolution?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'UPSCALE',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description: 'Upscale de imagem',
    referenceId: upscaleId,
    metadata
  })
}

/**
 * Registra gasto de créditos em edição de imagem
 */
export async function recordImageEditCost(
  userId: string,
  editId: string,
  creditsUsed: number,
  metadata?: { operation?: string; prompt?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'EDIT',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description: 'Edição de imagem',
    referenceId: editId,
    metadata
  })
}

/**
 * Registra gasto de créditos em geração de vídeo
 */
export async function recordVideoGenerationCost(
  userId: string,
  videoId: string,
  creditsUsed: number,
  metadata?: { duration?: number; resolution?: string }
) {
  const durationText = metadata?.duration ? ` (${metadata.duration}s)` : ''

  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'VIDEO',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description: `Geração de vídeo${durationText}`,
    referenceId: videoId,
    metadata
  })
}

/**
 * Registra recebimento de créditos por renovação de assinatura
 */
export async function recordSubscriptionRenewal(
  userId: string,
  creditsReceived: number,
  metadata?: { plan?: string; billingCycle?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'EARNED',
    source: 'SUBSCRIPTION',
    amount: Math.abs(creditsReceived), // Sempre positivo
    description: `Renovação de assinatura${metadata?.plan ? ` - ${metadata.plan}` : ''}`,
    metadata
  })
}

/**
 * Registra recebimento de créditos por compra de pacote
 */
export async function recordCreditPurchase(
  userId: string,
  creditPurchaseId: string,
  creditsReceived: number,
  metadata?: { packageId?: string; packageName?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'EARNED',
    source: 'PURCHASE',
    amount: Math.abs(creditsReceived), // Sempre positivo
    description: `Compra de pacote de créditos${metadata?.packageName ? `: ${metadata.packageName}` : ''}`,
    creditPurchaseId,
    metadata
  })
}

/**
 * Registra recebimento de créditos bônus
 */
export async function recordBonusCredits(
  userId: string,
  creditsReceived: number,
  description: string,
  metadata?: any
) {
  return createCreditTransaction({
    userId,
    type: 'EARNED',
    source: 'BONUS',
    amount: Math.abs(creditsReceived), // Sempre positivo
    description,
    metadata
  })
}

/**
 * Registra expiração de créditos
 */
export async function recordCreditExpiration(
  userId: string,
  creditsExpired: number,
  creditPurchaseId?: string,
  metadata?: { reason?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'EXPIRED',
    source: 'EXPIRATION',
    amount: -Math.abs(creditsExpired), // Sempre negativo
    description: `Créditos expirados${metadata?.reason ? `: ${metadata.reason}` : ''}`,
    creditPurchaseId,
    metadata
  })
}

/**
 * Registra gasto de créditos em ativação de pacote de fotos
 */
export async function recordPhotoPackagePurchase(
  userId: string,
  userPackageId: string,
  creditsUsed: number,
  metadata?: { packageName?: string }
) {
  return createCreditTransaction({
    userId,
    type: 'SPENT',
    source: 'GENERATION',
    amount: -Math.abs(creditsUsed), // Sempre negativo
    description: `Pacote de fotos: ${metadata?.packageName || 'Sem nome'}`,
    referenceId: userPackageId,
    metadata
  })
}
