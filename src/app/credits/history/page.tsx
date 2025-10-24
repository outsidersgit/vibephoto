import { redirect } from 'next/navigation'

// Redirecionar rota antiga /credits/history para nova rota /account/history
export default function CreditsHistoryRedirect() {
  redirect('/account/history')
}
