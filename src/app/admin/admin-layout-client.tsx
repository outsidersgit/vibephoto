'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const items = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/users', label: 'Usuários' },
  { href: '/admin/credits', label: '💰 Créditos', highlight: true },
  { href: '/admin/payments', label: 'Cobranças' },
  { href: '/admin/subscription-plans', label: 'Planos de Assinatura' },
  { href: '/admin/credit-packages', label: 'Pacotes de Créditos' },
  { href: '/admin/photo-packages', label: 'Pacotes de Fotos' },
  { href: '/admin/coupons', label: 'Cupons de Desconto' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/retention', label: 'Retenção' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/tools', label: 'Ferramentas' },
]

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-white border-r border-gray-200 sticky top-0">
          <div className="p-4 font-semibold text-gray-800">Admin</div>
          <nav className="space-y-1 px-2 pb-4">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href 
                    ? 'bg-purple-100 text-purple-800' 
                    : item.highlight 
                      ? 'text-purple-700 hover:bg-purple-50' 
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
