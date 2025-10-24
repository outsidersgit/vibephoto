'use client'

import { useState } from 'react'

export function RecoveryButton() {
  const [isRecovering, setIsRecovering] = useState(false)
  const [lastRecovery, setLastRecovery] = useState<Date | null>(null)
  const [recoveryResult, setRecoveryResult] = useState<any>(null)

  const handleRecovery = async () => {
    if (isRecovering) return

    setIsRecovering(true)
    setRecoveryResult(null)
    
    try {
      console.log('🚨 Emergency recovery triggered...')
      
      const response = await fetch('/api/emergency-recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Emergency recovery completed:', data)
        
        setLastRecovery(new Date())
        setRecoveryResult(data)
        
        if (data.recoveredCount > 0) {
          alert(`🚨 RECUPERAÇÃO: ${data.recoveredCount} gerações recuperadas com sucesso!\n\nAs imagens agora estão disponíveis permanentemente.`)
          // Refresh the page to show recovered images
          window.location.reload()
        } else {
          alert('ℹ️ Nenhuma geração precisava de recuperação.')
        }
      } else {
        console.error('❌ Emergency recovery failed:', response.statusText)
        alert('❌ Erro na recuperação. Tente novamente.')
      }
    } catch (error) {
      console.error('❌ Emergency recovery error:', error)
      alert('❌ Erro na recuperação. Verifique o console para detalhes.')
    } finally {
      setIsRecovering(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleRecovery}
        disabled={isRecovering}
        className={`
          inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md
          ${isRecovering 
            ? 'border-red-300 text-red-400 bg-red-50 cursor-not-allowed' 
            : 'border-red-500 text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
          }
        `}
        title="Recuperar imagens de gerações completadas com URLs expiradas"
      >
        <span className={`mr-2 ${isRecovering ? 'animate-pulse' : ''}`}>
          {isRecovering ? '⏳' : '🚨'}
        </span>
        {isRecovering ? 'Recuperando...' : 'Recovery'}
      </button>
      
      {lastRecovery && (
        <div className="text-xs text-gray-500 text-center">
          <p>Última recovery: {lastRecovery.toLocaleTimeString()}</p>
          {recoveryResult && (
            <p>
              {recoveryResult.recoveredCount} recuperadas, {recoveryResult.errorCount} erros
            </p>
          )}
        </div>
      )}
    </div>
  )
}