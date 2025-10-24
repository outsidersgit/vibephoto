import { redirect } from 'next/navigation'

// Dashboard agora redireciona para a home (/) onde está o dashboard completo
// A home já tem lógica para mostrar diferentes conteúdos para usuários logados vs não logados
export default function DashboardPage() {
  redirect('/')
}
