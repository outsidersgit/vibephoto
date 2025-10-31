'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthCallbackClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const subscriptionStatus = (session.user as any)?.subscriptionStatus as string | null | undefined
      
      // Always redirect new users (subscriptionStatus === null) to pricing
      if (subscriptionStatus !== 'ACTIVE') {
        router.push('/pricing?newuser=true')
      } else {
        // User has active subscription, redirect to intended URL or home
        const finalUrl = callbackUrl !== '/' ? callbackUrl : '/'
        router.push(finalUrl)
      }
    }
  }, [status, session, router, callbackUrl])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Autenticando...</p>
      </div>
    </div>
  )
}

