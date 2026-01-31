/**
 * Seed para criar planos do Formato B (Membership)
 *
 * Formato B:
 * - 1 plano (Membership)
 * - 3 ciclos: Trimestral (3 meses), Semestral (6 meses), Anual (12 meses)
 * - Créditos fixos por ciclo (não acumulam, expiram no fim do período)
 * - Valores mais altos, posicionamento premium
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedMembershipPlans() {
  console.log('🌱 [SEED] Iniciando seed dos planos Membership (Formato B)...')

  try {
    // 1. Membership Trimestral (3 meses)
    const quarterly = await prisma.subscriptionPlan.upsert({
      where: { planId: 'MEMBERSHIP_QUARTERLY' },
      update: {},
      create: {
        planId: 'MEMBERSHIP_QUARTERLY',
        name: 'Membership Trimestral',
        description: 'Plano membership com renovação a cada 3 meses. Créditos fixos por ciclo.',
        planType: 'PAID',
        planFormat: 'MEMBERSHIP',
        isActive: true,
        popular: false,
        displayOrder: 10, // Exibir após planos tradicionais (0-2)
        color: 'blue',

        // Billing details
        billingCycle: 'QUARTERLY',
        cycleDurationMonths: 3,
        minimumCommitmentMonths: 3,

        // Pricing
        monthlyPrice: 997, // Valor total do ciclo (não é mensal)
        annualPrice: 997 * 4, // 4 trimestres
        monthlyEquivalent: 997 / 3, // ~332/mês

        // Credits
        credits: 2100, // Créditos mensais equivalentes (apenas para compatibilidade - NÃO USADO)
        cycleCredits: 2100, // Créditos FIXOS por ciclo (usado no formato B)

        // Limits
        models: 1,
        resolution: '2048x2048',
        features: [
          '2.100 créditos a cada 3 meses',
          '210 fotos por ciclo',
          '1 modelo de IA incluído',
          'Máxima resolução',
          'Pacotes premium inclusos',
          'Créditos válidos durante o ciclo',
          'Suporte prioritário'
        ]
      }
    })
    console.log(`✅ Criado/atualizado: ${quarterly.name}`)

    // 2. Membership Semestral (6 meses)
    const semiAnnual = await prisma.subscriptionPlan.upsert({
      where: { planId: 'MEMBERSHIP_SEMI_ANNUAL' },
      update: {},
      create: {
        planId: 'MEMBERSHIP_SEMI_ANNUAL',
        name: 'Membership Semestral',
        description: 'Plano membership com renovação a cada 6 meses. Créditos fixos por ciclo.',
        planType: 'PAID',
        planFormat: 'MEMBERSHIP',
        isActive: true,
        popular: true, // Mais popular
        displayOrder: 11,
        color: 'purple',

        // Billing details
        billingCycle: 'SEMI_ANNUAL',
        cycleDurationMonths: 6,
        minimumCommitmentMonths: 3,

        // Pricing
        monthlyPrice: 1897, // Valor total do ciclo
        annualPrice: 1897 * 2, // 2 semestres
        monthlyEquivalent: 1897 / 6, // ~316/mês

        // Credits
        credits: 4500,
        cycleCredits: 4500, // Créditos FIXOS por ciclo

        // Limits
        models: 1,
        resolution: '2048x2048',
        features: [
          '4.500 créditos a cada 6 meses',
          '450 fotos por ciclo',
          '1 modelo de IA incluído',
          'Máxima resolução',
          'Todos os pacotes premium',
          'Créditos válidos durante o ciclo',
          'Suporte VIP'
        ]
      }
    })
    console.log(`✅ Criado/atualizado: ${semiAnnual.name}`)

    // 3. Membership Anual (12 meses)
    const annual = await prisma.subscriptionPlan.upsert({
      where: { planId: 'MEMBERSHIP_ANNUAL' },
      update: {},
      create: {
        planId: 'MEMBERSHIP_ANNUAL',
        name: 'Membership Anual',
        description: 'Plano membership com renovação anual. Créditos fixos por ciclo. Melhor custo-benefício.',
        planType: 'PAID',
        planFormat: 'MEMBERSHIP',
        isActive: true,
        popular: false,
        displayOrder: 12,
        color: 'yellow',

        // Billing details
        billingCycle: 'ANNUAL',
        cycleDurationMonths: 12,
        minimumCommitmentMonths: 3,

        // Pricing
        monthlyPrice: 3587, // Valor total do ciclo
        annualPrice: 3587,
        monthlyEquivalent: 3587 / 12, // ~299/mês

        // Credits
        credits: 9600,
        cycleCredits: 9600, // Créditos FIXOS por ciclo

        // Limits
        models: 1,
        resolution: '2048x2048',
        features: [
          '9.600 créditos por ano',
          '960 fotos por ano',
          '1 modelo de IA incluído',
          'Máxima resolução',
          'Todos os pacotes premium',
          'API de integração',
          'Créditos válidos durante o ano',
          'Suporte VIP + consultoria'
        ]
      }
    })
    console.log(`✅ Criado/atualizado: ${annual.name}`)

    console.log('✅ [SEED] Planos Membership criados com sucesso!')
  } catch (error) {
    console.error('❌ [SEED] Erro ao criar planos Membership:', error)
    throw error
  }
}

async function main() {
  await seedMembershipPlans()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
