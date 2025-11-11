'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { getGenerationCostDescription } from '@/lib/utils/gallery-cost'
import { Copy } from 'lucide-react'

interface ImageDetailsDialogProps {
  generation: any | null
  open: boolean
  onClose: () => void
}

export function ImageDetailsDialog({ generation, open, onClose }: ImageDetailsDialogProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopyPrompt = async () => {
    if (!generation?.prompt) return
    try {
      await navigator.clipboard.writeText(generation.prompt)
      setCopied(true)
    } catch (error) {
      console.error('Erro ao copiar prompt:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(state) => {
      if (!state) {
        onClose()
      }
    }}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-slate-900/95 border border-slate-700/70 text-slate-100 px-6 py-6">
        <DialogTitle className="text-lg font-semibold text-white mb-4">Detalhes da imagem</DialogTitle>

        {generation ? (
          <div className="space-y-5 text-sm text-slate-200/90">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Detalhes principais</span>
              <h4 className="mt-1 text-base font-semibold text-white">Prompt</h4>
              <div className="mt-2 relative max-h-48 overflow-y-auto rounded-lg bg-white/5 px-3 py-2 leading-relaxed text-slate-100/90">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/90 transition hover:bg-white/20"
                  title="Copiar prompt"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="pr-10 whitespace-pre-wrap">
                  {generation.prompt || '—'}
                </div>
              </div>
              {copied && (
                <p className="mt-1 text-[11px] font-medium text-emerald-300">Prompt copiado!</p>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informações da geração</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-semibold text-white">Gerado em</h5>
                <p className="mt-1 text-sm text-slate-200">
                  {generation.createdAt ? formatDate(generation.createdAt) : '—'}
                </p>
              </div>
              <div>
                <h5 className="text-sm font-semibold text-white">Custo</h5>
                <p className="mt-1 text-sm text-slate-200">
                  {getGenerationCostDescription(generation) || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-semibold text-white">Modelo</h5>
                <p className="mt-1 text-sm text-slate-200">
                  {generation.model?.name || 'Indefinido'}
                </p>
              </div>
              <div>
                <h5 className="text-sm font-semibold text-white">Total de imagens</h5>
                <p className="mt-1 text-sm text-slate-200">
                  {Array.isArray(generation.imageUrls) ? generation.imageUrls.length : 1}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">Carregando informações...</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
