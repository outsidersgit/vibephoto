import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const packages = await prisma.photoPackage.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ packages })
}

export async function POST(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()

  const promptSchema = z.object({
    text: z.string().min(1),
    style: z.string().optional(),
    description: z.string().optional(),
    seed: z.number().optional()
  })

  const schema = z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    isActive: z.boolean().default(true),
    isPremium: z.boolean().default(false),
    gender: z.enum(['MALE', 'FEMALE', 'BOTH']).default('BOTH'),
    // Gender-specific fields
    promptsMale: z.array(promptSchema).default([]),
    promptsFemale: z.array(promptSchema).default([]),
    previewUrlsMale: z.array(z.string()).default([]),
    previewUrlsFemale: z.array(z.string()).default([]),
    // Legacy fields (for backwards compatibility)
    prompts: z.array(promptSchema).default([]),
    previewUrls: z.array(z.string()).default([])
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  }

  const created = await prisma.photoPackage.create({ data: parsed.data as any })

  // Invalidar cache para que usuários vejam o novo pacote imediatamente
  revalidateTag('packages')

  return NextResponse.json({ pkg: created })
}

export async function PUT(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  console.log('📦 [ADMIN_PHOTO_PACKAGES] PUT request body:', JSON.stringify(body, null, 2))

  const promptSchema = z.object({
    text: z.string().min(1),
    style: z.string().optional(),
    description: z.string().optional(),
    seed: z.number().optional()
  })

  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    isActive: z.boolean().optional(),
    isPremium: z.boolean().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'BOTH']).optional(),
    // Gender-specific fields
    promptsMale: z.array(promptSchema).optional(),
    promptsFemale: z.array(promptSchema).optional(),
    previewUrlsMale: z.array(z.string()).optional(),
    previewUrlsFemale: z.array(z.string()).optional(),
    // Legacy fields
    prompts: z.array(promptSchema).optional(),
    previewUrls: z.array(z.string()).optional()
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.error('❌ [ADMIN_PHOTO_PACKAGES] Validation failed:', parsed.error.issues)
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  }
  const { id, ...rest } = parsed.data
  console.log(`📝 [ADMIN_PHOTO_PACKAGES] Updating package ${id} with data:`, JSON.stringify(rest, null, 2))

  // Log específico para previewUrls
  if (rest.previewUrls) {
    console.log('🖼️ [ADMIN_PHOTO_PACKAGES] Preview URLs (legacy) to save:', {
      count: Array.isArray(rest.previewUrls) ? rest.previewUrls.length : 0,
      urls: rest.previewUrls
    })
  }
  if (rest.previewUrlsMale) {
    console.log('🖼️ [ADMIN_PHOTO_PACKAGES] Preview URLs MALE to save:', {
      count: Array.isArray(rest.previewUrlsMale) ? rest.previewUrlsMale.length : 0,
      urls: rest.previewUrlsMale
    })
  }
  if (rest.previewUrlsFemale) {
    console.log('🖼️ [ADMIN_PHOTO_PACKAGES] Preview URLs FEMALE to save:', {
      count: Array.isArray(rest.previewUrlsFemale) ? rest.previewUrlsFemale.length : 0,
      urls: rest.previewUrlsFemale
    })
  }

  const updated = await prisma.photoPackage.update({ where: { id }, data: rest as any })

  console.log('✅ [ADMIN_PHOTO_PACKAGES] Package updated successfully:', {
    packageId: updated.id,
    gender: updated.gender,
    promptsMaleCount: Array.isArray(updated.promptsMale) ? updated.promptsMale.length : 0,
    promptsFemaleCount: Array.isArray(updated.promptsFemale) ? updated.promptsFemale.length : 0,
    previewsMaleCount: Array.isArray(updated.previewUrlsMale) ? updated.previewUrlsMale.length : 0,
    previewsFemaleCount: Array.isArray(updated.previewUrlsFemale) ? updated.previewUrlsFemale.length : 0
  })

  // Invalidar cache para que usuários vejam as mudanças imediatamente
  revalidateTag('packages')
  console.log('🔄 [ADMIN_PHOTO_PACKAGES] Cache invalidated for packages')

  return NextResponse.json({ pkg: updated })
}

export async function DELETE(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()

  // Hard delete - Excluir permanentemente do banco de dados
  console.log('🗑️ [ADMIN_PHOTO_PACKAGES] Deleting package permanently:', id)
  await prisma.photoPackage.delete({
    where: { id }
  })

  // Invalidar cache para que usuários vejam que o pacote foi removido imediatamente
  revalidateTag('packages')

  console.log('✅ [ADMIN_PHOTO_PACKAGES] Package permanently deleted:', id)
  return NextResponse.json({ ok: true, message: 'Pacote deletado com sucesso' })
}


