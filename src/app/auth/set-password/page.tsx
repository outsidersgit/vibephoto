import { Suspense } from 'react'
import SetPasswordClient from './set-password-client'

export const dynamic = 'force-dynamic'

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordClient />
    </Suspense>
  )
}


