'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  CheckCircle, 
  Clock,
  Zap,
  Calendar
} from 'lucide-react'

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO'

interface PaymentMethodOption {
  type: PaymentMethod
  name: string
  description: string
  icon: React.ReactNode
  badge?: string
  badgeColor?: 'success' | 'info' | 'warning'
  processingTime: string
  advantages: string[]
  maxInstallments?: number
}

interface PaymentMethodSelectorProps {
  selectedMethod?: PaymentMethod
  onMethodSelect: (method: PaymentMethod) => void
  plan?: 'STARTER' | 'PREMIUM' | 'GOLD'
  disabled?: boolean
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  plan = 'STARTER',
  disabled = false
}: PaymentMethodSelectorProps) {
  
  const paymentMethods: PaymentMethodOption[] = [
    {
      type: 'PIX',
      name: 'PIX',
      description: 'Pagamento instantâneo via QR Code ou Pix Copia e Cola',
      icon: <Smartphone className="w-6 h-6" />,
      badge: 'Instantâneo',
      badgeColor: 'success',
      processingTime: 'Aprovação imediata',
      advantages: [
        'Aprovação instantânea',
        'Disponível 24/7',
        'Sem taxas adicionais',
        'Seguro e prático'
      ]
    },
    {
      type: 'CREDIT_CARD',
      name: 'Cartão de Crédito',
      description: 'Visa, Mastercard, Elo, American Express',
      icon: <CreditCard className="w-6 h-6" />,
      badge: 'Parcelamento',
      badgeColor: 'info',
      processingTime: 'Aprovação em até 5 minutos',
      maxInstallments: plan === 'GOLD' ? 12 : plan === 'PREMIUM' ? 6 : 3,
      advantages: [
        `Parcele em até ${plan === 'GOLD' ? 12 : plan === 'PREMIUM' ? 6 : 3}x`,
        'Renovação automática',
        'Aprovação rápida',
        'Aceita principais bandeiras'
      ]
    },
    {
      type: 'BOLETO',
      name: 'Boleto Bancário',
      description: 'Pagamento via boleto bancário ou internet banking',
      icon: <FileText className="w-6 h-6" />,
      badge: '7 dias',
      badgeColor: 'warning',
      processingTime: 'Confirmação em 1-2 dias úteis',
      advantages: [
        'Não precisa de cartão',
        'Pague em qualquer banco',
        'Seguro e confiável',
        'Prazo de 7 dias'
      ]
    }
  ]

  const getBadgeVariant = (color?: 'success' | 'info' | 'warning') => {
    switch (color) {
      case 'success':
        return 'default'
      case 'info':
        return 'secondary'
      case 'warning':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Escolha a forma de pagamento
        </h3>
        <p className="text-sm text-gray-600">
          Selecione o método de pagamento que preferir
        </p>
      </div>

      <div className="grid gap-4">
        {paymentMethods.map((method) => {
          const isSelected = selectedMethod === method.type
          
          return (
            <motion.div
              key={method.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <Card 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isSelected 
                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' 
                    : 'hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !disabled && onMethodSelect(method.type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`p-3 rounded-full ${
                        isSelected 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {method.icon}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {method.name}
                          </h4>
                          {method.badge && (
                            <Badge 
                              variant={getBadgeVariant(method.badgeColor)}
                              className={`text-xs ${
                                method.badgeColor === 'success' ? 'bg-green-100 text-green-800' :
                                method.badgeColor === 'info' ? 'bg-blue-100 text-blue-800' :
                                method.badgeColor === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                ''
                              }`}
                            >
                              {method.badge}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {method.description}
                        </p>
                        
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                          <Clock className="w-3 h-3" />
                          {method.processingTime}
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-4"
                      >
                        <CheckCircle className="w-6 h-6 text-blue-500" />
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Expanded details for selected method */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 pt-4 border-t border-gray-100"
                      >
                        <h5 className="text-sm font-medium text-gray-900 mb-2">
                          Vantagens:
                        </h5>
                        <ul className="space-y-1">
                          {method.advantages.map((advantage, index) => (
                            <li 
                              key={index}
                              className="flex items-center gap-2 text-sm text-gray-600"
                            >
                              <div className="w-1 h-1 bg-green-500 rounded-full" />
                              {advantage}
                            </li>
                          ))}
                        </ul>
                        
                        {method.type === 'PIX' && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800">
                              <Zap className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Ativação imediata do plano!
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {method.type === 'CREDIT_CARD' && method.maxInstallments && method.maxInstallments > 1 && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 text-blue-800">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Parcele em até {method.maxInstallments}x sem juros
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {method.type === 'BOLETO' && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-800">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Prazo de 7 dias para pagamento
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}