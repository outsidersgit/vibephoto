import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import UserCreditsDiagnosticClient from './user-credits-diagnostic-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function UserCreditsPage({ params }: { params: { userId: string } }) {
  noStore()
  await requireAdmin()

  const { userId } = params

  // Buscar dados do diagnóstico
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/credits/users/${userId}/diagnostic`,
    { cache: 'no-store' }
  )

  let diagnosticData = null
  if (response.ok) {
    const result = await response.json()
    diagnosticData = result.data
  }

  return <UserCreditsDiagnosticClient userId={userId} initialData={diagnosticData} />
}
