/**
 * Video Flow Debugger
 * Sistema de diagnóstico completo para identificar exatamente onde o fluxo de vídeo quebra
 */

import { prisma } from '@/lib/db'
import { VideoStatus } from '@/lib/ai/video/config'

export interface VideoFlowDiagnostic {
  videoId: string
  jobId: string | null
  timestamp: string
  stage: string
  status: 'OK' | 'WARNING' | 'ERROR' | 'MISSING'
  message: string
  data?: any
}

export interface CompleteFlowDiagnostic {
  videoId: string
  jobId: string | null
  overallStatus: 'HEALTHY' | 'BROKEN' | 'INCOMPLETE'
  stages: VideoFlowDiagnostic[]
  summary: {
    totalStages: number
    passed: number
    warnings: number
    errors: number
    missing: number
  }
  recommendations: string[]
}

/**
 * Diagnóstico completo do fluxo de vídeo
 */
export async function diagnoseVideoFlow(videoId: string): Promise<CompleteFlowDiagnostic> {
  const stages: VideoFlowDiagnostic[] = []
  const recommendations: string[] = []

  try {
    // Stage 1: Verificar se o vídeo existe no banco
    stages.push(await diagnoseStage1_RecordExists(videoId))
    
    const video = await prisma.videoGeneration.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!video) {
      return {
        videoId,
        jobId: null,
        overallStatus: 'BROKEN',
        stages,
        summary: {
          totalStages: stages.length,
          passed: 0,
          warnings: 0,
          errors: 1,
          missing: 1
        },
        recommendations: ['Vídeo não encontrado no banco de dados']
      }
    }

    // Stage 2: Verificar campos obrigatórios
    stages.push(await diagnoseStage2_RequiredFields(video))
    
    // Stage 3: Verificar jobId
    stages.push(await diagnoseStage3_JobId(video))
    
    // Stage 4: Verificar status
    stages.push(await diagnoseStage4_Status(video))
    
    // Stage 5: Verificar URLs (videoUrl e thumbnailUrl)
    stages.push(await diagnoseStage5_URLs(video))
    
    // Stage 6: Verificar storage
    stages.push(await diagnoseStage6_Storage(video))
    
    // Stage 7: Verificar timestamps
    stages.push(await diagnoseStage7_Timestamps(video))
    
    // Stage 8: Verificar metadata
    stages.push(await diagnoseStage8_Metadata(video))
    
    // Stage 9: Verificar se vídeo está acessível
    if (video.videoUrl) {
      stages.push(await diagnoseStage9_VideoAccessible(video.videoUrl))
    }
    
    // Stage 10: Verificar se thumbnail está acessível
    if (video.thumbnailUrl) {
      stages.push(await diagnoseStage10_ThumbnailAccessible(video.thumbnailUrl))
    }

    // Calcular resumo
    const summary = {
      totalStages: stages.length,
      passed: stages.filter(s => s.status === 'OK').length,
      warnings: stages.filter(s => s.status === 'WARNING').length,
      errors: stages.filter(s => s.status === 'ERROR').length,
      missing: stages.filter(s => s.status === 'MISSING').length
    }

    // Determinar status geral
    let overallStatus: 'HEALTHY' | 'BROKEN' | 'INCOMPLETE' = 'HEALTHY'
    if (summary.errors > 0) {
      overallStatus = 'BROKEN'
    } else if (summary.missing > 0 || summary.warnings > 0) {
      overallStatus = 'INCOMPLETE'
    }

    // Gerar recomendações
    if (summary.errors > 0) {
      recommendations.push('Corrigir erros críticos antes de continuar')
    }
    if (summary.missing > 0) {
      recommendations.push('Preencher campos obrigatórios faltantes')
    }
    if (summary.warnings > 0) {
      recommendations.push('Revisar avisos para melhorar a qualidade dos dados')
    }

    return {
      videoId,
      jobId: video.jobId,
      overallStatus,
      stages,
      summary,
      recommendations
    }

  } catch (error) {
    stages.push({
      videoId,
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: 'DIAGNOSTIC_ERROR',
      status: 'ERROR',
      message: `Erro ao executar diagnóstico: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.stack : undefined }
    })

    return {
      videoId,
      jobId: null,
      overallStatus: 'BROKEN',
      stages,
      summary: {
        totalStages: stages.length,
        passed: 0,
        warnings: 0,
        errors: 1,
        missing: 0
      },
      recommendations: ['Erro ao executar diagnóstico - verificar logs do servidor']
    }
  }
}

async function diagnoseStage1_RecordExists(videoId: string): Promise<VideoFlowDiagnostic> {
  try {
    const video = await prisma.videoGeneration.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      return {
        videoId,
        jobId: null,
        timestamp: new Date().toISOString(),
        stage: '1_RECORD_EXISTS',
        status: 'ERROR',
        message: 'Vídeo não encontrado no banco de dados',
        data: { videoId }
      }
    }

    return {
      videoId,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '1_RECORD_EXISTS',
      status: 'OK',
      message: 'Vídeo encontrado no banco de dados',
      data: { createdAt: video.createdAt }
    }
  } catch (error) {
    return {
      videoId,
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '1_RECORD_EXISTS',
      status: 'ERROR',
      message: `Erro ao verificar existência: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

async function diagnoseStage2_RequiredFields(video: any): Promise<VideoFlowDiagnostic> {
  const missing: string[] = []
  const warnings: string[] = []

  if (!video.userId) missing.push('userId')
  if (!video.prompt) missing.push('prompt')
  if (!video.duration) warnings.push('duration (usando default)')
  if (!video.aspectRatio) warnings.push('aspectRatio (usando default)')
  if (!video.quality) warnings.push('quality (usando default)')

  if (missing.length > 0) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '2_REQUIRED_FIELDS',
      status: 'ERROR',
      message: `Campos obrigatórios faltando: ${missing.join(', ')}`,
      data: { missing, warnings }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '2_REQUIRED_FIELDS',
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    message: warnings.length > 0 
      ? `Campos obrigatórios OK, mas alguns campos padrão: ${warnings.join(', ')}`
      : 'Todos os campos obrigatórios preenchidos',
    data: { warnings }
  }
}

async function diagnoseStage3_JobId(video: any): Promise<VideoFlowDiagnostic> {
  if (!video.jobId) {
    return {
      videoId: video.id,
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '3_JOB_ID',
      status: 'MISSING',
      message: 'jobId não está preenchido - vídeo pode não ter sido enviado ao Replicate',
      data: { status: video.status }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '3_JOB_ID',
    status: 'OK',
    message: `jobId preenchido: ${video.jobId}`,
    data: { jobId: video.jobId }
  }
}

async function diagnoseStage4_Status(video: any): Promise<VideoFlowDiagnostic> {
  const validStatuses = ['STARTING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
  
  if (!video.status) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '4_STATUS',
      status: 'ERROR',
      message: 'Status não está preenchido',
      data: {}
    }
  }

  if (!validStatuses.includes(video.status)) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '4_STATUS',
      status: 'ERROR',
      message: `Status inválido: ${video.status}`,
      data: { status: video.status, validStatuses }
    }
  }

  if (video.status === 'COMPLETED' && !video.videoUrl) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '4_STATUS',
      status: 'ERROR',
      message: 'Status é COMPLETED mas videoUrl não está preenchido',
      data: { status: video.status }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '4_STATUS',
    status: 'OK',
    message: `Status válido: ${video.status}`,
    data: { status: video.status, progress: video.progress }
  }
}

