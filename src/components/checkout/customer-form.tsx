'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { 
  validateCPFCNPJ, 
  validateCEP, 
  validatePhone, 
  validateEmail,
  formatCPFCNPJ,
  formatCEP,
  formatPhone,
  BRAZILIAN_STATES
} from '@/lib/utils/brazilian-validators'

export interface CustomerData {
  name: string
  email: string
  cpfCnpj: string
  phone: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  city?: string
  state?: string
  postalCode?: string
}

interface CustomerFormProps {
  data: Partial<CustomerData>
  onChange: (data: CustomerData) => void
  onValidationChange: (isValid: boolean) => void
  showAddressFields?: boolean
  disabled?: boolean
}

export function CustomerForm({
  data,
  onChange,
  onValidationChange,
  showAddressFields = false,
  disabled = false
}: CustomerFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback((field: string, value: string) => {
    switch (field) {
      case 'name':
        return value.trim().length >= 2 ? '' : 'Nome deve ter pelo menos 2 caracteres'
      case 'email':
        return validateEmail(value) ? '' : 'Email inválido'
      case 'cpfCnpj':
        return validateCPFCNPJ(value) ? '' : 'CPF/CNPJ inválido'
      case 'phone':
        return validatePhone(value) ? '' : 'Telefone inválido'
      case 'mobilePhone':
        return !value || validatePhone(value) ? '' : 'Celular inválido'
      case 'postalCode':
        return !value || validateCEP(value) ? '' : 'CEP inválido'
      case 'state':
        return !value || BRAZILIAN_STATES.find(state => state.code === value) ? '' : 'Estado inválido'
      case 'city':
        return !value || value.trim().length >= 2 ? '' : 'Cidade deve ter pelo menos 2 caracteres'
      case 'address':
        return !value || value.trim().length >= 5 ? '' : 'Endereço deve ter pelo menos 5 caracteres'
      case 'addressNumber':
        return !showAddressFields || value ? '' : 'Número é obrigatório'
      default:
        return ''
    }
  }, [showAddressFields])

  const validateAllFields = useCallback((currentData: Partial<CustomerData>) => {
    const requiredFields = ['name', 'email', 'cpfCnpj', 'phone']
    if (showAddressFields) {
      requiredFields.push('address', 'addressNumber', 'city', 'state', 'postalCode')
    }

    const newErrors: Record<string, string> = {}
    let isValid = true

    // Check required fields
    for (const field of requiredFields) {
      const value = currentData[field as keyof CustomerData] || ''
      if (!value.trim()) {
        newErrors[field] = `${getFieldLabel(field)} é obrigatório`
        isValid = false
      } else {
        const error = validateField(field, value)
        if (error) {
          newErrors[field] = error
          isValid = false
        }
      }
    }

    // Check optional fields
    const optionalFields = ['mobilePhone', 'complement', 'province']
    for (const field of optionalFields) {
      const value = currentData[field as keyof CustomerData] || ''
      if (value) {
        const error = validateField(field, value)
        if (error) {
          newErrors[field] = error
          isValid = false
        }
      }
    }

    setErrors(newErrors)
    onValidationChange(isValid)
  }, [showAddressFields, validateField, onValidationChange])

  const handleFieldChange = (field: keyof CustomerData, value: string) => {
    // Format certain fields automatically
    let formattedValue = value
    if (field === 'cpfCnpj') {
      formattedValue = formatCPFCNPJ(value)
    } else if (field === 'postalCode') {
      formattedValue = formatCEP(value)
    } else if (field === 'phone' || field === 'mobilePhone') {
      formattedValue = formatPhone(value)
    }

    const updatedData = { ...data, [field]: formattedValue }
    onChange(updatedData as CustomerData)

    // Mark field as touched
    setTouched(prev => ({ ...prev, [field]: true }))

    // Validate all fields after change
    setTimeout(() => validateAllFields(updatedData), 100)
  }

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      name: 'Nome',
      email: 'Email',
      cpfCnpj: 'CPF/CNPJ',
      phone: 'Telefone',
      mobilePhone: 'Celular',
      address: 'Endereço',
      addressNumber: 'Número',
      complement: 'Complemento',
      province: 'Bairro',
      city: 'Cidade',
      state: 'Estado',
      postalCode: 'CEP'
    }
    return labels[field] || field
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Nome Completo *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={data.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  disabled={disabled}
                  className={errors.name ? 'border-red-300 focus:border-red-500' : ''}
                />
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {touched.name && errors.name && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={data.email || ''}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  disabled={disabled}
                  className={errors.email ? 'border-red-300 focus:border-red-500' : ''}
                />
                <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {touched.email && errors.email && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cpfCnpj" className="text-sm font-medium text-gray-700">
                CPF/CNPJ *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="cpfCnpj"
                  type="text"
                  placeholder="000.000.000-00"
                  value={data.cpfCnpj || ''}
                  onChange={(e) => handleFieldChange('cpfCnpj', e.target.value)}
                  disabled={disabled}
                  className={errors.cpfCnpj ? 'border-red-300 focus:border-red-500' : ''}
                />
                <CreditCard className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {touched.cpfCnpj && errors.cpfCnpj && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.cpfCnpj}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                Telefone *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="phone"
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={data.phone || ''}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  disabled={disabled}
                  className={errors.phone ? 'border-red-300 focus:border-red-500' : ''}
                />
                <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {touched.phone && errors.phone && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="mobilePhone" className="text-sm font-medium text-gray-700">
              Celular (Opcional)
            </Label>
            <div className="relative mt-1">
              <Input
                id="mobilePhone"
                type="text"
                placeholder="(11) 99999-9999"
                value={data.mobilePhone || ''}
                onChange={(e) => handleFieldChange('mobilePhone', e.target.value)}
                disabled={disabled}
                className={errors.mobilePhone ? 'border-red-300 focus:border-red-500' : ''}
              />
              <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            {touched.mobilePhone && errors.mobilePhone && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.mobilePhone}
              </p>
            )}
          </div>

          {/* Address Information */}
          {showAddressFields && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="pt-4 border-t border-gray-200"
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-900">Endereço</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <Label htmlFor="postalCode" className="text-sm font-medium text-gray-700">
                    CEP *
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    placeholder="00000-000"
                    value={data.postalCode || ''}
                    onChange={(e) => handleFieldChange('postalCode', e.target.value)}
                    disabled={disabled}
                    className={errors.postalCode ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  {touched.postalCode && errors.postalCode && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.postalCode}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Endereço *
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="Rua, avenida..."
                    value={data.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    disabled={disabled}
                    className={errors.address ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  {touched.address && errors.address && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.address}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label htmlFor="addressNumber" className="text-sm font-medium text-gray-700">
                    Número *
                  </Label>
                  <Input
                    id="addressNumber"
                    type="text"
                    placeholder="123"
                    value={data.addressNumber || ''}
                    onChange={(e) => handleFieldChange('addressNumber', e.target.value)}
                    disabled={disabled}
                    className={errors.addressNumber ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  {touched.addressNumber && errors.addressNumber && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.addressNumber}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="complement" className="text-sm font-medium text-gray-700">
                    Complemento
                  </Label>
                  <Input
                    id="complement"
                    type="text"
                    placeholder="Apt 101"
                    value={data.complement || ''}
                    onChange={(e) => handleFieldChange('complement', e.target.value)}
                    disabled={disabled}
                  />
                </div>

                <div>
                  <Label htmlFor="province" className="text-sm font-medium text-gray-700">
                    Bairro
                  </Label>
                  <Input
                    id="province"
                    type="text"
                    placeholder="Centro"
                    value={data.province || ''}
                    onChange={(e) => handleFieldChange('province', e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                    Cidade *
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="São Paulo"
                    value={data.city || ''}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    disabled={disabled}
                    className={errors.city ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  {touched.city && errors.city && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.city}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state" className="text-sm font-medium text-gray-700">
                    Estado *
                  </Label>
                  <select
                    id="state"
                    value={data.state || ''}
                    onChange={(e) => handleFieldChange('state', e.target.value)}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.state ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Selecione o estado</option>
                    {BRAZILIAN_STATES.map(state => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  {touched.state && errors.state && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.state}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {Object.keys(errors).length === 0 && Object.keys(touched).length > 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Dados validados com sucesso!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}