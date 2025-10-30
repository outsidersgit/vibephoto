export const dynamic = 'force-dynamic'

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Usuários', href: '/admin/users', desc: 'Gerencie usuários, planos e créditos' },
          { title: 'Pacotes de Fotos', href: '/admin/photo-packages', desc: 'CRUD de pacotes' },
          { title: 'Analytics', href: '/admin/analytics', desc: 'KPIs e gráficos' },
          { title: 'Retenção', href: '/admin/retention', desc: 'Crescimento e churn' },
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


