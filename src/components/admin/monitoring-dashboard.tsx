'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  Database, 
  Users, 
  Zap,
  Shield,
  Clock,
  Server,
  Cpu,
  HardDrive,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

interface SystemMetrics {
  system: {
    database_connections: number
    memory_usage_mb: number
    uptime_seconds: number
    node_version: string
    environment: string
  }
  users: {
    total_users: number
    active_users: number
    new_users: number
    plan_distribution: Record<string, number>
  }
  ai: {
    total_models: number
    total_generations: number
    completed_generations: number
    failed_generations: number
    success_rate_percent: number
    average_generation_time_ms: number
  }
  security: {
    content_violations: number
    rate_limit_violations: number
    banned_users: number
    blocked_requests: number
  }
  performance: {
    error_count: number
    average_response_time_ms: number
    slow_requests: number
  }
  range: string
  collected_at: string
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchMetrics()
    
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timeRange, autoRefresh])

  const fetchMetrics = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/monitoring/metrics?range=${timeRange}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      
      const data = await response.json()
      setMetrics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getHealthStatus = (metrics: SystemMetrics) => {
    const issues = []
    
    if (metrics.system.memory_usage_mb > 1000) issues.push('High memory usage')
    if (metrics.ai.success_rate_percent < 90) issues.push('Low AI success rate')
    if (metrics.security.content_violations > 10) issues.push('High violation rate')
    if (metrics.performance.error_count > 5) issues.push('High error rate')
    
    return {
      status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'critical',
      issues
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700">
          Failed to load monitoring data: {error}
          <Button 
            variant="link" 
            className="p-0 h-auto text-red-600" 
            onClick={fetchMetrics}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) return null

  const health = getHealthStatus(metrics)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant={
            health.status === 'healthy' ? 'default' : 
            health.status === 'warning' ? 'secondary' : 'destructive'
          }>
            {health.status.toUpperCase()}
          </Badge>
          <span className="text-sm text-gray-500">
            Updated {new Date(metrics.collected_at).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Health Issues */}
      {health.issues.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700">
            <strong>System Issues Detected:</strong>
            <ul className="list-disc list-inside mt-1">
              {health.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* System Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.database_connections}</div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.memory_usage_mb}MB</div>
            <Progress 
              value={Math.min((metrics.system.memory_usage_mb / 2048) * 100, 100)} 
              className="mt-2 h-1" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(metrics.system.uptime_seconds)}</div>
            <p className="text-xs text-muted-foreground">{metrics.system.environment}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.users.total_users}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.users.active_users} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              AI Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Success Rate</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{metrics.ai.success_rate_percent}%</span>
                {metrics.ai.success_rate_percent >= 95 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
            
            <Progress value={metrics.ai.success_rate_percent} className="h-2" />
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.ai.completed_generations}
                </div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {metrics.ai.failed_generations}
                </div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Content Violations</span>
                <Badge variant={metrics.security.content_violations > 10 ? "destructive" : "secondary"}>
                  {metrics.security.content_violations}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rate Limit Violations</span>
                <Badge variant={metrics.security.rate_limit_violations > 50 ? "destructive" : "secondary"}>
                  {metrics.security.rate_limit_violations}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Banned Users</span>
                <Badge variant="outline">
                  {metrics.security.banned_users}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {metrics.performance.average_response_time_ms}ms
              </div>
              <div className="text-sm text-gray-500">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {metrics.performance.error_count}
              </div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {metrics.ai.average_generation_time_ms}ms
              </div>
              <div className="text-sm text-gray-500">Avg Generation Time</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>User Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(metrics.users.plan_distribution).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className="capitalize font-medium">{plan}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${(count / metrics.users.total_users) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}