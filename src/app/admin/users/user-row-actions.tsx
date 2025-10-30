'use client'

import { useEffect, useState } from 'react'

export default function UserRowActions({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any | null>(null)
  const [tab, setTab] = useState<'metrics' | 'history'>('metrics')
  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [tx, setTx] = useState<{ credits: any; photoPackages: any } | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`/api/admin/users/${userId}/metrics`)
      .then(r => r.json())
      .then(j => setData(j))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, userId])

  useEffect(() => {
    if (!open || tab !== 'history') return
    setTxLoading(true)
    setTxError(null)
    fetch(`/api/admin/users/${userId}/transactions?page=${page}&limit=20`)
      .then(r => r.json())
      .then(j => setTx(j))
      .catch(e => setTxError(e.message))
      .finally(() => setTxLoading(false))
  }, [open, tab, page, userId])

  return (
    <>
      <button className="text-purple-700 hover:underline" onClick={() => setOpen(true)}>Ver</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900">Métricas do Usuário</div>
              <button className="text-sm text-gray-600 hover:underline" onClick={() => setOpen(false)}>Fechar</button>
            </div>
            <div className="mb-3 flex gap-2 text-sm">
              <button className={`px-2 py-1 rounded border ${tab === 'metrics' ? 'bg-gray-100' : ''}`} onClick={() => setTab('metrics')}>Métricas</button>
              <button className={`px-2 py-1 rounded border ${tab === 'history' ? 'bg-gray-100' : ''}`} onClick={() => setTab('history')}>Histórico</button>
            </div>

            {tab === 'metrics' && (
              <>
                {loading && <div className="text-sm text-gray-500">Carregando…</div>}
                {error && <div className="text-sm text-red-600">{error}</div>}
                {data && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Gerações (Imagem)" value={data.totals?.imageGenerations || 0} />
                    <Metric label="Gerações (Vídeo)" value={data.totals?.videoGenerations || 0} />
                    <Metric label="Upscales" value={data.totals?.upscales || 0} />
                    <Metric label="Modelos" value={data.totals?.models || 0} />
                    <Metric label="Pacotes comprados" value={data.totals?.photoPackagesPurchased || 0} />
                    <Metric label="Créditos gastos" value={data.totals?.creditsSpent || 0} />
                    <Metric label="Créditos recebidos" value={data.totals?.creditsEarned || 0} />
                    <Metric label="Última atividade" value={data.totals?.lastActivity ? new Date(data.totals.lastActivity).toLocaleString() : '—'} />
                  </div>
                )}
              </>
            )}

            {tab === 'history' && (
              <>
                {txLoading && <div className="text-sm text-gray-500">Carregando…</div>}
                {txError && <div className="text-sm text-red-600">{txError}</div>}
                {tx && (
                  <div className="space-y-4">
                    <div>
                      <div className="font-medium mb-1">Transações de Créditos</div>
                      <div className="max-h-48 overflow-auto border rounded">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 text-left">
                            <tr>
                              <th className="px-2 py-1">Data</th>
                              <th className="px-2 py-1">Tipo</th>
                              <th className="px-2 py-1">Origem</th>
                              <th className="px-2 py-1">Qtde</th>
                              <th className="px-2 py-1">Descrição</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tx.credits.items.map((c: any) => (
                              <tr key={c.id} className="border-t">
                                <td className="px-2 py-1">{new Date(c.createdAt).toLocaleString()}</td>
                                <td className="px-2 py-1">{c.type}</td>
                                <td className="px-2 py-1">{c.source || '—'}</td>
                                <td className="px-2 py-1">{c.amount}</td>
                                <td className="px-2 py-1">{c.description || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-1">Pacotes de Fotos</div>
                      <div className="max-h-48 overflow-auto border rounded">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 text-left">
                            <tr>
                              <th className="px-2 py-1">Data</th>
                              <th className="px-2 py-1">Pacote</th>
                              <th className="px-2 py-1">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tx.photoPackages.items.map((p: any) => (
                              <tr key={p.id} className="border-t">
                                <td className="px-2 py-1">{new Date(p.createdAt).toLocaleString()}</td>
                                <td className="px-2 py-1">{p.packageId}</td>
                                <td className="px-2 py-1">{p.status || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-700">
                      <div>Página {page}</div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                        <button className="px-2 py-1 border rounded" onClick={() => setPage(p => p + 1)}>Próxima</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{String(value)}</div>
    </div>
  )
}