async function diagnoseStage5_URLs(video: any): Promise<VideoFlowDiagnostic> {
  const issues: string[] = []
  const warnings: string[] = []

  if (video.status === 'COMPLETED') {
    if (!video.videoUrl) {
      issues.push('videoUrl não preenchido para vídeo COMPLETED')
    } else {
      // Verificar se é URL permanente ou temporária
      const isPermanent = video.videoUrl.includes('amazonaws.com') || 
                         video.videoUrl.includes('cloudfront.net') ||
                         video.videoUrl.includes('s3')
      if (!isPermanent) {
        warnings.push('videoUrl parece ser temporária (Replicate), não permanente (S3)')
      }
    }
  }

  if (video.status === 'COMPLETED' && !video.thumbnailUrl) {
    warnings.push('thumbnailUrl não preenchido (opcional mas recomendado)')
  }

  if (issues.length > 0) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '5_URLS',
      status: 'ERROR',
      message: issues.join('; '),
      data: { issues, warnings, videoUrl: video.videoUrl, thumbnailUrl: video.thumbnailUrl }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '5_URLS',
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    message: warnings.length > 0 
      ? `URLs OK, mas: ${warnings.join('; ')}`
      : 'URLs preenchidas corretamente',
    data: { warnings, videoUrl: video.videoUrl, thumbnailUrl: video.thumbnailUrl }
  }
}

async function diagnoseStage6_Storage(video: any): Promise<VideoFlowDiagnostic> {
  const missing: string[] = []
  const warnings: string[] = []

  if (video.status === 'COMPLETED' && video.videoUrl) {
    const isPermanent = video.videoUrl.includes('amazonaws.com') || 
                       video.videoUrl.includes('cloudfront.net')
    
    if (isPermanent) {
      if (!video.storageProvider) missing.push('storageProvider')
      if (!video.publicUrl) missing.push('publicUrl')
      if (!video.storageKey) warnings.push('storageKey (opcional mas útil)')
      if (!video.mimeType) warnings.push('mimeType (opcional mas útil)')
    }
  }

  if (missing.length > 0) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '6_STORAGE',
      status: 'MISSING',
      message: `Campos de storage faltando: ${missing.join(', ')}`,
      data: { missing, warnings, storageProvider: video.storageProvider, publicUrl: video.publicUrl }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '6_STORAGE',
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    message: warnings.length > 0 
      ? `Storage OK, mas: ${warnings.join('; ')}`
      : 'Campos de storage preenchidos corretamente',
    data: { warnings, storageProvider: video.storageProvider, publicUrl: video.publicUrl, storageKey: video.storageKey }
  }
}

