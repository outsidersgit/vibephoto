'use client'

import { useState, useEffect } from 'react'
import { Star, TrendingUp, MessageSquare, Users, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface FeedbackAnalytics {
  averageRating: number
  totalFeedbacks: number
  ratingDistribution: { rating: number; count: number }[]
  recentFeedbacks: {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    user: {
      name: string | null
      email: string
    }
    generation: {
      id: string
      prompt: string
    }
  }[]
}

export function FeedbackDashboard() {
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/feedback')

      if (!response.ok) {
        throw new Error('Failed to fetch feedback analytics')
      }

      const result = await response.json()
      setAnalytics(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">❌ {error}</p>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No feedback data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Feedback Dashboard</h2>
          <p className="text-gray-600 mt-1">Análise de satisfação dos usuários</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Average Rating */}
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avaliação Média</p>
              <div className="flex items-center mt-2">
                <span className="text-3xl font-bold text-gray-900">
                  {analytics.averageRating.toFixed(1)}
                </span>
                <Star className="w-6 h-6 ml-2 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">de 5.0 estrelas</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        {/* Total Feedbacks */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Feedbacks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.totalFeedbacks}
              </p>
              <p className="text-xs text-gray-500 mt-1">avaliações recebidas</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Satisfaction Rate */}
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taxa de Satisfação</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.totalFeedbacks > 0
                  ? Math.round(
                      (analytics.ratingDistribution
                        .filter(r => r.rating >= 4)
                        .reduce((sum, r) => sum + r.count, 0) /
                        analytics.totalFeedbacks) *
                        100
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500 mt-1">avaliações 4+ estrelas</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Distribuição de Avaliações
        </h3>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(rating => {
            const data = analytics.ratingDistribution.find(r => r.rating === rating)
            const count = data?.count || 0
            const percentage =
              analytics.totalFeedbacks > 0
                ? (count / analytics.totalFeedbacks) * 100
                : 0

            return (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm font-medium text-gray-700">{rating}</span>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      rating >= 4
                        ? 'bg-green-500'
                        : rating === 3
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600 w-16 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Recent Feedbacks */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Feedbacks Recentes
        </h3>
        <div className="space-y-4">
          {analytics.recentFeedbacks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum feedback ainda</p>
          ) : (
            analytics.recentFeedbacks.map(feedback => (
              <div
                key={feedback.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= feedback.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {feedback.user.name || feedback.user.email}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(feedback.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {feedback.comment && (
                  <p className="text-sm text-gray-700 mb-2 italic">
                    "{feedback.comment}"
                  </p>
                )}

                <p className="text-xs text-gray-500 truncate">
                  Prompt: {feedback.generation.prompt}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
