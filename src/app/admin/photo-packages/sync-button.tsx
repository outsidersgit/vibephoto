'use client'

export function SyncPhotoPackagesButton() {
  const handleSync = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/photo-packages/import', { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao sincronizar')
      
      // Recarrega a página para refletir novas entradas
      window.location.reload()
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
      alert('Erro ao sincronizar pacotes de fotos. Tente novamente.')
    }
  }

  return (
    <button
      className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
      onClick={handleSync}
    >
      Sincronizar do filesystem
    </button>
  )
}

