'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  User,
  CreditCard,
  Phone,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Save,
  Loader2
} from 'lucide-react'

// Utility functions for Brazilian validation and formatting
function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i)
  let digit = 11 - (sum % 11)
  if (digit === 10 || digit === 11) digit = 0
  if (digit !== parseInt(cpf.charAt(9))) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i)
  digit = 11 - (sum % 11)
  if (digit === 10 || digit === 11) digit = 0
  return digit === parseInt(cpf.charAt(10))
}

function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj.charAt(i)) * weights1[i]
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (digit !== parseInt(cnpj.charAt(12))) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj.charAt(i)) * weights2[i]
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return digit === parseInt(cnpj.charAt(13))
}

function formatCPFCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '')

  if (numbers.length <= 11) {
    // Format as CPF: 000.000.000-00
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  } else {
    // Format as CNPJ: 00.000.000/0000-00
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
}

function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '')

  if (numbers.length <= 10) {
    // Format as (00) 0000-0000
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  } else {
    // Format as (00) 00000-0000
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
}

function formatCEP(value: string): string {
  const numbers = value.replace(/\D/g, '')
  return numbers.replace(/(\d{5})(\d{3})/, '$1-$2')
}

interface PersonalDataFormProps {
  onDataComplete?: (isComplete: boolean) => void
}

interface AddressData {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export function PersonalDataForm({ onDataComplete }: PersonalDataFormProps) {
  const { data: session, update } = useSession()
  const [formData, setFormData] = useState({
    name: '',
    cpfCnpj: '',
    phone: '',
    mobilePhone: '',
    postalCode: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    city: '',
    state: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        name: session.user.name || '',
        // TODO: Load user personal data from database
      }))
    }
  }, [session])

  useEffect(() => {
    // Check if essential data is complete
    const isComplete = formData.name && formData.cpfCnpj &&
                      (validateCPF(formData.cpfCnpj) || validateCNPJ(formData.cpfCnpj))
    onDataComplete?.(isComplete)
  }, [formData, onDataComplete])

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value

    if (field === 'cpfCnpj') {
      formattedValue = formatCPFCNPJ(value)
    } else if (field === 'phone' || field === 'mobilePhone') {
      formattedValue = formatPhone(value)
    } else if (field === 'postalCode') {
      formattedValue = formatCEP(value)
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (!formData.cpfCnpj.trim()) {
      newErrors.cpfCnpj = 'CPF ou CNPJ é obrigatório'
    } else {
      const isValidCPF = validateCPF(formData.cpfCnpj)
      const isValidCNPJ = validateCNPJ(formData.cpfCnpj)
      if (!isValidCPF && !isValidCNPJ) {
        newErrors.cpfCnpj = 'CPF ou CNPJ inválido'
      }
    }

    if (formData.phone && formData.phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Telefone deve ter pelo menos 10 dígitos'
    }

    if (formData.postalCode && formData.postalCode.replace(/\D/g, '').length !== 8) {
      newErrors.postalCode = 'CEP deve ter 8 dígitos'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const fetchAddressByCEP = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return

    setIsLoading(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
      const data: AddressData = await response.json()

      if (data.logradouro) {
        setFormData(prev => ({
          ...prev,
          address: data.logradouro,
          province: data.bairro,
          city: data.localidade,
          state: data.uf
        }))
      }
    } catch (error) {
      console.error('Error fetching address:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/profile/personal-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Update session with new name if changed
        if (formData.name !== session?.user?.name) {
          await update({ user: { name: formData.name } })
        }
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setErrors({ general: data.error || 'Erro ao salvar dados' })
      }
    } catch (error) {
      setErrors({ general: 'Erro interno. Tente novamente.' })
    } finally {
      setIsSaving(false)
    }
  }

  const isDataComplete = formData.name && formData.cpfCnpj &&
                         (validateCPF(formData.cpfCnpj) || validateCNPJ(formData.cpfCnpj))

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Dados Pessoais
        </CardTitle>
        <CardDescription>
          Informações necessárias para processar pagamentos via Asaas
        </CardDescription>
        {isDataComplete && (
          <Badge variant="secondary" className="w-fit">
            <CheckCircle className="w-3 h-3 mr-1" />
            Dados essenciais completos
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Informações Básicas
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Seu nome completo"
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                CPF ou CNPJ *
              </label>
              <input
                type="text"
                value={formData.cpfCnpj}
                onChange={(e) => handleInputChange('cpfCnpj', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.cpfCnpj ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
              {errors.cpfCnpj && (
                <p className="text-red-500 text-xs mt-1">{errors.cpfCnpj}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Contato
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Telefone Fixo
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="(00) 0000-0000"
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Celular
              </label>
              <input
                type="tel"
                value={formData.mobilePhone}
                onChange={(e) => handleInputChange('mobilePhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => {
                    handleInputChange('postalCode', e.target.value)
                    if (e.target.value.replace(/\D/g, '').length === 8) {
                      fetchAddressByCEP(e.target.value)
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.postalCode ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
                )}
              </div>
              {errors.postalCode && (
                <p className="text-red-500 text-xs mt-1">{errors.postalCode}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Rua/Avenida
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome da rua"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Número
              </label>
              <input
                type="text"
                value={formData.addressNumber}
                onChange={(e) => handleInputChange('addressNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={formData.complement}
                onChange={(e) => handleInputChange('complement', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Apto, Sala, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Bairro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Estado
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Cidade
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome da cidade"
            />
          </div>
        </div>

        {/* Validation Messages */}
        {!isDataComplete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">
                  Dados Incompletos
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Para utilizar o sistema de pagamentos, você precisa fornecer pelo menos o <strong>nome completo</strong> e <strong>CPF/CNPJ válido</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{errors.general}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-700 text-sm">Dados salvos com sucesso!</p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDataComplete}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Dados
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}