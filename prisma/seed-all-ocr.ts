// Combined seed script for AI providers, plans, and assignments
// Combines seed-plans.ts and seed-ocr-assignments.ts to avoid duplication
// Run with: npx ts-node prisma/seed-all.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding AI Providers, Plans, and Assignments...')

  // Create AI Providers (from seed-ocr-assignments with updates)
  const providers = [
    {
      id: 'google_gemini_001',
      name: 'Google Gemini Vision',
      provider: 'google',
      modelName: 'gemini-1.5-flash',
      costPerRequest: 0.0025,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 5000,
      priority: 1,
      isActive: true
    },
    {
      id: 'anthropic_claude_001',
      name: 'Anthropic Claude Vision',
      provider: 'anthropic',
      modelName: 'claude-3-5-haiku-20241022',
      costPerRequest: 0.015,
      maxRequestsPerHour: 100,
      maxRequestsPerDay: 1000,
      priority: 2,
      isActive: true
    },
    {
      id: 'openai_gpt_001',
      name: 'OpenAI GPT-4o Mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      costPerRequest: 0.01,
      maxRequestsPerHour: 200,
      maxRequestsPerDay: 1000,
      priority: 3,
      isActive: true
    },
    {
      id: 'tesseract_001',
      name: 'Tesseract OCR',
      provider: 'tesseract',
      modelName: 'tesseract-ocr',
      costPerRequest: 0.001,
      maxRequestsPerHour: 10000,
      maxRequestsPerDay: 100000,
      priority: 4,
      isActive: true
    }
  ]

  // Upsert AI Providers
  for (const provider of providers) {
    const { id, ...providerData } = provider
    await prisma.aIProvider.upsert({
      where: { id: provider.id },
      update: providerData,
      create: provider
    })
    console.log(`✅ Created/Updated AI Provider: ${provider.name}`)
  }

  // Create User Plans
  const plans = [
    {
      id: 'free',
      name: 'free',
      displayName: 'Free Plan',
      price: 0,
      currency: 'NGN',
      maxScansPerMonth: 155,
      maxAIRequestsPerMonth: 155,
      priority: 0,
      isActive: true
    },
    {
      id: 'basic',
      name: 'basic',
      displayName: 'Basic Plan',
      price: 0,
      currency: 'NGN',
      maxScansPerMonth: 500,
      maxAIRequestsPerMonth: 500,
      priority: 1,
      isActive: true
    },
    {
      id: 'standard',
      name: 'standard',
      displayName: 'Standard Plan',
      price: 0,
      currency: 'NGN',
      maxScansPerMonth: 1500,
      maxAIRequestsPerMonth: 1500,
      priority: 2,
      isActive: true
    },
    {
      id: 'business',
      name: 'business',
      displayName: 'Business Plan',
      price: 0,
      currency: 'NGN',
      maxScansPerMonth: 2000,
      maxAIRequestsPerMonth: 2000,
      priority: 3,
      isActive: true
    }
  ]

  // Upsert User Plans
  for (const plan of plans) {
    const { id, ...planData } = plan
    await prisma.userPlan.upsert({
      where: { id: plan.id },
      update: planData,
      create: plan
    })
    console.log(`✅ Created/Updated Plan: ${plan.displayName}`)
  }

  // Get plan IDs
  const planRecords = await prisma.userPlan.findMany({
    select: { id: true, name: true }
  })

  const planMap: Record<string, string> = {}
  planRecords.forEach(plan => {
    planMap[plan.name] = plan.id
  })

  console.log('📋 Available plans:', planMap)

  // Plan Assignments - Define which AI providers each plan can use
  const assignments = [
    // Free Plan: Gemini only (rate limited)
    {
      planName: 'free',
      providers: [
        { providerId: 'google_gemini_001', priority: 1, maxRequestsPerHour: 10 }
      ]
    },

    // Basic Plan: Gemini primary, Tesseract fallback
    {
      planName: 'basic',
      providers: [
        { providerId: 'google_gemini_001', priority: 1, maxRequestsPerHour: 50 },
        { providerId: 'tesseract_001', priority: 2, maxRequestsPerHour: 1000 }
      ]
    },

    // Standard Plan: Gemini primary for OCR, Claude for verification, Tesseract fallback
    {
      planName: 'standard',
      providers: [
        { providerId: 'google_gemini_001', priority: 1, maxRequestsPerHour: 200 },    // 🎯 Gemini first for OCR tasks (friendlier error messages)
        { providerId: 'anthropic_claude_001', priority: 2, maxRequestsPerHour: 100 }, // Claude second for both OCR fallback and verification
        { providerId: 'tesseract_001', priority: 3, maxRequestsPerHour: 2000 }        // Tesseract as ultimate fallback
      ]
    },

      // Business Plan: Gemini primary (OCR), OpenAI secondary (verification), Tesseract fallback
    {
      planName: 'business',
      providers: [
        { providerId: 'google_gemini_001', priority: 1, maxRequestsPerHour: 2000 }, // 🎯 Increased Gemini OCR capacity
        { providerId: 'openai_gpt_001', priority: 2, maxRequestsPerHour: 1000 },     // 🎯 Increased OpenAI verification
        { providerId: 'tesseract_001', priority: 3, maxRequestsPerHour: 5000 }
      ]
    }
  ]

  // Create Plan Assignments
  for (const assignment of assignments) {
    const planId = planMap[assignment.planName]
    if (!planId) {
      console.warn(`⚠️ Plan "${assignment.planName}" not found, skipping assignments`)
      continue
    }

    for (const provider of assignment.providers) {
      await prisma.planAssignment.upsert({
        where: {
          aiProviderId_planId: {
            aiProviderId: provider.providerId,
            planId: planId
          }
        },
        update: {
          isActive: true,
          maxRequestsPerHour: provider.maxRequestsPerHour,
          priority: provider.priority
        },
        create: {
          aiProviderId: provider.providerId,
          planId: planId,
          isActive: true,
          maxRequestsPerHour: provider.maxRequestsPerHour,
          priority: provider.priority
        }
      })
      console.log(`✅ Created assignment: ${assignment.planName} -> ${provider.providerId} (priority: ${provider.priority})`)
    }
  }

  console.log('🎉 All seeding completed successfully!')
  console.log('')
  console.log('📊 Updated Plan Assignments:')
  console.log('  Free Plan: Gemini only (rate limited)')
  console.log('  Basic Plan: Gemini → Tesseract')
  console.log('  Standard Plan: Claude → Gemini → Tesseract')
  console.log('  Business Plan: Gemini → OpenAI → Tesseract')
  console.log('    - Gemini: OCR (image extraction)')
  console.log('    - OpenAI: Verification (analysis)')
  console.log('')
  console.log('💰 Pricing Structure:')
  console.log('  Free Plan: 0₦ (limited)')
  console.log('  Basic Plan: 75₦ per point')
  console.log('  Standard Plan: 100₦ per point')
  console.log('  Business Plan: 130₦ per point')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
