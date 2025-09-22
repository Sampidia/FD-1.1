import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Seeding test NAFDAC alerts...')

    // Clear existing test data
    await prisma.nafdacAlert.deleteMany({
      where: {
        title: { startsWith: '[TEST]' }
      }
    })

    // Create test fake/counterfeit products
    const testAlerts = [
      {
        title: '[TEST] Postinor 2 Emergency Contraceptive 1.5mg',
        excerpt: 'Warning: Fake Postinor 2 products circulating in markets. Batch numbers TXXXXXB and related.',
        url: 'https://www.nafdac.gov.ng/notice-alert-fake-postinor-emergency-contraceptive-tablets/',
        productNames: ['postinor', 'postinor 2', 'levonorgestrel'],
        batchNumbers: ['TXXXXXB', 'P2021A01', 'EMERGENCY01'],
        manufacturer: 'Richmond Pharmaceuticals',
        alertType: 'FAKE',
        severity: 'HIGH',
        active: true,
        fullContent: 'The National Agency for Food and Drug Administration and Control (NAFDAC) has issued a public alert regarding fake Postinor 2 Emergency Contraceptive tablets currently circulating in Nigerian markets.'
      },
      {
        title: '[TEST] Amoxicillin Capsules 500mg Recall',
        excerpt: 'Amoxicillin 500mg capsules from certain manufacturers found to have failed stability testing.',
        url: 'https://www.nafdac.gov.ng/amoxicillin-stability-issues/',
        productNames: ['amoxicillin', 'amoxicillin 500mg', 'amoxicillin capsules'],
        batchNumbers: ['A2023001', 'AMOX500', 'PH123456'],
        manufacturer: 'Multiple Manufacturers',
        alertType: 'RECALL',
        severity: 'MEDIUM',
        active: true,
        fullContent: 'NAFDAC is recalling all batches of Amoxicillin 500mg capsules due to potential stability issues.'
      },
      {
        title: '[TEST] Paracetamol Tablets 500mg Contamination',
        excerpt: 'Paracetamol tablets found to contain heavy metal contaminants.',
        url: 'https://www.nafdac.gov.ng/paracetamol-heavy-metals/',
        productNames: ['paracetamol', 'paracetamol 500mg', 'acetaminophen'],
        batchNumbers: ['PCT2023002', 'PARA001', 'METALCONTAM'],
        manufacturer: 'Various Manufacturers',
        alertType: 'CONTAMINATED',
        severity: 'HIGH',
        active: true,
        fullContent: 'Paracetamol tablets contain elevated levels of heavy metals.'
      }
    ]

    for (const alert of testAlerts) {
      const existingAlert = await prisma.nafdacAlert.findFirst({
        where: {
          title: alert.title
        }
      })

      if (existingAlert) {
        console.log(`✅ Alert already exists: ${alert.title}`)
      } else {
        await prisma.nafdacAlert.create({
          data: {
            ...alert,
            scrapedAt: new Date(),
            date: new Date().toISOString().split('T')[0],
            category: 'recalls',
            aiProductNames: [],
            aiBatchNumbers: [],
            similarity_score: 0,
            aiExtracted: false,
            aiReason: null,
            aiConfidence: 0
          }
        })
        console.log(`✅ Created alert: ${alert.title}`)
      }
    }

    const totalActiveAlerts = await prisma.nafdacAlert.count({
      where: { active: true }
    })

    return NextResponse.json({
      success: true,
      message: 'NAFDAC test data seeded successfully',
      totalActiveAlerts,
      testProducts: [
        'Postinor 2 (Batch: TXXXXXB)',
        'Amoxicillin 500mg (Batch: A2023001)',
        'Paracetamol 500mg (Batch: PCT2023002)'
      ]
    })

  } catch (error) {
    console.error('❌ Error seeding NAFDAC alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Seeding failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
