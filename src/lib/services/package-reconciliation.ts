import { prisma } from '@/lib/db'
import { PackageStatus } from '@prisma/client'

/**
 * Reconciles a UserPackage status based on the actual state of its generations
 * This ensures the package status accurately reflects what's happening with the generations
 */
export async function reconcileUserPackageStatus(userPackageId: string): Promise<{
  success: boolean
  previousStatus: PackageStatus
  newStatus: PackageStatus
  updated: boolean
  stats: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }
  error?: string
}> {
  try {
    // Get the user package
    const userPackage = await prisma.userPackage.findUnique({
      where: { id: userPackageId },
      include: {
        package: true
      }
    })

    if (!userPackage) {
      return {
        success: false,
        previousStatus: 'ACTIVE',
        newStatus: 'ACTIVE',
        updated: false,
        stats: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
        error: 'UserPackage not found'
      }
    }

    const previousStatus = userPackage.status

    // Count generations by status
    const [pending, processing, completed, failed, total] = await Promise.all([
      prisma.generation.count({
        where: {
          packageId: userPackageId,
          status: 'PENDING'
        }
      }),
      prisma.generation.count({
        where: {
          packageId: userPackageId,
          status: 'PROCESSING'
        }
      }),
      prisma.generation.count({
        where: {
          packageId: userPackageId,
          status: 'COMPLETED'
        }
      }),
      prisma.generation.count({
        where: {
          packageId: userPackageId,
          status: 'FAILED'
        }
      }),
      prisma.generation.count({
        where: {
          packageId: userPackageId
        }
      })
    ])

    const stats = {
      total,
      pending,
      processing,
      completed,
      failed
    }

    // Determine new status based on generation states
    let newStatus: PackageStatus = userPackage.status
    let shouldUpdate = false

    if (total === 0) {
      // No generations created - package is stuck in ACTIVE/GENERATING
      // If it's been more than 5 minutes since creation, mark as FAILED
      const createdAt = new Date(userPackage.createdAt)
      const now = new Date()
      const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60)

      if (minutesSinceCreation > 5) {
        newStatus = 'FAILED'
        shouldUpdate = true
        console.log(`⚠️ Package ${userPackageId} has no generations after ${minutesSinceCreation.toFixed(1)} minutes - marking as FAILED`)
      } else {
        // Still within grace period, keep as ACTIVE
        newStatus = 'ACTIVE'
        shouldUpdate = userPackage.status !== 'ACTIVE'
      }
    } else if (pending > 0 || processing > 0) {
      // Has generations in progress
      newStatus = 'GENERATING'
      shouldUpdate = userPackage.status !== 'GENERATING'
    } else if (completed + failed === total) {
      // All generations finished
      if (failed === total) {
        // All failed
        newStatus = 'FAILED'
        shouldUpdate = userPackage.status !== 'FAILED'
      } else if (completed > 0) {
        // At least some completed
        newStatus = 'COMPLETED'
        shouldUpdate = userPackage.status !== 'COMPLETED'
      }
    }

    // Update if needed
    if (shouldUpdate || userPackage.generatedImages !== completed || userPackage.failedImages !== failed) {
      await prisma.userPackage.update({
        where: { id: userPackageId },
        data: {
          status: newStatus,
          generatedImages: completed,
          failedImages: failed,
          ...(newStatus === 'COMPLETED' && { completedAt: new Date() }),
          ...(newStatus === 'FAILED' && !userPackage.errorMessage && {
            errorMessage: total === 0 
              ? 'Nenhuma geração foi criada. O pacote pode ter falhado ao iniciar.'
              : failed === total
              ? 'Todas as gerações falharam.'
              : 'Pacote concluído com falhas.'
          })
        }
      })

      console.log(`✅ Reconciled package ${userPackageId}: ${previousStatus} → ${newStatus}`, {
        stats,
        generatedImages: completed,
        failedImages: failed
      })

      return {
        success: true,
        previousStatus,
        newStatus,
        updated: true,
        stats
      }
    }

    return {
      success: true,
      previousStatus,
      newStatus,
      updated: false,
      stats
    }
  } catch (error) {
    console.error(`❌ Error reconciling package ${userPackageId}:`, error)
    return {
      success: false,
      previousStatus: 'ACTIVE',
      newStatus: 'ACTIVE',
      updated: false,
      stats: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Reconciles all stuck packages (ACTIVE or GENERATING with no active generations)
 */
export async function reconcileAllStuckPackages(): Promise<{
  total: number
  reconciled: number
  results: Array<{
    userPackageId: string
    previousStatus: PackageStatus
    newStatus: PackageStatus
    updated: boolean
  }>
}> {
  try {
    // Find all packages that are ACTIVE or GENERATING
    const stuckPackages = await prisma.userPackage.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'GENERATING']
        }
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    })

    console.log(`🔍 Found ${stuckPackages.length} potentially stuck packages`)

    const results = []
    let reconciled = 0

    for (const pkg of stuckPackages) {
      const result = await reconcileUserPackageStatus(pkg.id)
      results.push({
        userPackageId: pkg.id,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        updated: result.updated
      })
      if (result.updated) {
        reconciled++
      }
    }

    console.log(`✅ Reconciled ${reconciled} of ${stuckPackages.length} packages`)

    return {
      total: stuckPackages.length,
      reconciled,
      results
    }
  } catch (error) {
    console.error('❌ Error reconciling all stuck packages:', error)
    throw error
  }
}

