// Seed script to create the 3 AI plans and their providers
import prisma from '../src/lib/prisma'

async function seedPlans() {
  console.log('🌱 Seeding 3-tier AI plans...')

  try {
    // First, ensure AI providers exist - check if they exist first
    let googleProvider = await prisma.aIProvider.findFirst({
      where: { provider: 'google' }
    })

    if (!googleProvider) {
      googleProvider = await prisma.aIProvider.create({
        data: {
          name: 'Google Gemini',
          provider: 'google',
          modelName: 'gemini-1.5-flash',
          costPerRequest: 0.00000025,
          maxRequestsPerHour: 1000,
          maxRequestsPerDay: 10000,
          priority: 1,
          isActive: true
        }
      })
    }

    let openaiProvider = await prisma.aIProvider.findFirst({
      where: { provider: 'openai' }
    })

    if (!openaiProvider) {
      openaiProvider = await prisma.aIProvider.create({
        data: {
          name: 'OpenAI GPT',
          provider: 'openai',
          modelName: 'gpt-4',
          costPerRequest: 0.002,
          maxRequestsPerHour: 1000,
          maxRequestsPerDay: 10000,
          priority: 2,
          isActive: true
        }
      })
    }

    let anthropicProvider = await prisma.aIProvider.findFirst({
      where: { provider: 'anthropic' }
    })

    if (!anthropicProvider) {
      anthropicProvider = await prisma.aIProvider.create({
        data: {
          name: 'Anthropic Claude',
          provider: 'anthropic',
          modelName: 'claude-3-5-sonnet-20240620',
          costPerRequest: 0.015,
          maxRequestsPerHour: 1000,
          maxRequestsPerDay: 10000,
          priority: 1,
          isActive: true
        }
      })
    }

    console.log('✅ AI Providers created/updated')

    // Create the 3 plans - using manual ID to match User.planId defaults
    let basicPlan
    try {
      basicPlan = await prisma.userPlan.create({
        data: {
          id: 'basic',
          name: 'basic',
          displayName: 'Basic Plan',
          price: 0, // Free/Pay-per-use
          currency: 'NGN',
          maxScansPerMonth: 50,
          maxAIRequestsPerMonth: 100,
          priority: 1,
          isActive: true
        }
      })
    } catch (error) {
      // Plan might already exist, try to find it
      basicPlan = await prisma.userPlan.findUnique({ where: { id: 'basic' } })
      if (!basicPlan) throw error
    }

    let standardPlan
    try {
      standardPlan = await prisma.userPlan.create({
        data: {
          id: 'standard',
          name: 'standard',
          displayName: 'Standard Plan',
          price: 0, // Monthly pricing can be added later
          currency: 'NGN',
          maxScansPerMonth: 200,
          maxAIRequestsPerMonth: 500,
          priority: 2,
          isActive: true
        }
      })
    } catch (error) {
      // Plan might already exist, try to find it
      standardPlan = await prisma.userPlan.findUnique({ where: { id: 'standard' } })
      if (!standardPlan) throw error
    }

    let businessPlan
    try {
      businessPlan = await prisma.userPlan.create({
        data: {
          id: 'business',
          name: 'business',
          displayName: 'Business Plan',
          price: 0, // Monthly pricing can be added later
          currency: 'NGN',
          maxScansPerMonth: 1000,
          maxAIRequestsPerMonth: 2000,
          priority: 3,
          isActive: true
        }
      })
    } catch (error) {
      // Plan might already exist, try to find it
      businessPlan = await prisma.userPlan.findUnique({ where: { id: 'business' } })
      if (!businessPlan) throw error
    }

    console.log('✅ Plans created/updated')

    // Create plan assignments (which AI providers each plan can use)

    // Basic Plan: Only Google Gemini
    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: googleProvider.id,
          planId: basicPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: googleProvider.id,
        planId: basicPlan.id,
        isActive: true,
        maxRequestsPerHour: 100,
        priority: 1 // Highest priority for basic plan
      }
    })

    // Standard Plan: Google Gemini (primary) + Anthropic Claude (fallback)
    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: anthropicProvider.id,
          planId: standardPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: anthropicProvider.id,
        planId: standardPlan.id,
        isActive: true,
        maxRequestsPerHour: 200,
        priority: 1 // Highest priority for standard plan
      }
    })

    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: googleProvider.id,
          planId: standardPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: googleProvider.id,
        planId: standardPlan.id,
        isActive: true,
        maxRequestsPerHour: 200,
        priority: 2 // Fallback priority for google
      }
    })

    // Business Plan: OpenAI (primary) + Anthropic Claude + Google Gemini (fallbacks)
    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: openaiProvider.id,
          planId: businessPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: openaiProvider.id,
        planId: businessPlan.id,
        isActive: true,
        maxRequestsPerHour: 500,
        priority: 1 // Highest priority for business plan
      }
    })

    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: anthropicProvider.id,
          planId: businessPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: anthropicProvider.id,
        planId: businessPlan.id,
        isActive: true,
        maxRequestsPerHour: 500,
        priority: 2 // Second priority
      }
    })

    await prisma.planAssignment.upsert({
      where: {
        aiProviderId_planId: {
          aiProviderId: googleProvider.id,
          planId: businessPlan.id
        }
      },
      update: {},
      create: {
        aiProviderId: googleProvider.id,
        planId: businessPlan.id,
        isActive: true,
        maxRequestsPerHour: 500,
        priority: 3 // Lowest priority fallback
      }
    })

    console.log('✅ Plan assignments created/updated')

    console.log('\n🎉 Plans seeding completed successfully!')
    console.log('📋 Summary:')
    console.log(`   • Basic Plan: Google Gemini (Primary - 75₦/point)`)
    console.log(`   • Standard Plan: Anthropic Claude (Primary) + Google Gemini (Fallback - 100₦/point)`)
    console.log(`   • Business Plan: OpenAI GPT (Primary) + Anthropic Claude + Google Gemini (FallBack - 130₦/point)`)

  } catch (error) {
    console.error('❌ Error seeding plans:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeder if this script is executed directly
if (require.main === module) {
  seedPlans()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

export default seedPlans
