import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AutoStorageProvider } from '@/components/providers/auto-storage-provider'
import { QueryProvider } from '@/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as CustomToaster } from '@/components/ui/toast'
import { PremiumNavigation } from '@/components/ui/premium-navigation'
import { Footer } from '@/components/layout/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VibePhoto - AI Photo Generation SaaS',
  description: 'Create stunning AI-generated photos with custom trained models',
  keywords: ['AI', 'photo generation', 'machine learning', 'fine-tuning', 'SaaS', 'VibePhoto'],
  authors: [{ name: 'VibePhoto Team' }],
  openGraph: {
    title: 'VibePhoto - AI Photo Generation',
    description: 'Create stunning AI-generated photos with custom trained models',
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
      </body>
    </html>
  )
}