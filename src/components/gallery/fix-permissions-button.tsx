'use client'

import { useState } from 'react'

export function FixPermissionsButton() {
  const [isFixing, setIsFixing] = useState(false)
  const [lastFix, setLastFix] = useState<Date | null>(null)
  const [fixResult, setFixResult] = useState<any>(null)

  const handleFix = async () => {
    if (isFixing) return

    setIsFixing(true)
    setFixResult(null)
    
    try {
      console.log('🔧 S3 permissions fix triggered...')
      
      const response = await fetch('/api/fix-s3-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ S3 permissions fix completed:', data)
        
        setLastFix(new Date())
        setFixResult(data)
        
        if (data.fixedCount > 0) {
          alert(`🔧 PERMISSÕES CORRIGIDAS: ${data.fixedCount} imagens agora são públicas!\n\nAs imagens devem carregar normalmente agora.`)
          // Refresh the page to show fixed images
          window.location.reload()
        } else {
          alert('ℹ️ Nenhuma permissão precisava ser corrigida.')
        }
      } else {
        console.error('❌ S3 permissions fix failed:', response.statusText)
        alert('❌ Erro ao corrigir permissões. Tente novamente.')
      }
    } catch (error) {
      console.error('❌ S3 permissions fix error:', error)
      alert('❌ Erro ao corrigir permissões. Verifique o console para detalhes.')
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleFix}
        disabled={isFixing}
        className={`
          inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md
          ${isFixing 
            ? 'border-orange-300 text-orange-400 bg-orange-50 cursor-not-allowed' 
            : 'border-orange-500 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'
          }
        `}
        title="Corrigir permissões do S3 para tornar imagens públicas"
      >
        <span className={`mr-2 ${isFixing ? 'animate-spin' : ''}`}>
          {isFixing ? '⏳' : '🔧'}
        </span>
        {isFixing ? 'Corrigindo...' : 'Fix S3'}
      </button>
      
      {lastFix && (
        <div className="text-xs text-gray-500 text-center">
          <p>Última correção: {lastFix.toLocaleTimeString()}</p>
          {fixResult && (
            <p>
              {fixResult.fixedCount} corrigidas, {fixResult.errorCount} erros
            </p>
          )}
        </div>
      )}
    </div>
  )
}