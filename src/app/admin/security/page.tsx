import { requireAuth } from '@/lib/auth'
import { SecurityDashboard } from '@/components/admin/security-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function AdminSecurityPage() {
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
            <Shield className="w-8 h-8 text-red-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Security Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor system security, user violations, and manage content moderation
              </p>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Security Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-orange-700 space-y-2">
              <p>
                This dashboard provides access to sensitive security information and user management functions.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>All actions are logged and auditable</li>
                <li>User bans and restrictions should be used judiciously</li>
                <li>Content moderation helps maintain a safe platform</li>
                <li>Rate limiting protects against abuse and ensures fair usage</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security Dashboard */}
        <SecurityDashboard />
      </div>
    </div>
  )
}