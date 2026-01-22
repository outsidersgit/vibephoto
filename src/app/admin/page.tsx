import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminHomePage() {
  noStore()
  await requireAdmin()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Usuários', href: '/admin/users', desc: 'Gerencie usuários, planos e créditos' },
          { title: 'Cobranças 💳', href: '/admin/payments', desc: 'Histórico de todas as cobranças e inadimplência' },
          { title: 'Planos de Assinatura', href: '/admin/subscription-plans', desc: 'Gerencie planos, preços, créditos e features' },
          { title: 'Pacotes de Créditos', href: '/admin/credit-packages', desc: 'Gerencie pacotes de créditos avulsos' },
          { title: 'Cupons de Desconto', href: '/admin/coupons', desc: 'Gerencie cupons de desconto e híbridos' },
          { title: 'Pacotes de Fotos', href: '/admin/photo-packages', desc: 'CRUD de pacotes' },
          { title: 'Analytics', href: '/admin/analytics', desc: 'KPIs e gráficos' },
          { title: 'Retenção', href: '/admin/retention', desc: 'Crescimento e churn' },
          { title: 'Ferramentas 🔧', href: '/admin/tools', desc: 'Sincronização, manutenção e correções do sistema' },
          { title: 'Client Errors 🔴', href: '/admin/client-errors', desc: 'Logs de erros do navegador (Safari/iOS)' },
        ].map(card => (
          <a key={card.href} href={card.href} className="block rounded-lg border border-gray-200 p-4 hover:shadow-sm transition">
            <div className="font-semibold text-gray-800">{card.title}</div>
            <div className="text-sm text-gray-500 mt-1">{card.desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}


