import { Plan, ModelStatus, ModelClass, GenerationStatus, PackageCategory, PackageStatus, Gender } from '@prisma/client'

export type {
  Plan,
  ModelStatus,
  ModelClass,
  GenerationStatus,
  PackageCategory,
  PackageStatus,
  Gender
}

// Media types for gallery operations
export type MediaOperationType = "generated" | "edited" | "video"

// Extended media information for gallery
export interface MediaItem {
  id: string
  url: string
  originalUrl?: string
  thumbnailUrl?: string
  operationType: MediaOperationType
  status: GenerationStatus
  metadata?: {
    width?: number
    height?: number
    format?: string
    sizeBytes?: number
    duration?: number // for videos
  }
  generation?: Generation
  creditsCost?: number // Cost in credits for this operation
}

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  plan: Plan
  creditsUsed: number
  creditsLimit: number
  totalModels: number
  totalGenerations: number
  // totalCreditsUsed calculated from usage logs, not stored in DB
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface AIModel {
  id: string
  name: string
  class: ModelClass
  status: ModelStatus
  progress: number
  totalPhotos: number
  qualityScore?: number
  createdAt: Date
  updatedAt: Date
  trainedAt?: Date
  userId: string
}

export interface Generation {
  id: string
  prompt: string
  negativePrompt?: string
  aspectRatio: string
  resolution: string
  variations: number
  strength: number
  seed?: number
  style?: string
  status: GenerationStatus
  imageUrls: string[]
  thumbnailUrls: string[]
  processingTime?: number
  estimatedCost?: number
  createdAt: Date
  completedAt?: Date
  userId: string
  modelId: string
}

export interface PhotoPackage {
  id: string
  name: string
  description: string
  category: PackageCategory

  // Gender support
  gender?: Gender
  promptsMale?: Array<{
    text: string
    style?: string
    description?: string
    seed?: number
  }>
  promptsFemale?: Array<{
    text: string
    style?: string
    description?: string
    seed?: number
  }>
  previewUrlsMale?: string[]
  previewUrlsFemale?: string[]

  // DEPRECATED - use gender-specific fields
  prompts: Array<{
    text: string
    style?: string
    description?: string
  }>
  previewUrls: string[]

  isPremium: boolean
  isActive: boolean
  price?: number
  downloadCount: number
  rating?: number
  createdAt: Date
}

export interface UserPackage {
  id: string
  userId: string
  packageId: string
  status: PackageStatus
  selectedGender?: Gender // Which gender was selected for generation
  totalImages: number
  generatedImages: number
  failedImages: number
  activatedAt: Date
  completedAt?: Date
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  package?: PhotoPackage
  user?: User
  generations?: Generation[]
}

export interface EnhancedPhotoPackage extends PhotoPackage {
  userStatus: {
    activated: boolean
    status: PackageStatus | null
    progress?: {
      total: number
      generated: number
      failed: number
    }
    activatedAt?: Date
    completedAt?: Date
  }
}

export interface Collection {
  id: string
  name: string
  description?: string
  isPublic: boolean
  imageUrls: string[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface SystemLog {
  id: string
  level: string
  message: string
  userId?: string
  requestId?: string
  metadata?: any
  stack?: string
  createdAt: Date
}

export interface UploadedPhoto {
  id: string
  url: string
  filename: string
  size: number
  mimeType: string
  width: number
  height: number
  uploadedAt: Date
}

export interface GenerationRequest {
  modelId: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  resolution?: string
  variations?: number
  strength?: number
  seed?: number
  style?: string
  // FLUX-specific quality parameters
  steps?: number
  guidance_scale?: number
  safety_tolerance?: number
  output_quality?: number
  output_format?: 'jpg' | 'png' | 'webp'
  raw_mode?: boolean // FLUX 1.1 Pro Ultra raw mode for natural images
}

export interface ModelTrainingRequest {
  name: string
  class: ModelClass
  facePhotos: UploadedPhoto[]
  halfBodyPhotos: UploadedPhoto[]
  fullBodyPhotos: UploadedPhoto[]
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ModelProgress {
  modelId: string
  status: ModelStatus
  progress: number
  estimatedTime?: number
  errorMessage?: string
}

export interface CreditUsage {
  generation: number
  modelTraining: number
  apiCall: number
}

export interface SubscriptionLimits {
  models: number
  generations: number
  resolution: string
  features: string[]
  storage: number
}

export const PLAN_LIMITS: Record<Plan, SubscriptionLimits> = {
  STARTER: {
    models: 1,
    generations: 500,
    resolution: '2048x2048', // Updated for FLUX 1.1 Pro Ultra testing (4MP)
    features: ['watermark', 'flux_ultra', 'raw_mode'], // Enhanced features for testing
    storage: 1
  },
  PREMIUM: {
    models: 3,
    generations: 1200,
    resolution: '1024x1024',
    features: ['no_watermark', 'premium_packages'],
    storage: 5
  },
  GOLD: {
    models: -1, // unlimited
    generations: 2500,
    resolution: '2048x2048',
    features: ['no_watermark', 'premium_packages', 'api_access', 'priority_support'],
    storage: 20
  }
}

// Prompt Builder Types
export interface PromptBlock {
  id: string
  name: string
  value: string
  category: 'style' | 'lighting' | 'camera' | 'quality' | 'mood' | 'environment'
  isSelected: boolean
  description?: string
}

export interface PromptCategory {
  name: string
  blocks: PromptBlock[]
  allowMultiple: boolean
}

export interface BuiltPrompt {
  prompt: string
  blocks: PromptBlock[]
  timestamp: Date
}