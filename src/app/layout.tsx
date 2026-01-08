import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AutoStorageProvider } from '@/components/providers/auto-storage-provider'
import { ErrorLoggerProvider } from '@/components/providers/error-logger-provider'
import { QueryProvider } from '@/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as CustomToaster } from '@/components/ui/toast'
import { PremiumNavigation } from '@/components/ui/premium-navigation'
import { Footer } from '@/components/layout/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VibePhoto',
  description: 'Retratos que parecem arte',
  keywords: ['AI', 'photo generation', 'machine learning', 'fine-tuning', 'SaaS', 'VibePhoto'],
  authors: [{ name: 'VibePhoto Team' }],
  // Evita 404 de /favicon.ico adicionando ícone explícito (PNG existente no /public)
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg'
  },
  openGraph: {
    title: 'VibePhoto',
    description: 'Retratos que parecem arte',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorLoggerProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <AuthProvider>
                <AutoStorageProvider>
                  <div className="min-h-screen flex flex-col">
                    <PremiumNavigation />
                    <main className="flex-1 pt-20">
                      {children}
                    </main>
                    <Footer />
                  </div>
                  <Toaster />
                  <CustomToaster />
                </AutoStorageProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorLoggerProvider>
      </body>
    </html>
  )
}