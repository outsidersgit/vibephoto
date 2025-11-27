'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ArrowRight, Github, Mail, Sparkles, CheckCircle } from 'lucide-react'

function SignInContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

  useEffect(() => {
    // Verificar se veio da página de sucesso do checkout
    if (searchParams.get('paymentSuccess') === 'true') {
      setShowPaymentSuccess(true)
    }
  }, [searchParams])

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Performance: Redirect com recarregamento completo para atualizar sessão (Sprint 1 - Fix v2)
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false // Controlar redirect manualmente
      })

      if (result?.error) {
        setError('Email ou senha inválidos')
        setIsLoading(false)
      } else if (result?.ok) {
        // Check role and subscription status and redirect accordingly
        const session = await getSession()
        const user = session?.user as any
        const role = String(user?.role || 'USER').toUpperCase()
        
        // ADMIN always goes to /admin
        if (role === 'ADMIN') {
          window.location.href = '/admin'
          return
        }
        
        // Verificar callbackUrl se fornecido
        const callbackUrl = searchParams.get('callbackUrl')
        
        const subscriptionStatus = user?.subscriptionStatus
        if (subscriptionStatus !== 'ACTIVE') {
          // Se veio do checkout success, redirecionar para dashboard mesmo sem ACTIVE
          // O webhook pode ainda estar processando
          if (showPaymentSuccess || callbackUrl) {
            window.location.href = callbackUrl || '/dashboard'
          } else {
            window.location.href = '/pricing'
          }
        } else {
          window.location.href = callbackUrl || '/'
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Ocorreu um erro. Tente novamente.')
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true)
    // OAuth will redirect to /auth/callback which checks subscriptionStatus
    await signIn(provider, { callbackUrl: '/auth/callback' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Entre na sua conta</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Entrar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showPaymentSuccess && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle className="font-semibold">Pagamento Confirmado!</AlertTitle>
                <AlertDescription>
                  Seu pagamento foi processado com sucesso. Faça login para acessar sua conta ativada.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* OAuth Providers */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Digite seu email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Digite sua senha"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] hover:to-[#6a4190] text-white border-0"
                disabled={isLoading}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <div className="text-center space-y-2">
              <Link href="/auth/forgot-password" className="text-sm text-purple-600 hover:underline" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Esqueceu sua senha?
              </Link>
              <p className="text-sm text-gray-600" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Não tem uma conta?{' '}
                <Link href="/auth/signup" className="text-purple-600 hover:underline font-medium">
                  Cadastre-se
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}