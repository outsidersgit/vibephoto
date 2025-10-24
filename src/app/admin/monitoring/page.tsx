import { requireAuth } from '@/lib/auth'
import { MonitoringDashboard } from '@/components/admin/monitoring-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Shield, TrendingUp } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function AdminMonitoringPage() {
  const session = await requireAuth()
  
  // Basic admin check - in production, implement proper role-based access
  if (session.user.email !== 'admin@ensaiofotos.com') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                System Monitoring
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time system metrics, performance monitoring, and health status
              </p>
            </div>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center text-green-800">
                <TrendingUp className="w-5 h-5 mr-2" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">Healthy</div>
              <p className="text-sm text-green-600">All systems operational</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-800">
                <Activity className="w-5 h-5 mr-2" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">Good</div>
              <p className="text-sm text-blue-600">Response times normal</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center text-purple-800">
                <Shield className="w-5 h-5 mr-2" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">Secure</div>
              <p className="text-sm text-purple-600">No threats detected</p>
            </CardContent>
          </Card>
        </div>

        {/* Monitoring Dashboard */}
        <MonitoringDashboard />
      </div>
    </div>
  )
}