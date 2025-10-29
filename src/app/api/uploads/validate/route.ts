import { NextRequest, NextResponse } from 'next/server'

type ValidationInput = {
  facePhotoUrls?: string[]
  halfBodyPhotoUrls?: string[]
  fullBodyPhotoUrls?: string[]
  enforceDomain?: boolean
  maxSizeMB?: number
}

const DEFAULT_MAX_MB = 15

function getAllowedHosts(): string[] {
  const hosts: string[] = []
  const region = process.env.AWS_REGION
  const bucket = process.env.AWS_S3_BUCKET
  const cloudfront = process.env.AWS_CLOUDFRONT_URL

  if (bucket && region) {
    hosts.push(`${bucket}.s3.${region}.amazonaws.com`)
  }
  if (cloudfront) {
    try {
      const u = new URL(cloudfront)
      hosts.push(u.host)
    } catch {}
  }
  return hosts
}

function isUrlFromAllowedHost(urlStr: string, allowedHosts: string[]): boolean {
  try {
    const u = new URL(urlStr)
    return allowedHosts.includes(u.host)
  } catch {
    return false
  }
}

async function headOk(urlStr: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; contentType?: string; contentLength?: number }>{
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(urlStr, { method: 'HEAD', signal: controller.signal })
    clearTimeout(t)
    const contentType = res.headers.get('content-type') || undefined
    const lenRaw = res.headers.get('content-length')
    const contentLength = lenRaw ? parseInt(lenRaw, 10) : undefined
    return { ok: res.ok, status: res.status, contentType, contentLength }
  } catch {
    return { ok: false }
  }
}

function normalizeList(list?: string[]): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of list) {
    if (typeof u !== 'string') continue
    const trimmed = u.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ValidationInput
    const enforceDomain = body.enforceDomain !== false
    const maxSizeMB = Math.max(1, Math.min(100, body.maxSizeMB || DEFAULT_MAX_MB))
    const maxBytes = maxSizeMB * 1024 * 1024

    const face = normalizeList(body.facePhotoUrls)
    const half = normalizeList(body.halfBodyPhotoUrls)
    const full = normalizeList(body.fullBodyPhotoUrls)

    const allowedHosts = getAllowedHosts()
    const all = [
      ...face.map(u => ({ url: u, category: 'face' })),
      ...half.map(u => ({ url: u, category: 'half-body' })),
      ...full.map(u => ({ url: u, category: 'full-body' }))
    ]

    const errors: { url: string; reason: string }[] = []
    const validFace: string[] = []
    const validHalf: string[] = []
    const validFull: string[] = []

    for (const item of all) {
      const { url, category } = item

      // domínio permitido
      if (enforceDomain && allowedHosts.length > 0 && !isUrlFromAllowedHost(url, allowedHosts)) {
        errors.push({ url, reason: 'host_not_allowed' })
        continue
      }

      // disponibilidade e metadados via HEAD
      const head = await headOk(url, 15000)
      if (!head.ok) {
        errors.push({ url, reason: 'head_request_failed' })
        continue
      }

      // tipo de conteúdo
      if (!head.contentType || !head.contentType.toLowerCase().startsWith('image/')) {
        errors.push({ url, reason: 'invalid_content_type' })
        continue
      }

      // tamanho máximo (se informado pelo servidor)
      if (typeof head.contentLength === 'number' && head.contentLength > maxBytes) {
        errors.push({ url, reason: 'content_length_exceeds_limit' })
        continue
      }

      if (category === 'face') validFace.push(url)
      else if (category === 'half-body') validHalf.push(url)
      else validFull.push(url)
    }

    const valid = errors.length === 0
    return NextResponse.json({
      valid,
      normalized: {
        facePhotoUrls: validFace,
        halfBodyPhotoUrls: validHalf,
        fullBodyPhotoUrls: validFull
      },
      errors,
      constraints: {
        enforceDomain,
        allowedHosts,
        maxSizeMB
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao validar URLs' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}


