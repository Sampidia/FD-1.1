import { NextResponse } from 'next/server'
import { initializeMonitoringServices } from '../../../services/monitoring-init'

// Initialize monitoring services on server start
initializeMonitoringServices()

export async function GET() {
  return NextResponse.json({
    message: 'Monitoring services initialized successfully',
    status: 'ok'
  })
}
