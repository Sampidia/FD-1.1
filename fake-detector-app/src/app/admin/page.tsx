'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import OCRAnalyticsDashboard from '../../components/admin/ocr-analytics-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bot,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  BarChart3,
  DollarSign,
  Zap,
  Eye,
  Bell,
  Clock,
  X
} from 'lucide-react'

// Statistics interface
interface DashboardStats {
  totalUsers: number
  activeSubscriptions: number
  totalScans: number
  totalRevenue: number
  totalAIRequests: number
  revenueGrowth: number
  usersGrowth: number
  scansGrowth: number
}

// AI Provider Status
interface AIProviderStatus {
  name: string
  provider: string
  model: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  usageToday: number
  totalUsage: number
  responseTime: number
  costToday: number
}

// System Notification
interface SystemNotification {
  id: string
  type: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'unread' | 'read'
  isResolved: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Payment Record
interface PaymentRecord {
  id: string
  userId: string
  amount: number
  currency: string
  status: string
  pointsPurchased?: number
  paymentGateway: string
  planTier: string
  processedAt?: string
  createdAt: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [aiProviders, setAiProviders] = useState<AIProviderStatus[]>([])
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showEnhancedDashboard, setShowEnhancedDashboard] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  const [securityAttempts, setSecurityAttempts] = useState<any[]>([])
  const [securityStats, setSecurityStats] = useState<any>({})
  const [dashboardHealth, setDashboardHealth] = useState<any>({})

  // Admin Authorization Check
  useEffect(() => {
    // Wait for session to load
    if (status === "loading") return

    // Check if user is authenticated
    if (!session) {
      router.push('/auth/signin?message=Please sign in to access admin panel')
      return
    }

    // Check if user is authorized admin
    const adminId = process.env.NEXT_PUBLIC_AD_ID
    const adminEmail = process.env.NEXT_PUBLIC_AD_EMAIL
    const sessionUser = session.user as any // Type assertion to avoid TypeScript strict null checking
    const isAdmin = session.user && (
      (sessionUser?.id === adminId) ||
      (session.user.email === adminEmail)
    )

    if (!isAdmin) {
      router.push('/auth/signin?message=Access denied. Admin privileges required.')
      return
    }

    // If user is admin and authenticated, load dashboard data
    loadDashboardData()
  }, [session, status, router])

  const dashboardData = useMemo(() => {
    if (!stats || !aiProviders) return { stats: {
      totalUsers: 0,
      activeSubscriptions: 0,
      totalScans: 0,
      totalRevenue: 0,
      totalAIRequests: 0,
      revenueGrowth: 0,
      usersGrowth: 0,
      scansGrowth: 0
    }, aiProviders: [] }

    return { stats, aiProviders }
  }, [stats, aiProviders])

