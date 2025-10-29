/**
 * Converte URLs S3 antigas para CloudFront
 *
 * IMPORTANTE: Apenas converte URLs S3 do nosso bucket.
 * URLs externas (Astria, Replicate, etc) são mantidas intactas.
 */

const CLOUDFRONT_URL = process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_URL || ''

/**
 * Converte URL S3 para CloudFront (se for S3 do nosso bucket)
 * @param url URL original (S3, CloudFront, Astria, Replicate, etc)
 * @returns URL otimizada (CloudFront se S3, original caso contrário)
 */
export function toCloudFrontUrl(url: string | null | undefined): string {
  // Retorna vazio se não houver URL
  if (!url) return ''

  // Se CloudFront não estiver configurado, retorna original
  if (!CLOUDFRONT_URL) return url

  // Se já for CloudFront, retorna sem modificar
  if (url.includes('cloudfront.net')) return url

  // Se for URL externa (Astria, Replicate, etc), retorna original
  if (url.includes('astria.ai') ||
      url.includes('replicate.delivery') ||
      url.includes('replicate.com')) {
    return url
  }

  // Detecta qualquer URL S3 da AWS
  const s3Patterns = [
    /https?:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/,  // bucket.s3.region.amazonaws.com/path
    /https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)/,           // bucket.s3.amazonaws.com/path
    /https?:\/\/s3\.([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/,  // s3.region.amazonaws.com/bucket/path
    /https?:\/\/s3\.amazonaws\.com\/([^/]+)\/(.+)/,           // s3.amazonaws.com/bucket/path
  ]

  for (const pattern of s3Patterns) {
    const match = url.match(pattern)
    if (match) {
      // Extrai o path (último grupo capturado)
      const path = match[match.length - 1]
      return `${CLOUDFRONT_URL}/${path}`
    }
  }

  // Se não encontrou padrão S3, retorna original (importante para URLs externas)
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
