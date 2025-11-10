'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { getGenerationCostDescription } from '@/lib/utils/gallery-cost'

interface ImageDetailsDialogProps {
  generation: any | null
  open: boolean
  onClose: () => void
}

export function ImageDetailsDialog({ generation, open, onClose }: ImageDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(state) => {
      if (!state) {
        onClose()
      }
    }}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-slate-900/95 border border-slate-700/70 text-slate-100 px-6 py-6">
        <DialogTitle className="text-lg font-semibold text-white mb-4">Detalhes da imagem</DialogTitle>

        {generation ? (
          <div className="space-y-4 text-sm text-slate-200/90">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400">Prompt</span>
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-white/5 px-3 py-2 leading-relaxed text-slate-100/90">
                {generation.prompt || '—'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Gerado em</span>
                <p className="mt-1 text-sm text-slate-100/80">
                  {generation.createdAt ? formatDate(generation.createdAt) : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Custo</span>
                <p className="mt-1 text-sm text-slate-100/80">
                  {getGenerationCostDescription(generation) || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Modelo</span>
                <p className="mt-1 text-sm text-slate-100/80">
                  {generation.model?.name || 'Indefinido'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Total de imagens</span>
                <p className="mt-1 text-sm text-slate-100/80">
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
