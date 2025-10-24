import { redirect } from 'next/navigation'

// Redirecionar para a página de billing com tab de cards
// Mantém compatibilidade com sistema antigo
export default function PaymentMethodsPage() {
  redirect('/billing?tab=cards')
}
