'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface AccountDeletionModalProps {
  isOpen: boolean
  onClose: () => void
  hasActiveSubscription: boolean
}

export function AccountDeletionModal({ isOpen, onClose, hasActiveSubscription }: AccountDeletionModalProps) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false)

  // Debug log when modal opens
  if (isOpen) {
    console.log('🔍 Account Deletion Modal - hasActiveSubscription:', hasActiveSubscription)
  }

  const handleCancelSubscription = () => {
    onClose()
    router.push('/billing')
  }

  const handleContinueToDelete = () => {
    setShowFinalConfirmation(true)
  }

  const handleConfirmDeletion = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao excluir conta')
      }

      addToast({
        title: 'Conta excluída com sucesso',
        description: result.message || 'Sua conta foi excluída. Você será redirecionado para a página inicial.',
        type: 'success',
        duration: 8000
      })

      // Wait a moment for user to read the message, then sign out
      setTimeout(() => {
        signOut({ callbackUrl: '/' })
      }, 2000)

    } catch (error) {
      console.error('Error deleting account:', error)
      addToast({
        title: 'Erro ao excluir conta',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao excluir sua conta.',
        type: 'error'
      })
      setIsDeleting(false)
    }
  }

  const handleBack = () => {
    setShowFinalConfirmation(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1e293b] border-slate-600 text-white max-w-lg">
        {!showFinalConfirmation ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">
                {hasActiveSubscription ? '⚠️ Atenção!' : 'Confirmar Exclusão de Conta'}
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-sm leading-relaxed mt-2">
                {hasActiveSubscription ? (
                  <>
                    <p className="mb-3">
                      Você ainda possui uma assinatura ativa vinculada à sua conta.
                    </p>
                    <p className="mb-3">
                      Para evitar cobranças futuras, cancele sua assinatura antes de excluir sua conta.
                      Caso já tenha cancelado, ou deseje prosseguir mesmo assim, clique em Continuar.
                    </p>
                    <p className="text-amber-300 font-medium">
                      🔸 Ao excluir sua conta agora, seu acesso será encerrado imediatamente, mesmo que ainda restem dias do ciclo atual.
                    </p>
                  </>
                ) : (
                  <p>
                    Tem certeza que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão permanentemente removidos.
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 mt-6">
              {hasActiveSubscription && (
                <Button
                  onClick={handleCancelSubscription}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white border-0"
                >
                  Cancelar assinatura
                </Button>
              )}

              <Button
                onClick={hasActiveSubscription ? handleContinueToDelete : handleConfirmDeletion}
                disabled={isDeleting}
                className="w-full bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {isDeleting ? 'Excluindo...' : hasActiveSubscription ? 'Continuar e excluir conta' : 'Confirmar exclusão'}
              </Button>

              <Button
                onClick={onClose}
                disabled={isDeleting}
                variant="ghost"
                className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">
                Confirmação Final
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-sm leading-relaxed mt-2">
                <p className="mb-3">
                  Esta é sua última chance de cancelar. Ao confirmar:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Todos os seus modelos de IA serão excluídos</li>
                  <li>Todas as suas gerações serão removidas</li>
                  <li>Seu histórico de créditos será apagado</li>
                  <li>Você perderá acesso imediato à plataforma</li>
                </ul>
                {hasActiveSubscription && (
                  <p className="mt-3 text-amber-300 font-medium">
                    Sua assinatura continuará válida até o fim do período já pago. Nenhuma cobrança adicional será gerada após esse período.
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 mt-6">
              <Button
                onClick={handleConfirmDeletion}
                disabled={isDeleting}
                className="w-full bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {isDeleting ? 'Excluindo conta...' : 'Sim, excluir minha conta permanentemente'}
              </Button>

              <Button
                onClick={handleBack}
                disabled={isDeleting}
                variant="ghost"
                className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-800"
              >
                Voltar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
