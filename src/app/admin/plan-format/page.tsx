import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import { PlanFormatToggle } from './plan-format-toggle'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPlanFormatPage() {
  noStore()
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Formato de Planos</h1>
        <p className="text-sm text-gray-600 mt-1">
          Alterne entre os formatos de planos sem necessidade de deploy
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Atenção</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Assinaturas <strong>existentes</strong> não são afetadas pela mudança de formato</li>
                <li>Apenas <strong>novas assinaturas</strong> usarão o formato escolhido</li>
                <li>Usuários mantêm o formato original de quando assinaram</li>
                <li>A mudança é <strong>instantânea</strong> e afeta a página /pricing imediatamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <PlanFormatToggle />

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Comparação entre Formatos</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Formato A */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <h3 className="font-semibold text-gray-900">Formato A - Tradicional</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>3 planos: Starter, Premium, Gold</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>2 ciclos: Mensal e Anual</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Créditos renovam mensalmente/anualmente</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Valores atuais em produção</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Toggle mensal/anual visível</span>
              </li>
            </ul>
          </div>

          {/* Formato B */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              <h3 className="font-semibold text-gray-900">Formato B - Membership</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>1 plano: Membership</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>3 ciclos: Trimestral (3m), Semestral (6m), Anual (12m)</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Créditos fixos por ciclo (não acumulam)</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Valores premium (ex: R$ 997/trimestre)</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Sem toggle, ciclos são os próprios cards</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Gerenciamento de Planos</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Para editar os valores, créditos e features dos planos, acesse{' '}
                <a href="/admin/subscription-plans" className="font-semibold underline hover:text-blue-900">
                  Gerenciar Planos de Assinatura
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
