import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 DEBUG: Checking NAFDAC database status...')

    // Get total alerts count
    const totalAlerts = await prisma.nafdacAlert.count({})
    console.log(`📊 Total NAFDAC alerts in database: ${totalAlerts}`)

    // Get active alerts count
    const activeAlerts = await prisma.nafdacAlert.count({
      where: { active: true }
    })
    console.log(`✅ Active NAFDAC alerts: ${activeAlerts}`)

    // Get inactive alerts count
    const inactiveAlerts = await prisma.nafdacAlert.count({
      where: { active: false }
    })
    console.log(`❌ Inactive NAFDAC alerts: ${inactiveAlerts}`)

    // Get sample active alerts
    const sampleAlerts = await prisma.nafdacAlert.findMany({
      where: { active: true },
      select: {
        id: true,
        title: true,
        productNames: true,
        batchNumbers: true,
        alertType: true,
        scrapedAt: true
      },
      orderBy: { scrapedAt: 'desc' },
      take: 5
    })

    console.log('🔍 Sample active alerts:')
    sampleAlerts.forEach((alert: any) => {
      console.log(`  - ${alert.title}`)
      console.log(`    Product names: ${alert.productNames}`)
      console.log(`    Batch numbers: ${alert.batchNumbers}`)
      console.log(`    Alert type: ${alert.alertType}`)
    })

    // Test specific search with known fake product
    const fakeProducts = ['postinor', 'amoxicillin', 'paracetamol']

    for (const productName of fakeProducts) {
      console.log(`\n🔍 Testing search for: "${productName}"`)

      // Test title search
      const titleMatches = await prisma.nafdacAlert.findMany({
        where: {
          active: true,
          title: { contains: productName, mode: 'insensitive' }
        },
        select: { title: true }
      })
      console.log(`  Title matches: ${titleMatches.length}`)

      // Test product names array search
      const productNameMatches = await prisma.nafdacAlert.findMany({
        where: {
          active: true,
          productNames: { hasSome: [productName.toLowerCase()] }
        },
        select: { title: true, productNames: true }
      })
      console.log(`  Product name matches: ${productNameMatches.length}`)
    }

    // 🚨 CRITICAL DIAGNOSTIC: Test the exact search logic from verify-product
    console.log('\n🚨 CRITICAL DIAGNOSTIC: Testing exact search logic from verify-product endpoint:')
    console.log('This shows WHY seeded products are NOT being found')

    // Test 1: Exact product matching like in the API
    console.log('\n🔍 TEST 1: Exact "Postinor 2" searches (like what API does):')
    const testExact = await prisma.nafdacAlert.findMany({
      where: {
        active: true,
        title: { contains: 'Postinor 2', mode: 'insensitive' }
      },
      select: { title: true, productNames: true, batchNumbers: true }
    })
    console.log(`  Found with title contains: ${testExact.length}`)
    testExact.forEach(alert => console.log(`    - Title: ${alert.title}, Products: ${alert.productNames}, Batches: ${alert.batchNumbers}`))

    // Test 2: Product names array search like in the API
    const testProductArr = await prisma.nafdacAlert.findMany({
      where: {
        active: true,
        productNames: { hasSome: ['postinor 2'] }
      },
      select: { title: true, productNames: true, batchNumbers: true }
    })
    console.log(`\n🔍 TEST 2: Product names array search:`)
    console.log(`  Found with productNames.hasSome(['postinor 2']): ${testProductArr.length}`)
    testProductArr.forEach(alert => console.log(`    - Title: ${alert.title}, Products: ${alert.productNames}, Batches: ${alert.batchNumbers}`))

    // Test 3: Individual keyword search like in the API
    const testKeywords = await prisma.nafdacAlert.findMany({
      where: {
        active: true,
        AND: [
          { productNames: { hasSome: ['postinor'] } },
          { title: { contains: 'postinor', mode: 'insensitive' } }
        ]
      },
      select: { title: true, productNames: true, batchNumbers: true }
    })
    console.log(`\n🔍 TEST 3: Keyword search:`)
    console.log(`  Found with keyword 'postinor': ${testKeywords.length}`)
    testKeywords.forEach(alert => console.log(`    - Title: ${alert.title}, Products: ${alert.productNames}, Batches: ${alert.batchNumbers}`))

    // Test 4: Check if batch search would work
    console.log('\n🔍 TEST 4: Batch number search:')
    const testBatch = await prisma.nafdacAlert.findMany({
      where: {
        active: true,
        batchNumbers: { has: 'TXXXXXB' }
      },
      select: { title: true, productNames: true, batchNumbers: true }
    })
    console.log(`  Found with batch 'TXXXXXB': ${testBatch.length}`)
    testBatch.forEach(alert => console.log(`    - Title: ${alert.title}, Products: ${alert.productNames}, Batches: ${alert.batchNumbers}`))

    return NextResponse.json({
      totalAlerts,
      activeAlerts,
      inactiveAlerts,
      sampleAlerts,
      message: activeAlerts === 0
        ? '❌ CRITICAL: No active NAFDAC alerts found! This explains why all products appear safe.'
        : '✅ NAFDAC database contains active alerts, searches should work.'
    })

  } catch (error) {
    console.error('🚨 Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Database error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
