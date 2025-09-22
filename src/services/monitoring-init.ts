/**
 * Monitoring Services Initialization
 *
 * Initializes and starts all monitoring services for the application.
 */

import { systemHealthMonitor } from './system-health-monitor'
import { securityMonitor } from './security-monitor'

export async function initializeMonitoringServices(): Promise<void> {
  try {
    console.log('🔍 Initializing monitoring services...')

    // Start system health monitoring
    systemHealthMonitor.startPeriodicMonitoring()
    console.log('✅ System health monitoring started')

    // System health monitoring is now active
    // Security monitoring is event-driven, so it doesn't need explicit starting

    console.log('🎯 All monitoring services initialized successfully')

  } catch (error) {
    console.error('❌ Failed to initialize monitoring services:', error)
    // Don't throw - monitoring initialization failure shouldn't break app startup
  }
}

// Export monitoring services for external access
export { systemHealthMonitor, securityMonitor }