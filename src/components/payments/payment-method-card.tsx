'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface PaymentMethod {
  id: string
  type: 'CREDIT_CARD' | 'PIX' | 'BOLETO'
  isDefault: boolean
  isActive: boolean
  createdAt: string
  lastUsed?: string
  // Credit Card specific
  cardBrand?: string
  cardLast4?: string
  cardHolderName?: string
  cardExpiryMonth?: string
  cardExpiryYear?: string
  // PIX specific
  pixKey?: string
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'
}

interface PaymentMethodCardProps {
  userId: string
  methods?: PaymentMethod[]
  onMethodAdded?: (method: PaymentMethod) => void
  onMethodUpdated?: (method: PaymentMethod) => void
  onMethodDeleted?: (methodId: string) => void
}

const methodIcons = {
  CREDIT_CARD: CreditCard,
  PIX: Smartphone,
  BOLETO: FileText
}

const methodNames = {
  CREDIT_CARD: 'Cartão de Crédito',
  PIX: 'PIX',
  BOLETO: 'Boleto'
}

const cardBrandColors = {
  visa: 'bg-blue-100 text-blue-800',
  mastercard: 'bg-red-100 text-red-800',
  amex: 'bg-green-100 text-green-800',
  elo: 'bg-yellow-100 text-yellow-800',
  default: 'bg-gray-100 text-gray-800'
}

