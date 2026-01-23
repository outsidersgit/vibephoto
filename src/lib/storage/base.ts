export interface UploadResult {
  url: string
  key: string
  publicId?: string
  originalName: string
  size: number
  mimeType: string
  thumbnailUrl?: string
  webpUrl?: string  // Fase 3 - WebP format (30-50% menor)
  avifUrl?: string  // Fase 3 - AVIF format (50-60% menor)
}

export interface UploadOptions {
  folder?: string
  filename?: string
  quality?: number
  maxWidth?: number
  maxHeight?: number
  generateThumbnail?: boolean
  makePublic?: boolean
  isVideo?: boolean
  isUpscale?: boolean  // Flag to indicate upscale image (allows larger file size)
  generateModernFormats?: boolean  // Fase 3 - Gerar WebP/AVIF (default: true)
}

export interface FileValidation {
  isValid: boolean
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

export abstract class StorageProvider {
  abstract upload(
    file: File | Buffer,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult>
  
  abstract delete(key: string): Promise<DeleteResult>
  
  abstract getPublicUrl(key: string): string
  
  abstract validateFile(file: File, isVideo?: boolean, isUpscale?: boolean): FileValidation
  
  abstract generateThumbnail(
    sourceKey: string,
    thumbnailPath: string
  ): Promise<UploadResult>

  abstract uploadFromUrl(
    url: string,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult>

  abstract getSignedUrl(
    key: string,
    expiresIn?: number
  ): Promise<string>
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'StorageError'
  }
}