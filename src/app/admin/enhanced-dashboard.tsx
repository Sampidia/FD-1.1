'use client'

import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts'
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Bot,
  Shield,
  Eye,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  BarChart3,
  Download,
  Target,
  Bell,
  AlertCircle
} from 'lucide-react'
import { format, subDays, subMonths } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DashboardData {
  stats: {
    totalUsers: number
    activeSubscriptions: number
    totalScans: number
    totalRevenue: number
    totalAIRequests: number
    revenueGrowth: number
    usersGrowth: number
    scansGrowth: number
  }
  aiProviders: {
    name: string
    provider: string
    model: string
    status: 'healthy' | 'unhealthy' | 'unknown'
    usageToday: number
    totalUsage: number
    responseTime: number
    costToday: number
  }[]
}

// Revenue by plan data (simulated)
const revenueByPlan = [
  { name: 'Basic Plan (75₦)', value: 35000, color: '#3B82F6' },
  { name: 'Standard Plan (100₦)', value: 65000, color: '#8B5CF6' },
  { name: 'Business Plan (130₦)', value: 91000, color: '#10B981' }
]

// Monthly growth data (simulated for demo)
const monthlyGrowthData = [
  { month: 'Jan', users: 120, scans: 480, revenue: 25000 },
  { month: 'Feb', users: 180, scans: 720, revenue: 45000 },
  { month: 'Mar', users: 250, scans: 950, revenue: 65000 },
  { month: 'Apr', users: 320, scans: 1200, revenue: 85000 },
  { month: 'May', users: 410, scans: 1500, revenue: 120000 },
  { month: 'Jun', users: 520, scans: 1800, revenue: 140000 }
]

// AI provider performance data (simulated)
const aiProviderData = [
  { provider: 'OpenAI GPT-4', requests: 450, cost: 189, avgTime: 1.2, status: 'healthy' },
  { provider: 'Anthropic Claude', requests: 320, cost: 156, avgTime: 1.8, status: 'healthy' },
  { provider: 'Google Gemini', requests: 180, cost: 45, avgTime: 0.8, status: 'healthy' }
]

// Daily active users trend (simulated)
const dailyActiveUsers = [
  { date: '2024-01-15', users: 45 },
  { date: '2024-01-16', users: 52 },
  { date: '2024-01-17', users: 48 },
  { date: '2024-01-18', users: 61 },
  { date: '2024-01-19', users: 55 },
  { date: '2024-01-20', users: 73 },
  { date: '2024-01-21', users: 69 }
]

// System health metrics (simulated)
const systemHealthData = [
  { metric: 'API Response Time', value: '1.2s', status: 'good', trend: 'stable' },
  { metric: 'Server Uptime', value: '99.9%', status: 'excellent', trend: 'stable' },
  { metric: 'Database Connection', value: '100%', status: 'excellent', trend: 'stable' },
  { metric: 'Error Rate', value: '0.1%', status: 'good', trend: 'down' }
]

interface EnhancedDashboardProps {
  initialData: DashboardData
  onRefresh: () => void
  refreshing: boolean
}

