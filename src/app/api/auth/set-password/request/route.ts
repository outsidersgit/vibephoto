import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ ok: true }) // Do not leak existence

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 30) // 30 min

  // Upsert verification token
  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token } as any },
    create: { identifier: email, token, expires },
    update: { token, expires }
  } as any)

  const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/set-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  // TODO: send email via provider; for now return link to be sent by admin
  return NextResponse.json({ ok: true, url })
}


