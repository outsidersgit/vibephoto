import { NextRequest, NextResponse } from 'next/server'
import { AutoStorageService } from '@/lib/services/auto-storage-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🛑 Auto storage stop API called')
    
    // Stop the auto storage service
    const service = AutoStorageService.getInstance()
    service.stopMonitoring()

    return NextResponse.json({ 
      success: true, 
      message: 'Auto storage service stopped successfully' 
    })

  } catch (error) {
    console.error('❌ Error stopping auto storage service:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}