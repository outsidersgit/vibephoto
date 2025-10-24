'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

interface AddCardModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function AddCardModal({ onClose, onSuccess }: AddCardModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cardData, setCardData] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  })

  const [holderInfo, setHolderInfo] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    complement: '',
    phone: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/payment-methods/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditCard: cardData,
          creditCardHolderInfo: holderInfo
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || 'Erro ao adicionar cartão')
      }
    } catch (error) {
      console.error('Error adding card:', error)
      setError('Erro ao adicionar cartão')
    } finally {
      setLoading(false)
    }
  }

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim()
  }

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-600 my-8">
        <div className="p-6 border-b border-slate-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Adicionar Cartão de Crédito</h2>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados do Cartão */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white mb-3">Dados do Cartão</h3>

            <div>
              <Label className="text-white">Nome no Cartão</Label>
              <Input
                type="text"
                value={cardData.holderName}
                onChange={(e) => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="NOME COMPLETO"
              />
            </div>

            <div>
              <Label className="text-white">Número do Cartão</Label>
              <Input
                type="text"
                value={formatCardNumber(cardData.number)}
                onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\s/g, '') })}
                required
                maxLength={19}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="1234 5678 9012 3456"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-white">Mês</Label>
                <Input
                  type="text"
                  value={cardData.expiryMonth}
                  onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  required
                  maxLength={2}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="MM"
                />
              </div>
              <div>
                <Label className="text-white">Ano</Label>
                <Input
                  type="text"
                  value={cardData.expiryYear}
                  onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  required
                  maxLength={4}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="AAAA"
                />
              </div>
              <div>
                <Label className="text-white">CVV</Label>
                <Input
                  type="text"
                  value={cardData.ccv}
                  onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  required
                  maxLength={4}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="123"
                />
              </div>
            </div>
          </div>

          {/* Dados do Titular */}
          <div className="space-y-4 border-t border-slate-600 pt-6">
            <h3 className="font-semibold text-white mb-3">Dados do Titular</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Nome Completo</Label>
                <Input
                  type="text"
                  value={holderInfo.name}
                  onChange={(e) => setHolderInfo({ ...holderInfo, name: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Email</Label>
                <Input
                  type="email"
                  value={holderInfo.email}
                  onChange={(e) => setHolderInfo({ ...holderInfo, email: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">CPF</Label>
                <Input
                  type="text"
                  value={formatCPF(holderInfo.cpfCnpj)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={14}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label className="text-white">Telefone</Label>
                <Input
                  type="text"
                  value={formatPhone(holderInfo.phone)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, phone: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={15}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-white">CEP</Label>
                <Input
                  type="text"
                  value={formatCEP(holderInfo.postalCode)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={9}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label className="text-white">Número</Label>
                <Input
                  type="text"
                  value={holderInfo.addressNumber}
                  onChange={(e) => setHolderInfo({ ...holderInfo, addressNumber: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Complemento</Label>
                <Input
                  type="text"
                  value={holderInfo.complement}
                  onChange={(e) => setHolderInfo({ ...holderInfo, complement: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processando...
                </div>
              ) : (
                'Adicionar Cartão'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
