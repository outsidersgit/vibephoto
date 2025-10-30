import { Metadata } from 'next'
import { FeedbackDashboard } from '@/components/admin/feedback-dashboard'

export const metadata: Metadata = {
  title: 'Feedback Dashboard | Admin',
  description: 'User feedback analytics and insights'
}

export default function AdminFeedbackPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Feedback</h1>
          <a
            href="/api/admin/feedback/export"
            className="rounded-md border px-3 py-2 text-sm"
          >
            Exportar CSV
          </a>
        </div>
        <FeedbackDashboard />
      </div>
    </div>
  )
}
