import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { email, recaptchaToken } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Optional reCAPTCHA verification (enable when RECAPTCHA_SECRET is set)
  if (process.env.RECAPTCHA_SECRET) {
    try {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: recaptchaToken || '' })
      })
      const result = (await resp.json()) as any
      if (!result.success) {
        return NextResponse.json({ error: 'reCAPTCHA failed' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'reCAPTCHA error' }, { status: 400 })
    }
  }

  // Throttle: limit to 5 requests per 15 minutes per email
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
    const count = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "SystemLog"
      WHERE message = 'password_reset_request'
        AND metadata ->> 'email' = ${email}
        AND "createdAt" >= ${fifteenMinAgo}
    `
    const attempts = Number(count?.[0]?.count || 0)
    if (attempts >= 5) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }
  } catch {}

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

  // Log attempt
  try {
    await prisma.systemLog.create({
      data: { level: 'info', message: 'password_reset_request', metadata: { email } }
    })
  } catch {}

  const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/set-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  // TODO: send email via provider; for now return link to be sent by admin
  return NextResponse.json({ ok: true, url })
}


