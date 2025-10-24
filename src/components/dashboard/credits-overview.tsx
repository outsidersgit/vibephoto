'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Coins, 
  TrendingUp, 
  Calendar, 
  Clock,
  ShoppingCart,
  Download,
  HardDrive,
  Zap
} from 'lucide-react'

interface CreditUsage {
  today: number
  thisMonth: number
  totalTraining: number
  totalGeneration: number
  remaining: number
}

interface StorageUsage {
  used: number
  limit: number
  percentage: number
}

interface CreditTransaction {
  id: string
  type: 'DEBIT' | 'CREDIT'
  amount: number
  description: string
  createdAt: string
}

interface CreditsOverviewProps {
  userPlan: 'FREE' | 'PREMIUM' | 'GOLD'
}

export function CreditsOverview({ userPlan }: CreditsOverviewProps) {
  const [usage, setUsage] = useState<CreditUsage | null>(null)
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const planLimits = {
    FREE: { daily: 10, monthly: 100, storage: 1024 * 1024 * 1024 }, // 1GB
    PREMIUM: { daily: 100, monthly: 1000, storage: 10 * 1024 * 1024 * 1024 }, // 10GB
    GOLD: { daily: 500, monthly: 5000, storage: 50 * 1024 * 1024 * 1024 } // 50GB
  }

  const currentLimits = planLimits[userPlan]

  useEffect(() => {
    fetchCreditData()
  }, [])

  const fetchCreditData = async () => {
    try {
      const [usageRes, storageRes, transactionsRes] = await Promise.all([
        fetch('/api/credits?action=usage'),
        fetch('/api/credits?action=storage'),
        fetch('/api/credits?action=transactions&limit=5')
      ])

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        setUsage(usageData.data)
      }

      if (storageRes.ok) {
        const storageData = await storageRes.json()
        setStorage(storageData.data)
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json()
        setTransactions(transactionsData.data.transactions)
      }
    } catch (error) {
      console.error('Failed to fetch credit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const getTypeIcon = (type: string) => {
    return type === 'CREDIT' 
      ? <TrendingUp className="w-4 h-4 text-green-500" />
      : <Zap className="w-4 h-4 text-blue-500" />
  }

  const getTypeColor = (type: string) => {
    return type === 'CREDIT' 
      ? 'text-green-600' 
      : 'text-red-600'
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Credit Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.remaining || 0}</div>
            <p className="text-xs text-muted-foreground">
              {userPlan} plan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Usage</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.today || 0}</div>
            <div className="text-xs text-muted-foreground">
              of {currentLimits.daily} daily limit
            </div>
            <Progress 
              value={(usage?.today || 0) / currentLimits.daily * 100} 
              className="mt-2 h-1" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.thisMonth || 0}</div>
            <div className="text-xs text-muted-foreground">
              of {currentLimits.monthly} monthly limit
            </div>
            <Progress 
              value={(usage?.thisMonth || 0) / currentLimits.monthly * 100} 
              className="mt-2 h-1" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storage?.percentage || 0}%</div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(storage?.used || 0)} of {formatFileSize(storage?.limit || 0)}
            </div>
            <Progress 
              value={storage?.percentage || 0} 
              className="mt-2 h-1" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Usage Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Usage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Model Training</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{usage?.totalTraining || 0} credits</Badge>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Image Generation</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{usage?.totalGeneration || 0} credits</Badge>
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center font-medium">
                <span>Total Used</span>
                <span>{(usage?.totalTraining || 0) + (usage?.totalGeneration || 0)} credits</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Transactions
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(transaction.type)}
                      <div>
                        <div className="text-sm font-medium">
                          {transaction.description}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className={`font-medium ${getTypeColor(transaction.type)}`}>
                      {transaction.type === 'CREDIT' ? '+' : '-'}{transaction.amount}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Upgrade CTA */}
      {userPlan === 'FREE' && (usage?.thisMonth || 0) > currentLimits.monthly * 0.8 && (
        <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Upgrade Your Plan</h3>
                <p className="text-purple-100">
                  You're using {Math.round((usage?.thisMonth || 0) / currentLimits.monthly * 100)}% of your monthly credits. 
                  Upgrade for more credits and features.
                </p>
              </div>
              <Button variant="secondary" className="bg-white text-purple-600 hover:bg-gray-100">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}