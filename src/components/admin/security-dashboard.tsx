'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  TrendingDown,
  Ban,
  UserX,
  Clock,
  Activity,
  Eye,
  Search
} from 'lucide-react'

interface SystemStats {
  totalRequests: number
  violatedRequests: number
  topUsers: Array<{ userId: string; count: number }>
  topActions: Array<{ action: string; count: number }>
}

interface ViolationStats {
  total: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
  recent: number
}

interface UserStatus {
  isBanned: boolean
  isRestricted: boolean
  violationCount: number
  banReason?: string
  rateLimits: Record<string, {
    current: number
    limit: number
    resetTime: Date
  }>
}

export function SecurityDashboard() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [violationStats, setViolationStats] = useState<ViolationStats | null>(null)
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null)
  const [searchUserId, setSearchUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchSystemData()
  }, [])

  const fetchSystemData = async () => {
    try {
      const [statsRes, violationsRes] = await Promise.all([
        fetch('/api/security?action=system-stats'),
        fetch('/api/security?action=violation-stats')
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setSystemStats(data.data)
      }

      if (violationsRes.ok) {
        const data = await violationsRes.json()
        setViolationStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch system data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchUser = async () => {
    if (!searchUserId.trim()) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/security?action=user-status&userId=${searchUserId}`)
      if (response.ok) {
        const data = await response.json()
        setUserStatus(data.data)
      } else {
        setUserStatus(null)
        alert('User not found or error occurred')
      }
    } catch (error) {
      console.error('Failed to search user:', error)
      alert('Failed to search user')
    } finally {
      setActionLoading(false)
    }
  }

  const performUserAction = async (action: string) => {
    if (!searchUserId.trim()) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          userId: searchUserId,
          reason: banReason || undefined
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(data.message)
        await searchUser() // Refresh user status
        setBanReason('')
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Failed to perform action:', error)
      alert('Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const cleanupLogs = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'cleanup-logs'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(data.message)
        await fetchSystemData() // Refresh stats
      } else {
        alert(data.error || 'Cleanup failed')
      }
    } catch (error) {
      console.error('Failed to cleanup logs:', error)
      alert('Cleanup failed')
    } finally {
      setActionLoading(false)
    }
  }

  const violationRate = systemStats 
    ? Math.round((systemStats.violatedRequests / systemStats.totalRequests) * 100)
    : 0

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats?.totalRequests || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{systemStats?.violatedRequests || 0}</div>
            <p className="text-xs text-muted-foreground">{violationRate}% violation rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Violations</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{violationStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">{violationStats?.recent || 0} this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats?.topUsers.filter(u => u.count > 50).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Users with many violations</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="w-5 h-5 mr-2" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="Enter user ID to search"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={searchUser} disabled={actionLoading}>
                <Eye className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {userStatus && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <Badge variant={userStatus.isBanned ? "destructive" : userStatus.isRestricted ? "secondary" : "default"}>
                  {userStatus.isBanned ? 'BANNED' : userStatus.isRestricted ? 'RESTRICTED' : 'ACTIVE'}
                </Badge>
                <span className="text-sm text-gray-600">
                  {userStatus.violationCount} violations
                </span>
              </div>

              {userStatus.banReason && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Reason: {userStatus.banReason}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3">
                <Label htmlFor="banReason">Action Reason</Label>
                <Textarea
                  id="banReason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for action (optional)"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                {!userStatus.isBanned && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => performUserAction('ban-user')}
                    disabled={actionLoading}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Ban User
                  </Button>
                )}
                
                {userStatus.isBanned && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => performUserAction('unban-user')}
                    disabled={actionLoading}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unban User
                  </Button>
                )}

                {!userStatus.isRestricted && !userStatus.isBanned && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => performUserAction('restrict-user')}
                    disabled={actionLoading}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Restrict User
                  </Button>
                )}
              </div>

              {/* Rate Limit Status */}
              <div className="pt-3 border-t">
                <h4 className="font-medium mb-2">Rate Limit Status</h4>
                <div className="grid gap-2 text-sm">
                  {Object.entries(userStatus.rateLimits).map(([action, limit]) => (
                    <div key={action} className="flex justify-between">
                      <span className="capitalize">{action}:</span>
                      <span>{limit.current}/{limit.limit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violation Categories */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Violation Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {violationStats?.byCategory && Object.keys(violationStats.byCategory).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(violationStats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="capitalize text-sm">{category.replace('_', ' ')}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No violations recorded</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {systemStats?.topActions && systemStats.topActions.length > 0 ? (
              <div className="space-y-3">
                {systemStats.topActions.map((action, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="capitalize text-sm">{action.action}</span>
                    <Badge variant="outline">{action.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No action data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System Maintenance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              variant="outline"
              onClick={cleanupLogs}
              disabled={actionLoading}
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Cleanup Old Logs
            </Button>
            <Button 
              variant="outline"
              onClick={fetchSystemData}
              disabled={loading}
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}