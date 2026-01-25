import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import CreditsDashboardClient from './credits-dashboard-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminCreditsPage() {
  noStore()
  await requireAdmin()

  // Buscar dados iniciais do servidor
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/credits/dashboard`, {
    cache: 'no-store',
    headers: {
      'Cookie': '' // Cookies serão enviados automaticamente em server component
    }
  })

  let initialData = null
  if (response.ok) {
    const result = await response.json()
    initialData = result.data
  }

  return <CreditsDashboardClient initialData={initialData} />
}