async function diagnoseStage7_Timestamps(video: any): Promise<VideoFlowDiagnostic> {
  const missing: string[] = []
  const warnings: string[] = []

  if (!video.createdAt) missing.push('createdAt')
  if (!video.updatedAt) missing.push('updatedAt')

  if (video.status === 'COMPLETED' && !video.processingCompletedAt) {
    missing.push('processingCompletedAt')
  }

  if (video.status === 'PROCESSING' && !video.processingStartedAt) {
    warnings.push('processingStartedAt não definido (opcional mas útil)')
  }

  if (missing.length > 0) {
    return {
      videoId: video.id,
      jobId: video.jobId,
      timestamp: new Date().toISOString(),
      stage: '7_TIMESTAMPS',
      status: 'MISSING',
      message: `Timestamps faltando: ${missing.join(', ')}`,
      data: { missing, warnings }
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '7_TIMESTAMPS',
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    message: warnings.length > 0 
      ? `Timestamps OK, mas: ${warnings.join('; ')}`
      : 'Timestamps preenchidos corretamente',
    data: { warnings }
  }
}

async function diagnoseStage8_Metadata(video: any): Promise<VideoFlowDiagnostic> {
  const metadata = video.metadata as any || {}
  const warnings: string[] = []

  if (video.status === 'COMPLETED') {
    if (!metadata.stored) warnings.push('metadata.stored não definido')
    if (!metadata.processedAt) warnings.push('metadata.processedAt não definido')
    if (!metadata.originalUrl && !metadata.temporaryVideoUrl) {
      warnings.push('metadata.originalUrl ou temporaryVideoUrl não definido')
    }
  }

  return {
    videoId: video.id,
    jobId: video.jobId,
    timestamp: new Date().toISOString(),
    stage: '8_METADATA',
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    message: warnings.length > 0 
      ? `Metadata OK, mas: ${warnings.join('; ')}`
      : 'Metadata preenchida corretamente',
    data: { warnings, hasMetadata: !!video.metadata }
  }
}

async function diagnoseStage9_VideoAccessible(videoUrl: string): Promise<VideoFlowDiagnostic> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

    const response = await fetch(videoUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'VibePhoto-Diagnostic/1.0' }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        videoId: 'unknown',
        jobId: null,
        timestamp: new Date().toISOString(),
        stage: '9_VIDEO_ACCESSIBLE',
        status: 'ERROR',
        message: `Vídeo não acessível: HTTP ${response.status} ${response.statusText}`,
        data: { status: response.status, statusText: response.statusText, url: videoUrl }
      }
    }

    const contentType = response.headers.get('content-type')
    const contentLength = response.headers.get('content-length')

    return {
      videoId: 'unknown',
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '9_VIDEO_ACCESSIBLE',
      status: 'OK',
      message: 'Vídeo acessível e válido',
      data: { 
        contentType, 
        contentLength,
        status: response.status,
        url: videoUrl.substring(0, 100) + '...'
      }
    }

  } catch (error) {
    return {
      videoId: 'unknown',
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '9_VIDEO_ACCESSIBLE',
      status: 'ERROR',
      message: `Erro ao verificar acessibilidade: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.stack : undefined, url: videoUrl.substring(0, 100) + '...' }
    }
  }
}

async function diagnoseStage10_ThumbnailAccessible(thumbnailUrl: string): Promise<VideoFlowDiagnostic> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos

    const response = await fetch(thumbnailUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'VibePhoto-Diagnostic/1.0' }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        videoId: 'unknown',
        jobId: null,
        timestamp: new Date().toISOString(),
        stage: '10_THUMBNAIL_ACCESSIBLE',
        status: 'WARNING',
        message: `Thumbnail não acessível: HTTP ${response.status} ${response.statusText}`,
        data: { status: response.status, statusText: response.statusText, url: thumbnailUrl }
      }
    }

    return {
      videoId: 'unknown',
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '10_THUMBNAIL_ACCESSIBLE',
      status: 'OK',
      message: 'Thumbnail acessível e válido',
      data: { 
        contentType: response.headers.get('content-type'),
        status: response.status,
        url: thumbnailUrl.substring(0, 100) + '...'
      }
    }

  } catch (error) {
    return {
      videoId: 'unknown',
      jobId: null,
      timestamp: new Date().toISOString(),
      stage: '10_THUMBNAIL_ACCESSIBLE',
      status: 'WARNING',
      message: `Erro ao verificar thumbnail: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.stack : undefined, url: thumbnailUrl.substring(0, 100) + '...' }
    }
  }
}

