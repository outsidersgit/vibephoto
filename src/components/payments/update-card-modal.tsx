'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, AlertCircle } from 'lucide-react'

interface UpdateCardModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function UpdateCardModal({ onClose, onSuccess }: UpdateCardModalProps) {
  const { data: session } = useSession()
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
    province: '',
    city: '',
    state: '',
    phone: ''
  })

  // Pre-fill user data
  useEffect(() => {
    if (session?.user) {
      setCardData(prev => ({
        ...prev,
        holderName: session.user.name || ''
      }))
      setHolderInfo(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || ''
      }))
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/payments/subscriptions/update-card', {
        method: 'PUT',
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
        setError(data.error || 'Erro ao atualizar cartão')
      }
    } catch (error) {
      console.error('Error updating card:', error)
      setError('Erro ao atualizar cartão')
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-600 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-600 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Atualizar Método de Pagamento</h2>
              <p className="text-xs text-slate-300 mt-1">
                O cartão anterior será excluído automaticamente após a atualização
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo sem scroll */}
        <div className="flex-1 px-4 overflow-hidden">
          <form onSubmit={handleSubmit} className="py-2.5 space-y-2.5 h-full flex flex-col">

          {/* Dados do Cartão */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white border-b border-slate-600/30 pb-1">Dados do Novo Cartão</h3>

            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <Label className="text-white/80 text-xs">Nome no Cartão</Label>
                <Input
                  type="text"
                  value={cardData.holderName}
                  onChange={(e) => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                  required
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="NOME COMPLETO"
                />
              </div>

              <div>
                <Label className="text-white/80 text-xs">Número do Cartão</Label>
                <Input
                  type="text"
                  value={formatCardNumber(cardData.number)}
                  onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\s/g, '') })}
                  required
                  maxLength={19}
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="1234 5678 9012 3456"
                />
              </div>

              <div>
                <Label className="text-white/80 text-xs">Validade (MM/AAAA)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    value={cardData.expiryMonth}
                    onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    required
                    maxLength={2}
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                    placeholder="MM"
                  />
                  <Input
                    type="text"
                    value={cardData.expiryYear}
                    onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    required
                    maxLength={4}
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                    placeholder="AAAA"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white/80 text-xs">CVV</Label>
                <Input
                  type="text"
                  value={cardData.ccv}
                  onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  required
                  maxLength={4}
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="123"
                />
              </div>
            </div>
          </div>

          {/* Dados do Titular */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white border-b border-slate-600/30 pb-1">Dados do Titular</h3>

            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <Label className="text-white/80 text-xs">Nome Completo</Label>
                <Input
                  type="text"
                  value={holderInfo.name}
                  onChange={(e) => setHolderInfo({ ...holderInfo, name: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-white/80 text-xs">Email</Label>
                <Input
                  type="email"
                  value={holderInfo.email}
                  onChange={(e) => setHolderInfo({ ...holderInfo, email: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-white/80 text-xs">CPF/CNPJ</Label>
                <Input
                  type="text"
                  value={formatCPF(holderInfo.cpfCnpj)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={14}
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label className="text-white/80 text-xs">Telefone</Label>
                <Input
                  type="text"
                  value={formatPhone(holderInfo.phone)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, phone: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={15}
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <Label className="text-white/80 text-xs">CEP</Label>
                <Input
                  type="text"
                  value={formatCEP(holderInfo.postalCode)}
                  onChange={(e) => setHolderInfo({ ...holderInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength={9}
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  placeholder="00000-000"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-white/80 text-xs">Nº</Label>
                  <Input
                    type="text"
                    value={holderInfo.addressNumber}
                    onChange={(e) => setHolderInfo({ ...holderInfo, addressNumber: e.target.value })}
                    required
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-white/80 text-xs">Compl.</Label>
                  <Input
                    type="text"
                    value={holderInfo.complement}
                    onChange={(e) => setHolderInfo({ ...holderInfo, complement: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                    placeholder="Apto"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white/80 text-xs">Bairro</Label>
                <Input
                  type="text"
                  value={holderInfo.province}
                  onChange={(e) => setHolderInfo({ ...holderInfo, province: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-white/80 text-xs">Cidade</Label>
                  <Input
                    type="text"
                    value={holderInfo.city}
                    onChange={(e) => setHolderInfo({ ...holderInfo, city: e.target.value })}
                    required
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-white/80 text-xs">UF</Label>
                  <Input
                    type="text"
                    value={holderInfo.state}
                    onChange={(e) => setHolderInfo({ ...holderInfo, state: e.target.value.toUpperCase() })}
                    required
                    maxLength={2}
                    className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
                    placeholder="SP"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-2 text-red-300 text-xs">
              {error}
            </div>
          )}
          </form>
        </div>

        {/* Footer fixo */}
        <div className="flex gap-3 p-4 border-t border-slate-600 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600 h-10 text-sm"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault()
              const form = e.currentTarget.closest('.max-w-5xl')?.querySelector('form')
              if (form) {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
                form.dispatchEvent(submitEvent)
              }
            }}
            className="flex-1 bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white shadow-lg shadow-[#667EEA]/25 transition-all duration-200 h-10 text-sm font-medium"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Processando...
              </div>
            ) : (
              'Atualizar Pagamento'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
