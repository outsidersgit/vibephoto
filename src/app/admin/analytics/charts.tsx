'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'

type Point = { date: string; newUsers: number; cancellations: number; generations: number }

export default function AnalyticsCharts() {
  const [data, setData] = useState<Point[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/admin/analytics/series?range=30d')
      .then(r => r.json())
      .then(j => { if (active) setData(j.series || []) })
      .catch(e => setError(e.message))
    return () => { active = false }
  }, [])

  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (!data) return <div className="text-sm text-gray-500">Carregando gráfico…</div>

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="newUsers" stroke="#10b981" name="Novos" dot={false} />
          <Line type="monotone" dataKey="cancellations" stroke="#ef4444" name="Cancelados" dot={false} />
          <Line type="monotone" dataKey="generations" stroke="#6366f1" name="Gerações" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}


