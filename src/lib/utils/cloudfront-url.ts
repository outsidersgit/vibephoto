/**
 * Converte URLs S3 antigas para CloudFront
 *
 * Problema: URLs salvas no banco antes da implementação do CloudFront
 * são diretas do S3 (ensaio-fotos-prod.s3.us-east-2.amazonaws.com)
 *
 * Solução: Substituir dinamicamente no frontend por CloudFront URLs
 */

const CLOUDFRONT_URL = process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_URL || ''
const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'ensaio-fotos-prod'
const S3_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'

// Possíveis formatos de URL S3
const S3_URL_PATTERNS = [
  `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`,
  `${S3_BUCKET}.s3.amazonaws.com`,
  `s3.${S3_REGION}.amazonaws.com/${S3_BUCKET}`,
  `s3.amazonaws.com/${S3_BUCKET}`,
]

/**
 * Converte URL S3 para CloudFront (se CloudFront estiver configurado)
 * @param url URL original (pode ser S3 ou já CloudFront)
 * @returns URL otimizada com CloudFront
 */
export function toCloudFrontUrl(url: string | null | undefined): string {
  // Retorna vazio se não houver URL
  if (!url) return ''

  // Se CloudFront não estiver configurado, retorna original
  if (!CLOUDFRONT_URL) return url

  // Se já for CloudFront, retorna sem modificar
  if (url.includes('cloudfront.net')) return url

  // Tenta encontrar e substituir padrão S3 por CloudFront
  for (const pattern of S3_URL_PATTERNS) {
    if (url.includes(pattern)) {
      // Extrai o path (tudo depois do bucket/região)
      const pathMatch = url.match(new RegExp(`${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.*)`))

      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1]
        return `${CLOUDFRONT_URL}/${path}`
      }
    }
  }

  // Se não encontrou padrão S3, retorna original
  return url
}

/**
 * Converte array de URLs S3 para CloudFront
 */
export function toCloudFrontUrls(urls: (string | null | undefined)[]): string[] {
  return urls.map(toCloudFrontUrl).filter(Boolean) as string[]
}

/**
 * Converte objeto com URLs para CloudFront
 * Útil para objetos de geração com múltiplas URLs
 */
export function convertGenerationUrls<T extends Record<string, any>>(generation: T): T {
  const converted = { ...generation }

  // Converter campos conhecidos
  if (converted.imageUrls && Array.isArray(converted.imageUrls)) {
    converted.imageUrls = toCloudFrontUrls(converted.imageUrls)
  }

  if (converted.thumbnailUrls && Array.isArray(converted.thumbnailUrls)) {
    converted.thumbnailUrls = toCloudFrontUrls(converted.thumbnailUrls)
  }

  if (converted.videoUrl && typeof converted.videoUrl === 'string') {
    converted.videoUrl = toCloudFrontUrl(converted.videoUrl)
  }

  if (converted.thumbnailUrl && typeof converted.thumbnailUrl === 'string') {
    converted.thumbnailUrl = toCloudFrontUrl(converted.thumbnailUrl)
  }

  if (converted.originalImageUrl && typeof converted.originalImageUrl === 'string') {
    converted.originalImageUrl = toCloudFrontUrl(converted.originalImageUrl)
  }

  return converted
}