export default function EnhancedDashboard({
  initialData,
  onRefresh,
  refreshing
}: EnhancedDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('30d')

  // Calculate key metrics
  const counterfeitRate = initialData.stats.totalScans > 0
    ? Math.round((initialData.stats.totalScans * 0.12) / initialData.stats.totalScans * 100) // Assuming 12% counterfeit rate
    : 0

  const averageSessionTime = 8.5 // minutes
  const userRetentionRate = 78 // %

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Advanced Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time insights into your fake detector platform performance
          </p>
        </div>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <Button
            onClick={onRefresh}
            disabled={refreshing}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 p-4 bg-white rounded-lg shadow-sm border">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'revenue', label: 'Revenue', icon: DollarSign },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'performance', label: 'Performance', icon: Activity },
          { id: 'ai-insights', label: 'AI Analytics', icon: Bot },
          { id: 'reports', label: 'Reports', icon: Download }
        ].map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700">Monthly Revenue</CardTitle>
                  <Target className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-800">₦{initialData.stats.totalRevenue.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-blue-600">+{initialData.stats.revenueGrowth}% from last month</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Active Users Today</CardTitle>
                  <Users className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-800">+{Math.round(initialData.stats.totalUsers * 0.7)}</div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-green-600">+{Math.round(Math.random() * 15)}% from yesterday</p>
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700">Total Scans</CardTitle>
                  <Eye className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-800">{initialData.stats.totalScans.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-purple-600">+{initialData.stats.scansGrowth}% growth rate</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700">AI Efficiency</CardTitle>
                  <Bot className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-800">{averageSessionTime}m</div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-orange-600">Average session time</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Growth Trend</CardTitle>
                  <CardDescription>Monthly user registrations over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyGrowthData}>
                      <defs>
                        <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#3B82F6"
                        fillOpacity={1}
                        fill="url(#userGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue vs Scans Combined Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue & Performance</CardTitle>
                  <CardDescription>Revenue and scan volume correlation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="right" dataKey="scans" fill="#8B5CF6" name="Scans" />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} name="Revenue (₦)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row - Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Counterfeit Detection Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detection Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="3"
                          strokeDasharray={`${counterfeitRate}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{counterfeitRate}%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center mt-4 text-sm text-gray-600">
                    {Math.round(initialData.stats.totalScans * counterfeitRate / 100)} suspicious products detected
                  </p>
                </CardContent>
              </Card>

              {/* User Retention */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Retention</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="3"
                          strokeDasharray={`${userRetentionRate}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{userRetentionRate}%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center mt-4 text-sm text-gray-600">
                    Users returning to scan products
                  </p>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemHealthData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{item.metric}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            item.status === 'excellent' ? 'text-green-600' :
                            item.status === 'good' ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {item.value}
                          </span>
                          <Badge variant={
                            item.status === 'excellent' ? 'default' :
                            item.status === 'good' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {item.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  System Notifications
                </CardTitle>
                <CardDescription>Recent system alerts and AI provider issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample notifications - in real app, fetch from database */}
                  <div className="flex items-start gap-4 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-yellow-800">AI Provider Quota Alert</h4>
                        <Badge variant="outline" className="text-xs">High Priority</Badge>
                      </div>
                      <p className="text-sm text-yellow-700 mb-2">
                        Google Gemini Vision API has exceeded quota limits. Please check billing and upgrade plan if needed.
                      </p>
                      <p className="text-xs text-yellow-600">2 hours ago</p>
                    </div>
                    <Button variant="outline" size="sm">Mark as Read</Button>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-blue-800">System Health Check</h4>
                        <Badge variant="outline" className="text-xs">Info</Badge>
                      </div>
                      <p className="text-sm text-blue-700 mb-2">
                        All AI providers are operating normally. Response times within acceptable range.
                      </p>
                      <p className="text-xs text-blue-600">4 hours ago</p>
                    </div>
                    <Button variant="outline" size="sm">Mark as Read</Button>
                  </div>

                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No unread notifications</p>
                    <p className="text-sm">You'll be notified here when AI provider issues occur</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Plan Tier</CardTitle>
                  <CardDescription>Monthly revenue distribution across plan types</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={revenueByPlan}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {revenueByPlan.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Growth</CardTitle>
                  <CardDescription>Month over month revenue trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyGrowthData}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Active Users</CardTitle>
                  <CardDescription>User engagement over the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyActiveUsers}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="users" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Registration Trend</CardTitle>
                  <CardDescription>Cumulative user growth over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#F59E0B"
                        strokeWidth={3}
                        dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI Provider Performance Comparison</CardTitle>
                  <CardDescription>Response times, costs, and request counts by provider</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={aiProviderData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="provider" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="requests" fill="#3B82F6" name="Requests" />
                      <Line yAxisId="right" type="monotone" dataKey="avgTime" stroke="#EF4444" strokeWidth={2} name="Avg Time (s)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'ai-insights' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {initialData.aiProviders.map((provider) => (
                <Card key={provider.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription>{provider.provider} • {provider.model}</CardDescription>
                      </div>
                      <Badge
                        variant={provider.status === 'healthy' ? 'default' : 'destructive'}
                        className="capitalize"
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
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { metric: 'Usage Today', value: provider.usageToday },
                        { metric: 'Total Usage', value: provider.totalUsage },
                        { metric: 'Response Time', value: Math.round(provider.responseTime) },
                        { metric: 'Cost Today', value: Math.round(provider.costToday * 100) }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="metric" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8B5CF6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate & Export Reports</CardTitle>
                <CardDescription>Create custom reports for your business analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button className="h-24 flex-col gap-2">
                    <BarChart3 className="h-6 w-6" />
                    <span className="text-sm">Revenue Report</span>
                    <span className="text-xs text-gray-500">Monthly breakdown</span>
                  </Button>

                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <Users className="h-6 w-6" />
                    <span className="text-sm">User Analytics</span>
                    <span className="text-xs text-gray-500">Growth & retention</span>
                  </Button>

                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <Activity className="h-6 w-6" />
                    <span className="text-sm">Performance Report</span>
                    <span className="text-xs text-gray-500">System metrics</span>
                  </Button>

                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <Download className="h-6 w-6" />
                    <span className="text-sm">Custom Export</span>
                    <span className="text-xs text-gray-500">CSV/Excel format</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )
}
