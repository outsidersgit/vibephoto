import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import AdminLayoutClient from './admin-layout-client'
import { AdminRealtimeWrapper } from '@/components/admin/admin-realtime-wrapper'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  noStore()
  
  // Verificar autenticação e role ADMIN no server-side
  await requireAdmin()

  return (
    <>
      <ProtectedPageScript />
      <AdminLayoutClient>
        <AdminRealtimeWrapper>
          {children}
        </AdminRealtimeWrapper>
      </AdminLayoutClient>
    </>
  )
}