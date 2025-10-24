'use client'

import { ConsentModal } from '@/components/legal/consent-modal'
import { useConsent } from '@/hooks/use-consent'

interface ConsentProviderProps {
  children: React.ReactNode
}

export function ConsentProvider({ children }: ConsentProviderProps) {
  const { showModal, saveConsent, setShowModal } = useConsent()

  return (
    <>
      {children}
      <ConsentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConsentGiven={saveConsent}
      />
    </>
  )
}