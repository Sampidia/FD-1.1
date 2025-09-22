import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin email
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    if (session.user.email !== adminEmail) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch system notifications
    const notifications = await prisma.systemNotification.findMany({
      orderBy: [
        { isResolved: 'asc' }, // Show unresolved first
        { createdAt: 'desc' }  // Then by creation date
      ],
      take: 50 // Limit to recent 50 notifications
    })

    return NextResponse.json({
      success: true,
      data: notifications
    })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin email
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    const isAdmin = session?.user?.email === adminEmail ||
                   session?.user?.id === 'admin001'

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { notificationId, action } = await request.json()

    if (!notificationId || !action) {
      return NextResponse.json(
        { success: false, message: 'Missing notificationId or action' },
        { status: 400 }
      )
    }

    if (action === 'mark_read') {
      await prisma.systemNotification.update({
        where: { id: notificationId },
        data: { status: 'read' }
      })
    } else if (action === 'mark_resolved') {
      await prisma.systemNotification.update({
        where: { id: notificationId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: session.user.id
        }
      })
    } else if (action === 'mark_unread') {
      await prisma.systemNotification.update({
        where: { id: notificationId },
        data: { status: 'unread' }
      })
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification updated successfully'
    })

  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update notification' },
      { status: 500 }
    )
  }
}