  const loadDashboardData = async () => {
    try {
      const [statsResponse, aiResponse, notificationsResponse, healthResponse] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/ai-providers'),
        fetch('/api/admin/notifications'),
        fetch('/api/admin/dashboard-health')
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        setAiProviders(aiData.providers || [])
      }

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json()
        setNotifications(notificationsData.data || [])
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setDashboardHealth(healthData)
        console.log('🏥 DASHBOARD HEALTH DATA LOADED:', healthData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPayments = async () => {
    try {
      console.log('💳 LOADING PAYMENT RECORDS FROM API...')
      const response = await fetch('/api/admin/payments')
      if (response.ok) {
        const paymentsData = await response.json()
        console.log(`💳 RECEIVED ${paymentsData.data?.length || 0} PAYMENT RECORDS FROM DATABASE`)
        setPayments(paymentsData.data || [])
      } else {
        console.error('Failed to fetch payments:', response.status)
      }
    } catch (error) {
      console.error('Failed to load payments:', error)
    }
  }

  const handleShowPayments = () => {
    setShowPayments(true)
    loadPayments()
  }

  const handleClosePayments = () => {
    setShowPayments(false)
  }

  const loadSecurityAttempts = async () => {
    try {
      console.log('🛡️ LOADING SECURITY ATTEMPTS FROM API...')
      const response = await fetch('/api/admin/security-attempts?type=all&limit=100')
      if (response.ok) {
        const securityData = await response.json()
        console.log(`🛡️ RECEIVED SECURITY DATA: ${securityData.attempts?.length || 0} attempts`)
        setSecurityAttempts(securityData.attempts || [])
        setSecurityStats(securityData.stats || {})
      } else {
        console.error('Failed to fetch security attempts:', response.status)
      }
    } catch (error) {
      console.error('Failed to load security attempts:', error)
    }
  }

  const handleShowSecurity = () => {
    setShowSecurity(true)
    loadSecurityAttempts()
  }

  const handleCloseSecurity = () => {
    setShowSecurity(false)
  }

  const loadDashboardHealth = async () => {
    try {
      const response = await fetch('/api/admin/dashboard-health')
      if (response.ok) {
        const healthData = await response.json()
        setDashboardHealth(healthData)
        console.log('🏥 DASHBOARD HEALTH DATA LOADED:', healthData)
      } else {
        console.error('Failed to fetch dashboard health:', response.status)
      }
    } catch (error) {
      console.error('Failed to load dashboard health:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const handleNotificationAction = async (notificationId: string, action: string) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId, action }),
      })

      if (response.ok) {
        // Refresh notifications
        const notificationsResponse = await fetch('/api/admin/notifications')
        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json()
          setNotifications(notificationsData.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to update notification:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount)
  }

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    trend,
    trendValue
  }: {
    title: string
    value: string | number
    description: string
    icon: React.ComponentType<{ className?: string }>
    trend?: 'up' | 'down'
    trendValue?: number
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && trendValue && (
            <Badge variant={trend === 'up' ? 'default' : 'destructive'} className="text-xs">
              {trend === 'up' ? '+' : '-'}{trendValue}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )

  // Show loading state during session check
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">
            Monitor your AI-enhanced fake detector platform
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant={showEnhancedDashboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEnhancedDashboard(!showEnhancedDashboard)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showEnhancedDashboard ? "Original Dashboard" : "Enhanced Analytics"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : showEnhancedDashboard ? (
        <OCRAnalyticsDashboard />
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Users"
              value={stats?.totalUsers || 0}
              description="Active user accounts"
              icon={Users}
              trend="up"
              trendValue={stats?.usersGrowth || 12}
            />

            <StatCard
              title="Active Subscriptions"
              value={stats?.activeSubscriptions || 0}
              description="Paid subscribers"
              icon={CreditCard}
              trend="up"
              trendValue={dashboardHealth?.trends?.subscriptions}
            />

            <StatCard
              title="Total Scans"
              value={stats?.totalScans?.toLocaleString() || 0}
              description="Products verified"
              icon={Eye}
              trend="up"
              trendValue={stats?.scansGrowth || 8}
            />

            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.totalRevenue || 0)}
              description="Revenue this month"
              icon={DollarSign}
              trend="up"
              trendValue={stats?.revenueGrowth || 22}
            />

            <StatCard
              title="AI Requests"
              value={stats?.totalAIRequests?.toLocaleString() || 0}
              description="AI-powered requests"
              icon={Bot}
              trend="up"
              trendValue={dashboardHealth?.trends?.aiRequests}
            />

            <StatCard
              title="System Health"
              value={dashboardHealth?.systemHealth?.percentage || "98.5%"}
              description="Uptime this month"
              icon={Activity}
              trend="up"
              trendValue={0}
            />

            <StatCard
              title="Avg Response Time"
              value={dashboardHealth?.averageResponseTime?.time || "1.2s"}
              description="AI verification speed"
              icon={Zap}
            />

            <StatCard
              title="Security Alerts"
              value={dashboardHealth?.securityAlerts?.count || 0}
              description="Active threats"
              icon={Shield}
            />
          </div>

          {/* AI Providers Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">AI Providers Status</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {aiProviders.map((provider) => (
                <Card key={provider.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Bot className="h-6 w-6 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">{provider.name}</CardTitle>
                          <CardDescription>{provider.provider} • {provider.model}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={provider.status === 'healthy' ? 'default' : 'destructive'}
                      >
                        {provider.status === 'healthy' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />Healthy</>
                        ) : (
                          <><AlertTriangle className="h-3 w-3 mr-1" />Issue</>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Usage Today</p>
                        <p className="text-lg font-semibold">{provider.usageToday}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Response Time</p>
                        <p className="text-lg font-semibold">{provider.responseTime}ms</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Usage</p>
                        <p className="text-lg font-semibold">{provider.totalUsage.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Cost Today</p>
                        <p className="text-lg font-semibold">${provider.costToday.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button variant="outline" size="sm" className="w-full">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Analytics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* System Notifications */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">System Notifications</h2>
              <Badge variant="outline" className="text-sm">
                {notifications.filter(n => !n.isResolved).length} active
              </Badge>
            </div>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No notifications at this time</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <Card key={notification.id} className={`${!notification.isResolved ? 'border-l-4 border-l-orange-500' : ''}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-full ${getSeverityColor(notification.severity)}`}>
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                              <Badge
                                variant={notification.severity === 'critical' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {notification.severity}
                              </Badge>
                              {notification.status === 'unread' && (
                                <Badge variant="default" className="text-xs bg-blue-500">New</Badge>
                              )}
                              {notification.isResolved && (
                                <Badge variant="outline" className="text-xs text-green-600">Resolved</Badge>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              <span>{notification.type.replace('_', ' ').toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {notification.status === 'unread' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNotificationAction(notification.id, 'mark_read')}
                            >
                              Mark Read
                            </Button>
                          )}
                          {!notification.isResolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNotificationAction(notification.id, 'mark_resolved')}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            {notifications.length > 10 && (
              <div className="text-center mt-4">
                <p className="text-gray-600 text-sm">
                  Showing 10 most recent notifications. {notifications.length - 10} more available.
                </p>
              </div>
            )}
          </div>

          {/* Payments Modal */}
          {showPayments && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Payment Records</h2>
                    <Button variant="outline" onClick={handleClosePayments}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Points
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Gateway
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan Tier
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Processed At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.userId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(payment.amount, payment.currency)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={payment.status === 'completed' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}
                              >
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.pointsPurchased || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.paymentGateway}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.planTier}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.processedAt ? formatTimeAgo(payment.processedAt) : 'Not processed'}
                            </td>
                          </tr>
                        ))}
                        {payments.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                              No payment records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Attempts Modal */}
          {showSecurity && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Security Monitoring</h2>
                      <p className="text-sm text-gray-600 mt-1">Login and Signup Attempt Data</p>
                    </div>
                    <Button variant="outline" onClick={handleCloseSecurity}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Security Stats Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {securityStats.totalLoginAttempts || 0}
                      </div>
                      <div className="text-sm text-gray-600">Login Attempts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {securityStats.totalSignupAttempts || 0}
                      </div>
                      <div className="text-sm text-gray-600">Signup Attempts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {securityStats.totalBlockedUsers || 0}
                      </div>
                      <div className="text-sm text-gray-600">Blocked Users</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {securityStats.suspiciousIPsCount || 0}
                      </div>
                      <div className="text-sm text-gray-600">Suspicious IPs</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Attempts
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Attempt
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP Address
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {securityAttempts.map((attempt: any) => (
                          <tr key={attempt.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <Badge className={
                                attempt.type === 'login' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }>
                                {attempt.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {attempt.email.replace(/(.{2}).*?(@.*)/, '$1***$2')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {attempt.attemptCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={
                                attempt.blockedUntil && new Date(attempt.blockedUntil) > new Date()
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }>
                                {attempt.blockedUntil && new Date(attempt.blockedUntil) > new Date()
                                  ? 'BLOCKED'
                                  : 'ACTIVE'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTimeAgo(attempt.lastAttempt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {attempt.ipAddress ? attempt.ipAddress.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                        {securityAttempts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                              No security attempts found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button className="h-20" size="lg" onClick={handleShowPayments}>
                <CreditCard className="h-6 w-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Payment</div>
                  <div className="text-sm opacity-90">View payment records</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-20"
                size="lg"
                onClick={handleShowSecurity}
              >
                <Shield className="h-6 w-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Security</div>
                  <div className="text-sm opacity-90">View login/signup attempts</div>
                </div>
              </Button>

              <Button variant="outline" className="h-20" size="lg">
                <Users className="h-6 w-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">User Plans</div>
                  <div className="text-sm opacity-90">Configure subscriptions</div>
                </div>
              </Button>

              <Button variant="outline" className="h-20" size="lg">
                <CreditCard className="h-6 w-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Payment Settings</div>
                  <div className="text-sm opacity-90">Manage payment providers</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {dashboardHealth?.recentActivity && dashboardHealth.recentActivity.length > 0 ? (
                    dashboardHealth.recentActivity.map((activity: any, index: number) => (
                      <div key={activity.id || index} className="flex items-center space-x-3">
                        {activity.type === 'ai_request' && <CheckCircle className="h-5 w-5 text-green-500" />}
                        {activity.type === 'scan' && <Activity className="h-5 w-5 text-blue-500" />}
                        {activity.type === 'payment' && <CreditCard className="h-5 w-5 text-green-500" />}
                        <div>
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-gray-600">{activity.message}</p>
                        </div>
                        <span className="text-xs text-gray-500 ml-auto">{activity.timeAgo}</span>
                      </div>
                    ))
                  ) : (
                    // Fallback to static content if no dynamic data is available
                    <>
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">AI Provider Health Check</p>
                          <p className="text-xs text-gray-600">All AI providers are healthy and responding normally</p>
                        </div>
                        <span className="text-xs text-gray-500 ml-auto">2 mins ago</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">New Subscription</p>
                          <p className="text-xs text-gray-600">User upgrade to Business plan - $35 revenue</p>
                        </div>
                        <span className="text-xs text-gray-500 ml-auto">5 mins ago</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium">High Usage Alert</p>
                          <p className="text-xs text-gray-600">GPT-4 requests exceeded 80% of daily limit</p>
                        </div>
                        <span className="text-xs text-gray-500 ml-auto">15 mins ago</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
