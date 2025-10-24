import { NextRequest, NextResponse } from 'next/server'
import { AutoStorageService } from '@/lib/services/auto-storage-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔧 Manual fix storage API called by user:', session.user.email)
    
    // Force check all generations immediately
    const service = AutoStorageService.getInstance()
    
    // Run a manual check immediately
    console.log('🚀 Running manual storage check for existing generations...')
    await (service as any).checkAndSaveImages()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Manual storage check completed - check console for results' 
    })

  } catch (error) {
    console.error('❌ Error in manual storage fix:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}