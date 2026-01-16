'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Configurações otimizadas (Sprint 1 - Performance)
            staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos (aumentado para reduzir requisições)
            gcTime: 10 * 60 * 1000, // 10 minutos - tempo de garbage collection (aumentado para melhor cache)
            refetchOnWindowFocus: false, // NÃO revalidar ao focar (evita requisições extras)
            refetchOnMount: false, // NÃO revalidar ao montar (usa cache se disponível)
            refetchOnReconnect: false, // NÃO revalidar ao reconectar internet
            retry: 1, // Tentar novamente 1 vez em caso de erro
          },
          mutations: {
            // Configurações padrão para mutações
            retry: 0, // Não tentar novamente mutações que falharam
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
      />
    </QueryClientProvider>
  )
}
