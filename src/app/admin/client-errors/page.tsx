import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import { ClientErrorsView } from './client-errors-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClientErrorsPage() {
  noStore()
  await requireAdmin()

  return <ClientErrorsView />
}
