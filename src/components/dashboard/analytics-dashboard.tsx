'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Image as ImageIcon,
  Clock,
  Heart,
  Zap,
  Calendar,
  Target,
  Award
} from 'lucide-react'

interface UserAnalytics {
  totalModels: number
  totalGenerations: number
  totalCreditsUsed: number
  averageGenerationTime: number
  mostUsedModel: string | null
  favoriteStyle: string | null
  joinDate: string
  lastActivity: string
  planUpgrades: number
}

interface UserEngagement {
  daysActive: number
  streakDays: number
  totalSessions: number
  averageSessionTime: number
}

interface PopularPrompt {
  prompt: string
  usage: number
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [engagement, setEngagement] = useState<UserEngagement | null>(null)
  const [popularPrompts, setPopularPrompts] = useState<PopularPrompt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const [analyticsRes, engagementRes, promptsRes] = await Promise.all([
        fetch('/api/analytics?type=user'),
        fetch('/api/analytics?type=engagement'),
        fetch('/api/analytics?type=popular-prompts&limit=5')
      ])

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data.data)
      }

      if (engagementRes.ok) {
        const data = await engagementRes.json()
        setEngagement(data.data)
      }

      if (promptsRes.ok) {
        const data = await promptsRes.json()
        setPopularPrompts(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  const getEngagementLevel = (daysActive: number): { level: string; color: string } => {
    if (daysActive >= 20) return { level: 'Expert', color: 'text-purple-600' }
    if (daysActive >= 10) return { level: 'Advanced', color: 'text-blue-600' }
    if (daysActive >= 5) return { level: 'Intermediate', color: 'text-green-600' }
    return { level: 'Beginner', color: 'text-gray-600' }
  }

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

  const engagementInfo = engagement ? getEngagementLevel(engagement.daysActive) : null

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalModels || 0}</div>
            <p className="text-xs text-muted-foreground">
              AI models created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generations</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalGenerations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Images generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalCreditsUsed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total credits spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Generation</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(analytics?.averageGenerationTime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement & Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              User Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Engagement Level</span>
              <Badge variant="secondary" className={engagementInfo?.color}>
                {engagementInfo?.level}
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Days Active</span>
                  <span>{engagement?.daysActive || 0} days</span>
                </div>
                <Progress value={Math.min((engagement?.daysActive || 0) / 30 * 100, 100)} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Current Streak</span>
                  <span>{engagement?.streakDays || 0} days</span>
                </div>
                <Progress value={Math.min((engagement?.streakDays || 0) / 7 * 100, 100)} className="h-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{engagement?.totalSessions || 0}</div>
                <div className="text-xs text-gray-500">Total Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{engagement?.daysActive || 0}</div>
                <div className="text-xs text-gray-500">Active Days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Usage Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Most Used Model</span>
                <Badge variant="outline">
                  {analytics?.mostUsedModel || 'None yet'}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Favorite Style</span>
                <Badge variant="outline" className="capitalize">
                  {analytics?.favoriteStyle || 'Default'}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Member Since</span>
                <span className="text-sm font-medium">
                  {analytics?.joinDate ? formatDate(analytics.joinDate) : 'Unknown'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Activity</span>
                <span className="text-sm font-medium">
                  {analytics?.lastActivity ? formatDate(analytics.lastActivity) : 'Unknown'}
                </span>
              </div>
            </div>

            {analytics?.planUpgrades && analytics.planUpgrades > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-600">
                    {analytics.planUpgrades} plan upgrade{analytics.planUpgrades > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Popular Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Heart className="w-5 h-5 mr-2" />
            Popular Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {popularPrompts.length > 0 ? (
            <div className="space-y-3">
              {popularPrompts.map((prompt, index) => (
                <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {prompt.prompt}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-3">
                    {prompt.usage} uses
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No popular prompts yet</p>
              <p className="text-sm">Start generating images to see popular prompts!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievement Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`text-center p-4 rounded-lg ${
              (analytics?.totalModels || 0) >= 1 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`}>
              <Users className={`w-8 h-8 mx-auto mb-2 ${
                (analytics?.totalModels || 0) >= 1 ? 'text-green-600' : 'text-gray-400'
              }`} />
              <div className="text-sm font-medium">First Model</div>
              <div className="text-xs text-gray-500">Create your first AI model</div>
            </div>

            <div className={`text-center p-4 rounded-lg ${
              (analytics?.totalGenerations || 0) >= 10 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
            }`}>
              <ImageIcon className={`w-8 h-8 mx-auto mb-2 ${
                (analytics?.totalGenerations || 0) >= 10 ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <div className="text-sm font-medium">Generator</div>
              <div className="text-xs text-gray-500">Generate 10 images</div>
            </div>

            <div className={`text-center p-4 rounded-lg ${
              (engagement?.streakDays || 0) >= 7 ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
            }`}>
              <Calendar className={`w-8 h-8 mx-auto mb-2 ${
                (engagement?.streakDays || 0) >= 7 ? 'text-purple-600' : 'text-gray-400'
              }`} />
              <div className="text-sm font-medium">Consistent</div>
              <div className="text-xs text-gray-500">7-day streak</div>
            </div>

            <div className={`text-center p-4 rounded-lg ${
              (analytics?.totalCreditsUsed || 0) >= 100 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
            }`}>
              <Zap className={`w-8 h-8 mx-auto mb-2 ${
                (analytics?.totalCreditsUsed || 0) >= 100 ? 'text-yellow-600' : 'text-gray-400'
              }`} />
              <div className="text-sm font-medium">Power User</div>
              <div className="text-xs text-gray-500">Use 100 credits</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}