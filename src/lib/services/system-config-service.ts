import { prisma } from '@/lib/prisma'

/**
 * Get active plan format from system_config
 */
export async function getActivePlanFormat(): Promise<'TRADITIONAL' | 'MEMBERSHIP'> {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { key: 'active_plan_format' }
    })

    if (!config || !config.value) {
      console.log('⚠️ No active_plan_format found in system_config, defaulting to TRADITIONAL')
      return 'TRADITIONAL'
    }

    // Parse JSON value
    const data = typeof config.value === 'string'
      ? JSON.parse(config.value)
      : config.value

    const format = data.format || 'TRADITIONAL'

    console.log(`📋 Active plan format: ${format}`)

    return format === 'MEMBERSHIP' ? 'MEMBERSHIP' : 'TRADITIONAL'
  } catch (error) {
    console.error('❌ Error getting active plan format:', error)
    return 'TRADITIONAL' // Default fallback
  }
}

/**
 * Set active plan format in system_config
 */
export async function setActivePlanFormat(format: 'TRADITIONAL' | 'MEMBERSHIP'): Promise<void> {
  try {
    const value = JSON.stringify({ format })

    await prisma.systemConfig.upsert({
      where: { key: 'active_plan_format' },
      create: {
        key: 'active_plan_format',
        value
      },
      update: {
        value,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Active plan format set to: ${format}`)
  } catch (error) {
    console.error('❌ Error setting active plan format:', error)
    throw error
  }
}

/**
 * Initialize system config with default plan format (TRADITIONAL)
 * Run this once on first deployment
 */
export async function initializeSystemConfig(): Promise<void> {
  try {
    const existing = await prisma.systemConfig.findFirst({
      where: { key: 'active_plan_format' }
    })

    if (!existing) {
      await setActivePlanFormat('TRADITIONAL')
      console.log('✅ System config initialized with TRADITIONAL format')
    } else {
      console.log('ℹ️ System config already initialized')
    }
  } catch (error) {
    console.error('❌ Error initializing system config:', error)
    throw error
  }
}