export function PaymentMethodCard({ userId, methods = [], onMethodAdded, onMethodUpdated, onMethodDeleted }: PaymentMethodCardProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading] = useState(false)
  const [newMethodType, setNewMethodType] = useState<'CREDIT_CARD' | 'PIX'>('CREDIT_CARD')
  const { toast } = useToast()

  // Form state for new/edit method
  const [formData, setFormData] = useState({
    // Credit Card
    cardNumber: '',
    cardHolderName: '',
    cardExpiryMonth: '',
    cardExpiryYear: '',
    cardCvv: '',
    // PIX
    pixKey: '',
    pixKeyType: 'CPF' as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'
  })

  const handleAddMethod = async () => {
    try {
      setLoading(true)
      
      const payload = {
        type: newMethodType,
        ...(newMethodType === 'CREDIT_CARD' && {
          cardData: {
            number: formData.cardNumber,
            holderName: formData.cardHolderName,
            expiryMonth: formData.cardExpiryMonth,
            expiryYear: formData.cardExpiryYear,
            ccv: formData.cardCvv
          }
        }),
        ...(newMethodType === 'PIX' && {
          pixData: {
            key: formData.pixKey,
            keyType: formData.pixKeyType
          }
        })
      }

      const response = await fetch('/api/payments/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Método Adicionado',
          description: 'Método de pagamento adicionado com sucesso'
        })
        
        setShowAddDialog(false)
        resetForm()
        
        if (onMethodAdded) {
          onMethodAdded(result.method)
        }
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao adicionar método',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMethod = async (methodId: string) => {
    if (!confirm('Tem certeza que deseja remover este método de pagamento?')) return

    try {
      const response = await fetch(`/api/payments/methods/${methodId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Método Removido',
          description: 'Método de pagamento removido com sucesso'
        })
        
        if (onMethodDeleted) {
          onMethodDeleted(methodId)
        }
      } else {
        const result = await response.json()
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao remover método',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await fetch(`/api/payments/methods/${methodId}/default`, {
        method: 'PATCH'
      })

      if (response.ok) {
        toast({
          title: 'Método Padrão',
          description: 'Método padrão atualizado com sucesso'
        })
        
        // Update local state if needed
      } else {
        const result = await response.json()
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao definir método padrão',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      cardNumber: '',
      cardHolderName: '',
      cardExpiryMonth: '',
      cardExpiryYear: '',
      cardCvv: '',
      pixKey: '',
      pixKeyType: 'CPF'
    })
    setEditingMethod(null)
  }

  const formatCardNumber = (number: string) => {
    return number.replace(/(\d{4})/g, '$1 ').trim()
  }

  const getCardBrand = (number: string): string => {
    const cleanNumber = number.replace(/\s/g, '')
    
    if (/^4/.test(cleanNumber)) return 'visa'
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard'
    if (/^3[47]/.test(cleanNumber)) return 'amex'
    if (/^6[0-9]/.test(cleanNumber)) return 'elo'
    
    return 'default'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Métodos de Pagamento</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie seus métodos de pagamento salvos
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Método
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Método de Pagamento</DialogTitle>
              <DialogDescription>
                Adicione um novo método para suas futuras compras
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Method Type Selection */}
              <div className="space-y-2">
                <Label>Tipo de Método</Label>
                <Select value={newMethodType} onValueChange={(value: any) => setNewMethodType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Credit Card Form */}
              {newMethodType === 'CREDIT_CARD' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={formatCardNumber(formData.cardNumber)}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cardNumber: e.target.value.replace(/\s/g, '')
                      }))}
                      maxLength={19}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cardHolderName">Nome do Portador</Label>
                    <Input
                      id="cardHolderName"
                      placeholder="Nome como está no cartão"
                      value={formData.cardHolderName}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cardHolderName: e.target.value
                      }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiryMonth">Mês</Label>
                      <Select value={formData.cardExpiryMonth} onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, cardExpiryMonth: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                              {String(i + 1).padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiryYear">Ano</Label>
                      <Select value={formData.cardExpiryYear} onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, cardExpiryYear: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="AA" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() + i
                            return (
                              <SelectItem key={year} value={String(year).slice(-2)}>
                                {String(year).slice(-2)}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input
                        id="cardCvv"
                        placeholder="000"
                        value={formData.cardCvv}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cardCvv: e.target.value
                        }))}
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PIX Form */}
              {newMethodType === 'PIX' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Chave PIX</Label>
                    <Select value={formData.pixKeyType} onValueChange={(value: any) => 
                      setFormData(prev => ({ ...prev, pixKeyType: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="EMAIL">E-mail</SelectItem>
                        <SelectItem value="PHONE">Telefone</SelectItem>
                        <SelectItem value="RANDOM">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="pixKey">Chave PIX</Label>
                    <Input
                      id="pixKey"
                      placeholder={
                        formData.pixKeyType === 'CPF' ? '000.000.000-00' :
                        formData.pixKeyType === 'EMAIL' ? 'seu@email.com' :
                        formData.pixKeyType === 'PHONE' ? '(11) 99999-9999' :
                        'Sua chave PIX'
                      }
                      value={formData.pixKey}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pixKey: e.target.value
                      }))}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddMethod} disabled={loading}>
                  {loading ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Methods List */}
      <div className="space-y-4">
        {methods.map((method, index) => {
          const MethodIcon = methodIcons[method.type]
          const methodName = methodNames[method.type]
          
          return (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MethodIcon className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{methodName}</h4>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Padrão
                            </Badge>
                          )}
                          {!method.isActive && (
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Inativo
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {method.type === 'CREDIT_CARD' && (
                            <div className="flex items-center space-x-2">
                              <span>**** **** **** {method.cardLast4}</span>
                              {method.cardBrand && (
                                <Badge 
                                  variant="secondary" 
                                  className={cardBrandColors[method.cardBrand as keyof typeof cardBrandColors] || cardBrandColors.default}
                                >
                                  {method.cardBrand.toUpperCase()}
                                </Badge>
                              )}
                              <span>•</span>
                              <span>{method.cardExpiryMonth}/{method.cardExpiryYear}</span>
                            </div>
                          )}
                          
                          {method.type === 'PIX' && method.pixKey && (
                            <div>
                              <span>{method.pixKeyType}: {method.pixKey}</span>
                            </div>
                          )}
                          
                          <div className="text-xs mt-1">
                            Adicionado em {new Date(method.createdAt).toLocaleDateString('pt-BR')}
                            {method.lastUsed && (
                              <span> • Último uso: {new Date(method.lastUsed).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!method.isDefault && method.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                        >
                          Definir como Padrão
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingMethod(method)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMethod(method.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
        
        {methods.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium mb-2">Nenhum método salvo</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione um método de pagamento para facilitar suas compras
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Método
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}