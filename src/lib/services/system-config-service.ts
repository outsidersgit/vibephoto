import { prisma } from '@/lib/prisma'

/**
 * Sistema de Configuração - Armazena configurações globais do sistema
 * Usado para alternar entre formatos de planos sem necessidade de deploy
 */

export type PlanFormatType = 'TRADITIONAL' | 'MEMBERSHIP'

const ACTIVE_PLAN_FORMAT_KEY = 'active_plan_format'

/**
 * Buscar formato de plano ativo (Formato A ou Formato B)
 * Default: TRADITIONAL (Formato A)
 */
export async function getActivePlanFormat(): Promise<PlanFormatType> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: ACTIVE_PLAN_FORMAT_KEY }
    })

    if (!config || !config.value) {
      console.log('⚠️ [SYSTEM_CONFIG] Formato de plano não configurado, usando TRADITIONAL (padrão)')
      return 'TRADITIONAL'
    }

    // Value is stored as Json, extract the format
    const format = (config.value as any).format || 'TRADITIONAL'
    console.log(`✅ [SYSTEM_CONFIG] Formato ativo: ${format}`)

    return format as PlanFormatType
  } catch (error) {
    console.error('❌ [SYSTEM_CONFIG] Erro ao buscar formato ativo:', error)
    // Fallback to TRADITIONAL in case of error
    return 'TRADITIONAL'
  }
}

/**
 * Definir formato de plano ativo (Admin only)
 * @param format 'TRADITIONAL' (Formato A) ou 'MEMBERSHIP' (Formato B)
 */
export async function setActivePlanFormat(format: PlanFormatType): Promise<boolean> {
  try {
    console.log(`🔄 [SYSTEM_CONFIG] Alterando formato ativo para: ${format}`)

    await prisma.systemConfig.upsert({
      where: { key: ACTIVE_PLAN_FORMAT_KEY },
      update: {
        value: { format },
        updatedAt: new Date()
      },
      create: {
        key: ACTIVE_PLAN_FORMAT_KEY,
        value: { format }
      }
    })

    console.log(`✅ [SYSTEM_CONFIG] Formato alterado com sucesso para: ${format}`)
    return true
  } catch (error) {
    console.error('❌ [SYSTEM_CONFIG] Erro ao alterar formato ativo:', error)
    return false
  }
}

/**
 * Inicializar configuração com valor padrão (se não existir)
 * Chamado no seed ou na primeira execução
 */
export async function initializeSystemConfig(): Promise<void> {
  try {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: ACTIVE_PLAN_FORMAT_KEY }
    })

    if (!existing) {
      await prisma.systemConfig.create({
        data: {
          key: ACTIVE_PLAN_FORMAT_KEY,
          value: { format: 'TRADITIONAL' }
        }
      })
      console.log('✅ [SYSTEM_CONFIG] Configuração inicializada com TRADITIONAL')
    } else {
      console.log('✅ [SYSTEM_CONFIG] Configuração já existe')
    }
  } catch (error) {
    console.error('❌ [SYSTEM_CONFIG] Erro ao inicializar configuração:', error)
  }
}

/**
 * Buscar todas as configurações do sistema (para debug/admin)
 */
export async function getAllSystemConfigs() {
  try {
    const configs = await prisma.systemConfig.findMany()
    return configs
  } catch (error) {
    console.error('❌ [SYSTEM_CONFIG] Erro ao buscar configs:', error)
    return []
  }
}
