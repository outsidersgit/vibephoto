'use client'

import { Card, CardContent } from '@/components/ui/card'

export function SubscriptionTerms() {
  return (
    <Card className="bg-gray-50 border-gray-200">
      <CardContent className="py-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-center">
          Termos de Assinatura e Política de Reembolso
        </h3>
        <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
          <p>
            <strong>Direito de desistência (CDC Art. 49):</strong> Conforme o Código de Defesa do Consumidor, você tem 7 dias para desistir 
            do serviço APENAS se nenhuma solicitação de geração de imagem ou treinamento de modelo for realizada. Após o primeiro uso dos 
            recursos computacionais (GPU/IA), não há direito de desistência devido aos custos imediatos e irreversíveis de processamento.
          </p>
          
          <p>
            <strong>Política de reembolso:</strong> Reembolsos são oferecidos exclusivamente dentro do prazo de 7 dias e apenas se nenhum 
            recurso computacional for utilizado. Uma vez iniciado qualquer processamento de IA (treinamento ou geração), os custos são 
            imediatos e irreversíveis, não cabendo reembolso.
          </p>
          
          <p>
            <strong>Renovação automática:</strong> Sua assinatura será renovada automaticamente ao final de cada período de cobrança 
            (mensal ou anual) usando o método de pagamento cadastrado, exceto se cancelada antes da data de renovação.
          </p>
          
          <p>
            <strong>Cancelamento:</strong> Para evitar cobranças futuras, o cancelamento deve ser solicitado antes da data de renovação 
            através da área "Cobrança" em sua conta. O acesso aos serviços continuará ativo até o fim do período já pago.
          </p>
          
          <p>
            <strong>Créditos não transferíveis:</strong> Créditos não utilizados não são transferidos para o próximo ciclo de cobrança 
            e expiram automaticamente no final do período atual. Recomendamos o uso planejado dos créditos dentro de cada ciclo.
          </p>
          
          <p>
            <strong>Modificações nos planos:</strong> Upgrades de plano são aplicados imediatamente com cobrança proporcional. 
            Downgrades entram em vigor na próxima renovação para evitar perda de recursos já pagos.
          </p>
          
          <p className="text-center pt-2 border-t border-gray-300">
            Ao prosseguir com a assinatura, você concorda com estes termos e confirma o entendimento da política de cobrança.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function SubscriptionTermsFooter() {
  return (
    <div className="bg-gray-100 py-6 px-4 text-center">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Importante:</strong> Devido aos custos imediatos com GPU e processamento, não há direito de desistência ou reembolso, 
          exceto se nenhum recurso for utilizado. A assinatura renova automaticamente - cancele antes da renovação se necessário. 
          Créditos não utilizados não são transferidos entre ciclos de cobrança.
        </p>
      </div>
    </div>
  )
}