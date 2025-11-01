import { NextRequest, NextResponse } from 'next/server'
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
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    isActive: z.boolean().default(true),
    isPremium: z.boolean().default(false),
    prompts: z.array(z.object({
      text: z.string().min(1),
      style: z.string().optional(),
      description: z.string().optional()
    })).default([]),
    previewUrls: z.array(z.string()).default([])
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  }
  const created = await prisma.photoPackage.create({ data: parsed.data as any })
  return NextResponse.json({ pkg: created })
}

export async function PUT(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  console.log('📦 [ADMIN_PHOTO_PACKAGES] PUT request body:', JSON.stringify(body, null, 2))
  
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    isActive: z.boolean().optional(),
    isPremium: z.boolean().optional(),
    prompts: z.array(z.object({
      text: z.string().min(1),
      style: z.string().optional(),
      description: z.string().optional()
    })).optional(),
    previewUrls: z.array(z.string()).optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.error('❌ [ADMIN_PHOTO_PACKAGES] Validation failed:', parsed.error.issues)
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  }
  const { id, ...rest } = parsed.data
  console.log(`📝 [ADMIN_PHOTO_PACKAGES] Updating package ${id} with data:`, JSON.stringify(rest, null, 2))
  
  const updated = await prisma.photoPackage.update({ where: { id }, data: rest as any })
  console.log('✅ [ADMIN_PHOTO_PACKAGES] Package updated successfully')
  
  return NextResponse.json({ pkg: updated })
}

export async function DELETE(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  await prisma.photoPackage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


